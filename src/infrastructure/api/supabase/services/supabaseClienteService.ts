import type { Cliente, ClienteCreatePayload, ClienteEstadoCuentaItem, ClienteUpdatePayload, EstadoCliente, ClientePagoPayload, ClientePagoHistorial } from '../../../../features/clientes/types/cliente';
import { supabaseClient } from '../client';

interface ClienteRow {
  id: string;
  legacy_uid: string | null;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  segmento: string | null;
  ubicacion: string | null;
  contacto: string | null;
  producto_principal: string | null;
  condicion_comercial: string | null;
  estado: string;
  observaciones: string | null;
  ultima_compra: string | null;
  saldo_pendiente_ars: number | null;
  esta_activo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface ComprobanteRow {
  id: string;
  legacy_uid: string | null;
  cliente_id: string | null;
  tipo: string;
  numero: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  tercero: string | null;
  estado: string;
  total: number | null;
  saldo: number | null;
}

interface FlujoCajaMovimientoRow {
  comprobante_id: string | null;
  descripcion: string | null;
  monto: number | null;
  estado: string | null;
  fecha: string;
  metadata: Record<string, unknown> | null;
  stock_pt_id: string | null;
}

interface ClienteFinancialAggregate {
  saldoPendienteArs: number;
  ultimaCompra: string | null;
}

const normalizeEstado = (estado: string | null | undefined, estaActivo: boolean): EstadoCliente => {
  if (!estaActivo) return 'Suspendido';
  const normalized = (estado ?? '').trim().toLowerCase();
  if (normalized === 'en riesgo') return 'En riesgo';
  if (normalized === 'suspendido') return 'Suspendido';
  return 'Activo';
};

const mapRowToCliente = (row: ClienteRow): Cliente => ({
  id: row.id,
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre: row.nombre,
  razonSocial: row.razon_social ?? undefined,
  cuit: row.cuit ?? undefined,
  email: row.email ?? undefined,
  telefono: row.telefono ?? undefined,
  direccion: row.direccion ?? undefined,
  localidad: row.localidad ?? undefined,
  provincia: row.provincia ?? undefined,
  segmento: row.segmento ?? undefined,
  ubicacion: row.ubicacion ?? undefined,
  contacto: row.contacto ?? undefined,
  productoPrincipal: row.producto_principal ?? undefined,
  condicionComercial: row.condicion_comercial ?? undefined,
  estado: normalizeEstado(row.estado, row.esta_activo),
  observaciones: row.observaciones ?? undefined,
  ultimaCompra: row.ultima_compra ?? undefined,
  saldoPendienteArs: Number(row.saldo_pendiente_ars ?? 0),
  estaActivo: row.esta_activo,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const sumClienteComprobantes = (comprobantes: ComprobanteRow[]): ClienteFinancialAggregate => {
  if (comprobantes.length === 0) {
    return { saldoPendienteArs: 0, ultimaCompra: null };
  }

  const saldoPendienteArs = comprobantes.reduce((acc, comprobante) => acc + Number(comprobante.saldo ?? 0), 0);
  const latest = comprobantes.reduce<{ score: number; value: string | null } | null>((current, comprobante) => {
    const score = new Date(comprobante.fecha_emision).getTime();
    if (!Number.isFinite(score)) return current;
    if (!current || score > current.score) {
      return { score, value: comprobante.fecha_emision };
    }
    return current;
  }, null);

  return {
    saldoPendienteArs,
    ultimaCompra: latest?.value ? latest.value.slice(0, 10) : null,
  };
};

const formatMetadataText = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const formatMetadataNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveClienteDbId = async (clienteLegacyUid: string) => {
  const { data, error } = await supabaseClient
    .from('clientes')
    .select('id')
    .eq('legacy_uid', clienteLegacyUid)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return data?.id ?? null;
};

const buildInsertPayload = (payload: ClienteCreatePayload) => ({
  legacy_uid: `cli-${Math.floor(Math.random() * 1000000)}`,
  nombre: payload.nombre,
  razon_social: payload.razonSocial ?? payload.nombre,
  cuit: payload.cuit ?? null,
  email: payload.email ?? null,
  telefono: payload.telefono ?? null,
  direccion: payload.direccion ?? null,
  localidad: payload.localidad ?? null,
  provincia: payload.provincia ?? null,
  segmento: payload.segmento ?? null,
  ubicacion: payload.ubicacion ?? null,
  contacto: payload.contacto ?? null,
  producto_principal: payload.productoPrincipal ?? null,
  condicion_comercial: payload.condicionComercial ?? null,
  estado: payload.estado,
  observaciones: payload.observaciones ?? null,
  ultima_compra: payload.ultimaCompra ?? null,
  saldo_pendiente_ars: payload.saldoPendienteArs,
  esta_activo: payload.estaActivo,
});

const buildUpdatePayload = (payload: ClienteUpdatePayload) => ({
  ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
  ...(payload.razonSocial !== undefined ? { razon_social: payload.razonSocial } : {}),
  ...(payload.cuit !== undefined ? { cuit: payload.cuit } : {}),
  ...(payload.email !== undefined ? { email: payload.email } : {}),
  ...(payload.telefono !== undefined ? { telefono: payload.telefono } : {}),
  ...(payload.direccion !== undefined ? { direccion: payload.direccion } : {}),
  ...(payload.localidad !== undefined ? { localidad: payload.localidad } : {}),
  ...(payload.provincia !== undefined ? { provincia: payload.provincia } : {}),
  ...(payload.segmento !== undefined ? { segmento: payload.segmento } : {}),
  ...(payload.ubicacion !== undefined ? { ubicacion: payload.ubicacion } : {}),
  ...(payload.contacto !== undefined ? { contacto: payload.contacto } : {}),
  ...(payload.productoPrincipal !== undefined ? { producto_principal: payload.productoPrincipal } : {}),
  ...(payload.condicionComercial !== undefined ? { condicion_comercial: payload.condicionComercial } : {}),
  ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
  ...(payload.observaciones !== undefined ? { observaciones: payload.observaciones } : {}),
  ...(payload.ultimaCompra !== undefined ? { ultima_compra: payload.ultimaCompra } : {}),
  ...(payload.saldoPendienteArs !== undefined ? { saldo_pendiente_ars: payload.saldoPendienteArs } : {}),
  ...(payload.estaActivo !== undefined ? { esta_activo: payload.estaActivo } : {}),
});

const selectClause =
  'id,legacy_uid,nombre,razon_social,cuit,email,telefono,direccion,localidad,provincia,segmento,ubicacion,contacto,producto_principal,condicion_comercial,estado,observaciones,ultima_compra,saldo_pendiente_ars,esta_activo,created_at,updated_at';

export const supabaseClienteService = {
  async getAll(): Promise<Cliente[]> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select(selectClause)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data ?? []) as unknown as ClienteRow[];
    const clienteIds = rows.map((row) => row.id).filter(Boolean);

    let comprobantesByCliente = new Map<string, ComprobanteRow[]>();
    if (clienteIds.length > 0) {
      const { data: comprobantesData, error: comprobantesError } = await supabaseClient
        .from('comprobantes')
        .select('id,legacy_uid,cliente_id,tipo,numero,fecha_emision,fecha_vencimiento,tercero,estado,total,saldo')
        .is('deleted_at', null)
        .eq('tipo', 'FACTURA_VENTA')
        .in('cliente_id', clienteIds);

      if (comprobantesError) throw comprobantesError;

      comprobantesByCliente = ((comprobantesData ?? []) as ComprobanteRow[]).reduce((map, comprobante) => {
        if (!comprobante.cliente_id) return map;
        const current = map.get(comprobante.cliente_id) ?? [];
        current.push(comprobante);
        map.set(comprobante.cliente_id, current);
        return map;
      }, new Map<string, ComprobanteRow[]>());
    }

    return rows.map((row) => {
      const comprobantes = comprobantesByCliente.get(row.id) ?? [];
      const aggregate = sumClienteComprobantes(comprobantes);

      return {
        ...mapRowToCliente(row),
        saldoPendienteArs: aggregate.saldoPendienteArs,
        ultimaCompra: aggregate.ultimaCompra ?? undefined,
      };
    });
  },

  async getById(uid: string): Promise<Cliente | undefined> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select(selectClause)
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .maybeSingle<ClienteRow>();

    if (error) throw error;
    return data ? mapRowToCliente(data) : undefined;
  },

  async getEstadoCuentaCliente(clienteId: string): Promise<ClienteEstadoCuentaItem[]> {
    const clienteDbId = await resolveClienteDbId(clienteId);
    if (!clienteDbId) return [];

    const { data: comprobantesData, error: comprobantesError } = await supabaseClient
      .from('comprobantes')
      .select('id,legacy_uid,cliente_id,tipo,numero,fecha_emision,fecha_vencimiento,tercero,estado,total,saldo')
      .eq('cliente_id', clienteDbId)
      .is('deleted_at', null)
      .order('fecha_emision', { ascending: false });

    if (comprobantesError) throw comprobantesError;

    const comprobantes = (comprobantesData ?? [])
      .filter((row): row is ComprobanteRow => row.tipo === 'FACTURA_VENTA') as ComprobanteRow[];
    const comprobanteIds = comprobantes.map((row) => row.id).filter(Boolean);

    let movimientos = [] as FlujoCajaMovimientoRow[];
    if (comprobanteIds.length > 0) {
      const { data, error } = await supabaseClient
        .from('flujo_caja_movimientos')
        .select('comprobante_id,descripcion,monto,estado,fecha,metadata,stock_pt_id')
        .is('deleted_at', null)
        .eq('estado', 'CONFIRMADO')
        .in('comprobante_id', comprobanteIds);
      if (error) throw error;
      movimientos = (data ?? []) as FlujoCajaMovimientoRow[];
    }

    const movimientosByComprobante = new Map<string, FlujoCajaMovimientoRow[]>();
    movimientos.forEach((row) => {
      if (!row.comprobante_id) return;
      const current = movimientosByComprobante.get(row.comprobante_id) ?? [];
      current.push(row);
      movimientosByComprobante.set(row.comprobante_id, current);
    });

    return comprobantes.map((comprobante) => {
      const movimiento = movimientosByComprobante.get(comprobante.id)?.[0] ?? null;
      const metadata = movimiento?.metadata ?? null;
      const producto =
        formatMetadataText(metadata?.producto)
        ?? formatMetadataText(metadata?.nombre_producto)
        ?? formatMetadataText(metadata?.concepto)
        ?? formatMetadataText(metadata?.descripcion)
        ?? formatMetadataText(movimiento?.descripcion)
        ?? '—';
      const referencia =
        formatMetadataText(metadata?.referencia)
        ?? formatMetadataText(metadata?.comprobante_legacy_uid)
        ?? comprobante.numero
        ?? null;
      const cantidad = formatMetadataNumber(metadata?.cantidad);
      const unidad = formatMetadataText(metadata?.unidad) ?? formatMetadataText(metadata?.unidad_cantidad);
      const importe = Number(comprobante.total ?? movimiento?.monto ?? 0);
      const saldo = Number(comprobante.saldo ?? importe);

      return {
        id: comprobante.legacy_uid ?? comprobante.id,
        fecha: comprobante.fecha_emision,
        producto,
        cantidad,
        unidad,
        importe,
        saldo,
        referencia,
        estado: comprobante.estado,
        comprobanteNumero: comprobante.numero ?? comprobante.legacy_uid ?? null,
      };
    });
  },

  async create(payload: Omit<Cliente, 'uid' | 'createdAt' | 'updatedAt'>): Promise<Cliente> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .insert(buildInsertPayload(payload))
      .select(selectClause)
      .single<ClienteRow>();

    if (error) throw error;
    return mapRowToCliente(data);
  },

  async update(uid: string, payload: Partial<Omit<Cliente, 'uid'>>): Promise<Cliente> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .update(buildUpdatePayload(payload))
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .select(selectClause)
      .single<ClienteRow>();

    if (error) throw error;
    return mapRowToCliente(data);
  },

  async delete(uid: string): Promise<boolean> {
    const clienteDbId = await resolveClienteDbId(uid);
    if (!clienteDbId) {
      throw new Error('Cliente no encontrado');
    }

    // Check dependency in ordenes_expedicion
    const { count: expCount, error: expErr } = await supabaseClient
      .from('ordenes_expedicion')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteDbId);
    if (expErr) throw expErr;

    // Check dependency in comprobantes
    const { count: compCount, error: compErr } = await supabaseClient
      .from('comprobantes')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteDbId);
    if (compErr) throw compErr;

    // Check dependency in tesoreria_cheques
    const { count: chequeCount, error: chequeErr } = await supabaseClient
      .from('tesoreria_cheques')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteDbId);
    if (chequeErr) throw chequeErr;

    if ((expCount ?? 0) > 0 || (compCount ?? 0) > 0 || (chequeCount ?? 0) > 0) {
      throw new Error('No se puede eliminar el cliente porque tiene comprobantes, órdenes de expedición o cheques asociados.');
    }

    const { error } = await supabaseClient
      .from('clientes')
      .update({ esta_activo: false, estado: 'Suspendido', deleted_at: new Date().toISOString() })
      .eq('id', clienteDbId);

    if (error) throw error;
    return true;
  },

  async registrarPago(payload: ClientePagoPayload): Promise<void> {
    // 1. Resolve client database UUID
    const clienteDbId = await resolveClienteDbId(payload.clienteId);
    if (!clienteDbId) throw new Error('Cliente no encontrado');

    // Fetch client name for referencing
    const { data: clientObj } = await supabaseClient
      .from('clientes')
      .select('nombre')
      .eq('id', clienteDbId)
      .single<{ nombre: string }>();
    const clientName = clientObj?.nombre || 'Cliente';

    // 2. Fetch outstanding/pending facturas
    let query = supabaseClient
      .from('comprobantes')
      .select('id,legacy_uid,saldo,total,estado')
      .eq('cliente_id', clienteDbId)
      .eq('tipo', 'FACTURA_VENTA')
      .gt('saldo', 0)
      .is('deleted_at', null)
      .order('fecha_emision', { ascending: true });

    if (payload.comprobanteId) {
      // Find database ID for the specific comprobante legacy_uid
      const { data: compObj } = await supabaseClient
        .from('comprobantes')
        .select('id')
        .eq('legacy_uid', payload.comprobanteId)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>();

      if (compObj) {
        query = query.eq('id', compObj.id);
      }
    }

    const { data: facturas, error: facturasError } = await query;
    if (facturasError) throw facturasError;

    const totalOutstanding = (facturas ?? []).reduce((acc, f) => acc + Number(f.saldo ?? 0), 0);
    if (payload.monto > totalOutstanding) {
      throw new Error(`El monto del pago (${payload.monto}) no puede superar el saldo pendiente del cliente (${totalOutstanding}).`);
    }

    // 3. Deduct payment from facturas
    let remainingAmount = payload.monto;
    const updates: Promise<any>[] = [];

    for (const factura of (facturas ?? [])) {
      if (remainingAmount <= 0) break;

      const currentSaldo = Number(factura.saldo ?? 0);
      const applied = Math.min(remainingAmount, currentSaldo);
      const newSaldo = Number((currentSaldo - applied).toFixed(2));
      remainingAmount = Number((remainingAmount - applied).toFixed(2));

      const newEstado = newSaldo <= 0 ? 'PAGADO' : factura.estado;

      updates.push(
        supabaseClient
          .from('comprobantes')
          .update({
            saldo: newSaldo,
            estado: newEstado,
            updated_at: new Date().toISOString()
          })
          .eq('id', factura.id) as any
      );
    }

    await Promise.all(updates);

    // 4. Create RECIBO type comprobante
    const receiptLegacyUid = `comp-recibo-${Math.floor(Math.random() * 1000000)}`;
    const { data: receipt, error: receiptError } = await supabaseClient
      .from('comprobantes')
      .insert({
        legacy_uid: receiptLegacyUid,
        tipo: 'RECIBO',
        numero: payload.referencia || `REC-${Date.now()}`,
        fecha_emision: payload.fechaPago,
        fecha_vencimiento: payload.fechaPago,
        tercero: clientName,
        estado: 'PAGADO',
        total: payload.monto,
        saldo: 0,
        cliente_id: clienteDbId,
      })
      .select('id')
      .single<{ id: string }>();

    if (receiptError) throw receiptError;

    // 5. Fetch category id if exists (optional but nice)
    let cfId = null;
    try {
      const { data: cat } = await supabaseClient
        .from('categorias_financieras')
        .select('id')
        .eq('legacy_uid', 'cat-ventas')
        .maybeSingle();
      cfId = cat?.id || null;
    } catch {
      // Ignorar si no existe
    }

    // 6. Create flujo_caja_movimientos record
    const movementLegacyUid = `fcm-pago-cliente-${receiptLegacyUid}`;
    const { error: fcmError } = await supabaseClient
      .from('flujo_caja_movimientos')
      .insert({
        legacy_uid: movementLegacyUid,
        fecha: payload.fechaPago,
        tipo: 'INGRESO',
        origen_operativo: 'COBRANZA',
        descripcion: payload.observaciones?.trim() || `Cobro cliente - Ref: ${payload.referencia || 'S/R'}`,
        monto: payload.monto,
        comprobante_id: receipt.id,
        estado: payload.metodoPago === 'cheque' ? 'PENDIENTE' : 'CONFIRMADO',
        metadata: {
          cliente_legacy_uid: payload.clienteId,
          metodo_pago: payload.metodoPago,
          referencia: payload.referencia || null,
        },
        categoria_id: cfId,
      });

    if (fcmError) throw fcmError;

    // 7. Create cheque in tesoreria_cheques if method is cheque
    if (payload.metodoPago === 'cheque' && payload.cheque) {
      const chequeLegacyUid = `ch-recibido-${Math.floor(Math.random() * 1000000)}`;
      const { error: chequeError } = await supabaseClient
        .from('tesoreria_cheques')
        .insert({
          legacy_uid: chequeLegacyUid,
          numero: payload.cheque.numero,
          tipo: 'RECIBIDO',
          tercero: clientName,
          importe: payload.monto,
          fecha_emision: payload.cheque.fechaEmision,
          fecha_vencimiento: payload.cheque.fechaVencimiento,
          estado: 'PENDIENTE',
          cliente_id: clienteDbId,
          cliente_nombre: clientName,
        });

      if (chequeError) throw chequeError;
    }
  },

  async getPagos(): Promise<ClientePagoHistorial[]> {
    const { data: clientsData, error: clientsError } = await supabaseClient
      .from('clientes')
      .select('id, legacy_uid, nombre')
      .is('deleted_at', null);

    if (clientsError) throw clientsError;

    const clientMapByDbId = new Map<string, { legacy_uid: string; nombre: string }>();
    const clientMapByLegacyId = new Map<string, { legacy_uid: string; nombre: string }>();
    if (clientsData) {
      clientsData.forEach((c) => {
        const info = { legacy_uid: c.legacy_uid, nombre: c.nombre };
        clientMapByDbId.set(c.id, info);
        clientMapByLegacyId.set(c.legacy_uid, info);
      });
    }

    const { data: movements, error: movementsError } = await supabaseClient
      .from('flujo_caja_movimientos')
      .select(`
        id,
        legacy_uid,
        fecha,
        tipo,
        origen_operativo,
        descripcion,
        monto,
        estado,
        metadata,
        comprobante_id,
        comprobantes (
          id,
          legacy_uid,
          numero,
          tipo,
          tercero,
          cliente_id
        )
      `)
      .eq('tipo', 'INGRESO')
      .in('origen_operativo', ['COBRANZA', 'COBRANZA_MANUAL'])
      .is('deleted_at', null)
      .order('fecha', { ascending: false });

    if (movementsError) throw movementsError;

    const pagos: ClientePagoHistorial[] = [];
    const processedUids = new Set<string>();

    if (movements) {
      movements.forEach((row: any) => {
        const uid = row.legacy_uid || row.id;
        if (processedUids.has(uid)) return;
        processedUids.add(uid);

        const metadata = (row.metadata || {}) as Record<string, any>;
        const clientLegacyIdFromMeta = metadata.cliente_legacy_uid;

        let clienteNombre = 'Cliente desconocido';
        let clienteId = '';

        if (row.comprobantes) {
          const comp = row.comprobantes;
          if (comp.cliente_id) {
            const clientInfo = clientMapByDbId.get(comp.cliente_id);
            if (clientInfo) {
              clienteNombre = clientInfo.nombre;
              clienteId = clientInfo.legacy_uid;
            }
          }
          if (!clienteId && comp.tercero) {
            clienteNombre = comp.tercero;
            const clientByName = clientsData?.find(c => c.nombre.toLowerCase() === comp.tercero.toLowerCase());
            if (clientByName) {
              clienteId = clientByName.legacy_uid;
            }
          }
        }

        if (!clienteId && clientLegacyIdFromMeta) {
          const clientInfo = clientMapByLegacyId.get(clientLegacyIdFromMeta);
          if (clientInfo) {
            clienteNombre = clientInfo.nombre;
            clienteId = clientInfo.legacy_uid;
          }
        }

        if (!clienteId) {
          // Only show client payments where the client could be resolved
          return;
        }

        pagos.push({
          id: uid,
          fecha: row.fecha,
          clienteId,
          clienteNombre,
          monto: Number(row.monto ?? 0),
          metodoPago: metadata.metodo_pago || 'efectivo',
          referencia: metadata.referencia || row.comprobantes?.numero || '',
          concepto: row.descripcion,
          estado: row.estado || 'CONFIRMADO',
          movimientoId: row.legacy_uid || row.id,
          comprobanteId: row.comprobantes?.legacy_uid || row.comprobantes?.id || undefined,
        });
      });
    }

    return pagos;
  },
};
