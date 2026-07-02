import type { Cliente, ClienteCreatePayload, ClienteEstadoCuentaItem, ClienteUpdatePayload, ClientePagoPayload, ClientePagoHistorial } from '../../../../features/clientes/types/cliente';
import { mockApiCall } from '../mockClient';
import { getMockCuentaCorrienteRows, setMockCuentaCorrienteRows } from './mockStockPTService';
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

const getClienteFinancialSummary = (clienteId: string) => {
  const rows = getMockCuentaCorrienteRows().filter((row) => row.cliente_id === clienteId);
  if (rows.length === 0) {
    return null;
  }

  const saldoPendienteArs = rows.reduce((acc, row) => acc + Number(row.saldo ?? 0), 0);
  const latest = rows.reduce<{ score: number; value: string | null } | null>((current, row) => {
    const score = new Date(row.fecha).getTime();
    if (!Number.isFinite(score)) return current;
    if (!current || score > current.score) {
      return { score, value: row.fecha };
    }
    return current;
  }, null);

  return {
    saldoPendienteArs,
    ultimaCompra: latest?.value ? latest.value.slice(0, 10) : null,
  };
};

export const mockClienteService = {
  getAll: async (): Promise<Cliente[]> => {
    const rows = mockClientes.map((cliente) => {
      const summary = getClienteFinancialSummary(cliente.uid);
      if (!summary) return cliente;
      return {
        ...cliente,
        saldoPendienteArs: summary.saldoPendienteArs,
        ultimaCompra: summary.ultimaCompra ?? undefined,
      };
    });

    return mockApiCall(rows);
  },

  getById: async (uid: string): Promise<Cliente | undefined> => mockApiCall(mockClientes.find((cliente) => cliente.uid === uid)),

  getEstadoCuentaCliente: async (clienteId: string): Promise<ClienteEstadoCuentaItem[]> => {
    const rows = (await getMockCuentaCorrienteRows())
      .filter((row) => row.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .map(({ cliente_id: _clienteId, ...row }) => row);

    return mockApiCall(rows);
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
    // 1. Find client
    const client = mockClientes.find((c) => c.uid === payload.clienteId);
    if (!client) throw new Error('Cliente no encontrado');

    // 2. Fetch outstanding cuenta corriente rows for this client
    let rows = getMockCuentaCorrienteRows().filter((row) => row.cliente_id === payload.clienteId && row.saldo > 0);

    const totalOutstanding = rows.reduce((acc, r) => acc + r.saldo, 0);
    if (payload.monto > totalOutstanding) {
      throw new Error(`El monto del pago (${payload.monto}) no puede superar el saldo pendiente del cliente (${totalOutstanding}).`);
    }

    if (payload.comprobanteId) {
      rows = rows.filter((row) => row.id === payload.comprobanteId);
    } else {
      // Sort oldest first
      rows.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }

    let remainingAmount = payload.monto;
    const updatedCcRows = getMockCuentaCorrienteRows().map((row) => {
      const isTarget = rows.some((r) => r.id === row.id);
      if (isTarget && remainingAmount > 0) {
        const applied = Math.min(remainingAmount, row.saldo);
        const newSaldo = Number((row.saldo - applied).toFixed(2));
        remainingAmount = Number((remainingAmount - applied).toFixed(2));
        return {
          ...row,
          saldo: newSaldo,
          estado: newSaldo <= 0 ? 'PAGADO' : row.estado,
        };
      }
      return row;
    });

    // Write back updated rows
    setMockCuentaCorrienteRows(updatedCcRows);

    // Append receipt row
    const receiptRow = {
      cliente_id: payload.clienteId,
      id: `cxc-recibo-${Math.floor(Math.random() * 1000000)}`,
      fecha: payload.fechaPago,
      producto: 'PAGO CLIENTE',
      cantidad: null,
      importe: payload.monto,
      saldo: 0,
      referencia: payload.referencia || null,
      estado: 'PAGADO',
      comprobanteNumero: payload.referencia || null,
    };
    setMockCuentaCorrienteRows([receiptRow, ...getMockCuentaCorrienteRows()]);

    // Create flow movement
    const movementLegacyUid = `fcm-pago-cliente-mock-${receiptRow.id}`;
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: movementLegacyUid,
      fecha: payload.fechaPago,
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: payload.observaciones?.trim() || `Cobro cliente - Ref: ${payload.referencia || 'S/R'}`,
      monto: payload.monto,
      comprobante_id: receiptRow.id,
      estado: payload.metodoPago === 'cheque' ? 'PENDIENTE' : 'CONFIRMADO',
      metadata: {
        cliente_legacy_uid: payload.clienteId,
        metodo_pago: payload.metodoPago,
        referencia: payload.referencia || null,
      },
    });

    // Create cheque if method is cheque
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
