import type { Cliente, ClienteCreatePayload, ClienteEstadoCuentaItem, ClienteUpdatePayload, ClientePagoPayload, ClientePagoHistorial } from '../../../../features/clientes/types/cliente';
import { mockApiCall } from '../mockClient';
import { mockOrdenesExpedicionService } from './mockOrdenesExpedicionService';
import { contabilidadOperativaService } from '../../../../features/finanzas/services/contabilidadOperativaService';
import { tesoreriaService } from '../../../../features/tesoreria/services/tesoreriaService';

let mockClientes: Cliente[] = [
  {
    uid: 'cli-001',
    nombre: 'Estancia La Esperanza',
    segmento: 'Tambo',
    ubicacion: 'Rafaela, Santa Fe',
    contacto: 'Marina Gómez · +54 3492 445112',
    productoPrincipal: 'Alimento Lechera',
    condicionComercial: '30 días fecha factura',
    estado: 'Activo',
    observaciones: 'Cliente estable con compras quincenales.',
    ultimaCompra: '2026-05-15',
    saldoPendienteArs: 325000,
    estaActivo: true,
  },
  {
    uid: 'cli-002',
    nombre: 'Agropecuaria Don Sergio',
    segmento: 'Mixto agrícola-ganadero',
    ubicacion: 'Pergamino, Buenos Aires',
    contacto: 'Julián Díaz · +54 2477 518223',
    productoPrincipal: 'Ración Recría/Engorde',
    condicionComercial: '21 días',
    estado: 'En riesgo',
    observaciones: 'Cliente con tensión de cobranzas.',
    ultimaCompra: '2026-05-08',
    saldoPendienteArs: 1185000,
    estaActivo: true,
  },
  {
    uid: 'cli-003',
    nombre: 'Tambo San Miguel',
    segmento: 'Tambo',
    ubicacion: 'Villa María, Córdoba',
    contacto: 'Natalia Ferreyra · +54 353 4869012',
    productoPrincipal: 'Alimento Lechera',
    condicionComercial: 'Contado contra entrega',
    estado: 'Activo',
    observaciones: 'Cuenta saneada.',
    ultimaCompra: '2026-05-17',
    saldoPendienteArs: 0,
    estaActivo: true,
  },
];

const getMetadataString = (meta: unknown, key: string): string | undefined => {
  if (!meta || typeof meta !== 'object') return undefined;
  const val = (meta as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : undefined;
};

const getClienteFinancialSummary = async (clienteId: string) => {
  const allExpediciones = await mockOrdenesExpedicionService.getAll();
  const despachadas = allExpediciones.filter(
    (o) => o.cliente_id === clienteId && o.estado === 'despachada'
  );

  const totalInvoiced = despachadas.reduce((acc, o) => {
    const total = Number(o.total_venta ?? 0) > 0
      ? Number(o.total_venta)
      : Number(o.kilos_reales_cargados ?? o.cantidad_kg ?? 0) * Number(o.precio_unitario_venta ?? 0);
    return acc + total;
  }, 0);

  const mockMovs = contabilidadOperativaService.getMovimientosMock();
  const totalPaid = mockMovs
    .filter(
      (m) =>
        m.tipo === 'INGRESO' &&
        (m.origen_operativo === 'COBRANZA' || m.origen_operativo === 'COBRANZA_MANUAL') &&
        (getMetadataString(m.metadata, 'cliente_legacy_uid') === clienteId || getMetadataString(m.metadata, 'cliente_id') === clienteId) &&
        m.estado === 'CONFIRMADO'
    )
    .reduce((acc, m) => acc + Number(m.monto ?? 0), 0);

  const saldoPendienteArs = Math.max(0, Number((totalInvoiced - totalPaid).toFixed(2)));

  const latestDate = despachadas.reduce<string | null>((latest, o) => {
    if (!latest || new Date(o.created_at).getTime() > new Date(latest).getTime()) {
      return o.created_at;
    }
    return latest;
  }, null);

  return {
    saldoPendienteArs,
    ultimaCompra: latestDate ? latestDate.slice(0, 10) : null,
  };
};

export const mockClienteService = {
  getAll: async (): Promise<Cliente[]> => {
    const rows = await Promise.all(
      mockClientes.map(async (cliente) => {
        const summary = await getClienteFinancialSummary(cliente.uid);
        return {
          ...cliente,
          saldoPendienteArs: summary.saldoPendienteArs,
          ultimaCompra: summary.ultimaCompra ?? undefined,
        };
      })
    );

    return mockApiCall(rows);
  },

  getById: async (uid: string): Promise<Cliente | undefined> => mockApiCall(mockClientes.find((cliente) => cliente.uid === uid)),

  getEstadoCuentaCliente: async (clienteId: string): Promise<ClienteEstadoCuentaItem[]> => {
    const allExpediciones = await mockOrdenesExpedicionService.getAll();
    const despachadas = allExpediciones.filter(
      (o) => o.cliente_id === clienteId && o.estado === 'despachada'
    );

    const mockMovs = contabilidadOperativaService.getMovimientosMock();
    const payments = mockMovs.filter(
      (m) =>
        m.tipo === 'INGRESO' &&
        (m.origen_operativo === 'COBRANZA' || m.origen_operativo === 'COBRANZA_MANUAL') &&
        (getMetadataString(m.metadata, 'cliente_legacy_uid') === clienteId || getMetadataString(m.metadata, 'cliente_id') === clienteId) &&
        m.estado === 'CONFIRMADO'
    );

    const targetedPayments = new Map<string, number>();
    let generalPaymentsAmount = 0;

    payments.forEach((m) => {
      const targetId = (m.comprobante_id || getMetadataString(m.metadata, 'comprobante_id')) as string | undefined;
      if (targetId) {
        targetedPayments.set(targetId, (targetedPayments.get(targetId) ?? 0) + Number(m.monto ?? 0));
      } else {
        generalPaymentsAmount += Number(m.monto ?? 0);
      }
    });

    const sortedExpediciones = [...despachadas].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const expedicionesRows = sortedExpediciones.map((orden) => {
      const total = Number(orden.total_venta ?? 0) > 0
        ? Number(orden.total_venta)
        : Number(orden.kilos_reales_cargados ?? orden.cantidad_kg ?? 0) * Number(orden.precio_unitario_venta ?? 0);

      const targetedPaid = targetedPayments.get(orden.id) ?? 0;
      let remainingToPay = Math.max(0, total - targetedPaid);

      let fifoPaid = 0;
      if (generalPaymentsAmount > 0 && remainingToPay > 0) {
        fifoPaid = Math.min(generalPaymentsAmount, remainingToPay);
        generalPaymentsAmount = Number((generalPaymentsAmount - fifoPaid).toFixed(2));
        remainingToPay = Number((remainingToPay - fifoPaid).toFixed(2));
      }

      const totalPaid = Number((targetedPaid + fifoPaid).toFixed(2));
      const saldo = Number((total - totalPaid).toFixed(2));

      return {
        id: orden.id,
        fecha: orden.created_at,
        producto: orden.nombre_producto,
        cantidad: orden.kilos_reales_cargados ?? orden.cantidad_kg,
        unidad: orden.unidad_cantidad,
        importe: total,
        saldo,
        referencia: orden.referencia || orden.numero_expedicion,
        estado: saldo <= 0 ? 'PAGADO' : 'PENDIENTE',
        comprobanteNumero: orden.numero_expedicion,
      };
    });

    const paymentRows = payments.map((m) => ({
      id: (m.legacy_uid || m.id || '') as string,
      fecha: m.fecha,
      producto: 'PAGO CLIENTE',
      cantidad: null,
      unidad: null,
      importe: Number(m.monto ?? 0),
      saldo: 0,
      referencia: (getMetadataString(m.metadata, 'referencia') || m.descripcion || null) as string | null,
      estado: 'PAGADO',
      comprobanteNumero: (getMetadataString(m.metadata, 'referencia') || null) as string | null,
    }));

    return [...expedicionesRows, ...paymentRows].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  },

  create: async (data: ClienteCreatePayload): Promise<Cliente> => {
    const nuevo: Cliente = {
      ...data,
      uid: `cli-${Math.floor(Math.random() * 1000000)}`,
    };
    mockClientes = [nuevo, ...mockClientes];
    return mockApiCall(nuevo);
  },

  update: async (uid: string, data: ClienteUpdatePayload): Promise<Cliente> => {
    const updated = mockClientes.find((cliente) => cliente.uid === uid);
    if (!updated) throw new Error(`Cliente con UID ${uid} no encontrado`);

    const nextCliente = { ...updated, ...data };
    mockClientes = mockClientes.map((cliente) => (cliente.uid === uid ? nextCliente : cliente));
    return mockApiCall(nextCliente);
  },

  delete: async (uid: string): Promise<boolean> => {
    mockClientes = mockClientes.map((cliente) =>
      cliente.uid === uid ? { ...cliente, estaActivo: false, estado: 'Suspendido' } : cliente
    );
    return mockApiCall(true);
  },

  registrarPago: async (payload: ClientePagoPayload): Promise<void> => {
    const client = mockClientes.find((c) => c.uid === payload.clienteId);
    if (!client) throw new Error('Cliente no encontrado');

    const allRows = await mockClienteService.getEstadoCuentaCliente(payload.clienteId);
    let outstandingInvoices = allRows.filter((r) => r.saldo > 0 && r.producto !== 'PAGO CLIENTE');

    const totalOutstanding = outstandingInvoices.reduce((acc, r) => acc + r.saldo, 0);
    if (payload.monto > totalOutstanding) {
      throw new Error(`El monto del pago (${payload.monto}) no puede superar el saldo pendiente del cliente (${totalOutstanding}).`);
    }

    const receiptRowId = `cxc-recibo-${Math.floor(Math.random() * 1000000)}`;
    const movementLegacyUid = `fcm-pago-cliente-mock-${receiptRowId}`;

    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: movementLegacyUid,
      fecha: payload.fechaPago,
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: payload.observaciones?.trim() || `Cobro cliente - Ref: ${payload.referencia || 'S/R'}`,
      monto: payload.monto,
      comprobante_id: payload.comprobanteId || undefined,
      estado: payload.metodoPago === 'cheque' ? 'PENDIENTE' : 'CONFIRMADO',
      metadata: {
        cliente_legacy_uid: payload.clienteId,
        cliente_id: payload.clienteId,
        metodo_pago: payload.metodoPago,
        referencia: payload.referencia || null,
        comprobante_id: payload.comprobanteId || null,
      },
    });

    if (payload.metodoPago === 'cheque' && payload.cheque) {
      await tesoreriaService.createCheque({
        numero: payload.cheque.numero,
        tipo: 'RECIBIDO',
        tercero: client.nombre,
        importe: payload.monto,
        fecha_emision: payload.cheque.fechaEmision,
        fecha_vencimiento: payload.cheque.fechaVencimiento,
        estado: 'PENDIENTE',
        cliente_id: client.uid,
        cliente_nombre: client.nombre,
      });
    }
  },

  getPagos: async (): Promise<ClientePagoHistorial[]> => {
    const mockMovs = contabilidadOperativaService.getMovimientosMock();
    const payments = mockMovs.filter((m) => m.tipo === 'INGRESO' && (m.origen_operativo === 'COBRANZA' || m.origen_operativo === 'COBRANZA_MANUAL'));

    const pagos: ClientePagoHistorial[] = [];
    const processedUids = new Set<string>();

    payments.forEach((mov) => {
      const uid = mov.legacy_uid || mov.id || '';
      if (!uid || processedUids.has(uid)) return;
      processedUids.add(uid);

      const metadata = (mov.metadata || {}) as Record<string, any>;
      const clienteId = metadata.cliente_legacy_uid || '';
      const client = mockClientes.find((c) => c.uid === clienteId);
      const clienteNombre = client ? client.nombre : 'Cliente desconocido';

      if (!clienteId) {
        // Only show client payments where the client could be resolved
        return;
      }

      pagos.push({
        id: uid,
        fecha: mov.fecha,
        clienteId,
        clienteNombre,
        monto: Number(mov.monto ?? 0),
        metodoPago: metadata.metodo_pago || 'efectivo',
        referencia: metadata.referencia || '',
        concepto: mov.descripcion,
        estado: mov.estado || 'CONFIRMADO',
        movimientoId: mov.legacy_uid || mov.id,
        comprobanteId: mov.comprobante_id || undefined,
      });
    });

    pagos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return mockApiCall(pagos);
  },
};
