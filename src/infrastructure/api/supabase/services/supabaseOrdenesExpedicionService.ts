import type {
  ActualizarOrdenExpedicionPayload,
  OrdenExpedicion,
  RegistrarOrdenExpedicionPayload,
} from '../../../../features/ordenes/types';
import { normalizeCantidadOrden } from '../../../../features/ordenes/utils/cantidad';
import { buildPresentacionPersistencia, isPresentacionExpedicionKey } from '../../../../features/ordenes/utils/presentacionExpedicion';
import { supabaseClient } from '../client';

interface OrdenExpedicionRow {
  id: string;
  legacy_uid: string | null;
  numero_expedicion: string;
  stock_pt_id: string;
  producto_id: string;
  nombre_producto: string;
  lote_pt: string;
  cliente_id: string | null;
  clientes: { legacy_uid: string | null; nombre: string | null } | null;
  presentacion_key: string | null;
  presentacion: string;
  cantidad: number;
  cantidad_original: number | null;
  unidad_original: string | null;
  cantidad_kg: number | null;
  precio_unitario_venta: number | null;
  total_venta: number | null;
  moneda: string | null;
  fecha_programada: string | null;
  modo_calculo: string | null;
  empaque_id: string | null;
  tipo_empaque: string | null;
  capacidad_empaque_kg: number | null;
  cantidad_empaques: number | null;
  sobrante_kg: number | null;
  unidad_cantidad: string | null;
  estado: string;
  motivo: string | null;
  referencia: string | null;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: OrdenExpedicionRow): OrdenExpedicion => ({
  id: row.id,
  legacy_uid: row.legacy_uid ?? row.id,
  numero_expedicion: row.numero_expedicion,
  stock_pt_id: row.stock_pt_id,
  producto_id: row.producto_id,
  nombre_producto: row.nombre_producto,
  lote_pt: row.lote_pt,
  cliente_id: row.clientes?.legacy_uid ?? row.cliente_id,
  cliente_nombre: row.clientes?.nombre ?? null,
  presentacion_key: isPresentacionExpedicionKey(row.presentacion_key) ? row.presentacion_key : null,
  presentacion: row.presentacion as OrdenExpedicion['presentacion'],
  cantidad: Number(row.cantidad),
  cantidad_original: Number(row.cantidad_original ?? row.cantidad),
  unidad_original: (row.unidad_original ?? row.unidad_cantidad ?? 'kg') as string,
  unidad_cantidad: (row.unidad_cantidad as OrdenExpedicion['unidad_cantidad']) ?? 'kg',
  cantidad_kg: Number(row.cantidad_kg ?? row.cantidad),
  precio_unitario_venta: row.precio_unitario_venta == null ? null : Number(row.precio_unitario_venta),
  total_venta: row.total_venta == null ? null : Number(row.total_venta),
  moneda: row.moneda ?? 'ARS',
  fecha_programada: row.fecha_programada,
  modo_calculo: row.modo_calculo ?? 'kg_requeridos',
  empaque_id: row.empaque_id,
  tipo_empaque: row.tipo_empaque,
  capacidad_empaque_kg: row.capacidad_empaque_kg,
  cantidad_empaques: row.cantidad_empaques,
  sobrante_kg: row.sobrante_kg,
  estado: row.estado as OrdenExpedicion['estado'],
  motivo: row.motivo,
  referencia: row.referencia,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

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

const resolveStockPtDbId = async (stockPtLegacyUid: string) => {
  const { data, error } = await supabaseClient
    .from('stock_pt')
    .select('id')
    .eq('legacy_uid', stockPtLegacyUid)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
};

const formatRpcError = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') return fallback;
  const candidate = error as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [candidate.message, candidate.details, candidate.hint].filter(Boolean);
  const message = parts.join(' | ').trim();
  return message || fallback;
};

const ensureState = async (id: string, allowed: string[], nextState: string) => {
  const { data, error } = await supabaseClient
    .from('ordenes_expedicion')
    .select('estado')
    .eq('id', id)
    .maybeSingle<{ estado: string }>();
  if (error) throw error;
  const current = String(data?.estado ?? '');
  if (!allowed.includes(current)) {
    throw new Error('Transición de estado inválida.');
  }
  const { data: updatedData, error: updateError } = await supabaseClient
    .from('ordenes_expedicion')
    .update({ estado: nextState })
    .eq('id', id)
      .select('id,legacy_uid,numero_expedicion,stock_pt_id,producto_id,nombre_producto,lote_pt,cliente_id,clientes(legacy_uid,nombre),presentacion_key,presentacion,cantidad,cantidad_original,unidad_cantidad,cantidad_kg,precio_unitario_venta,total_venta,moneda,fecha_programada,estado,motivo,referencia,created_at,updated_at')
    .maybeSingle<OrdenExpedicionRow>();
  if (updateError) throw updateError;
  if (!updatedData) throw new Error('No se pudo actualizar el estado de la orden.');
  return mapRow(updatedData);
};

export const supabaseOrdenesExpedicionService = {
  async getAll(): Promise<OrdenExpedicion[]> {
    const { data, error } = await supabaseClient
      .from('ordenes_expedicion')
      .select('id,legacy_uid,numero_expedicion,stock_pt_id,producto_id,nombre_producto,lote_pt,cliente_id,clientes(legacy_uid,nombre),presentacion_key,presentacion,cantidad,cantidad_original,unidad_original,cantidad_kg,precio_unitario_venta,total_venta,moneda,modo_calculo,empaque_id,tipo_empaque,capacidad_empaque_kg,cantidad_empaques,sobrante_kg,unidad_cantidad,estado,motivo,referencia,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as unknown as OrdenExpedicionRow));
  },

  async create(payload: RegistrarOrdenExpedicionPayload): Promise<OrdenExpedicion> {
    const cantidad = normalizeCantidadOrden(payload.cantidad, payload.unidad_cantidad);
    const presentacionKey = isPresentacionExpedicionKey(payload.presentacion_key) ? payload.presentacion_key : 'GRANEL_KG';
    const persistencia = buildPresentacionPersistencia(presentacionKey, payload.cantidad_empaques ?? 0);
    const precioUnitarioVenta = Number(payload.precio_unitario_venta ?? 0);
    if (!Number.isFinite(precioUnitarioVenta) || precioUnitarioVenta <= 0) {
      throw new Error('El precio unitario de venta debe ser mayor a cero.');
    }
    const totalVenta = payload.total_venta ?? Number((cantidad.cantidadKg * precioUnitarioVenta).toFixed(2));
    const [stockPtDbId, clienteDbId] = await Promise.all([
      resolveStockPtDbId(payload.stock_pt_id),
      resolveClienteDbId(payload.cliente_id),
    ]);

    if (!stockPtDbId) {
      throw new Error('No se encontró el stock PT seleccionado.');
    }
    if (!clienteDbId) {
      throw new Error('El cliente destino es obligatorio.');
    }

    try {
      const { data, error } = await supabaseClient.rpc('registrar_orden_expedicion', {
        p_stock_pt_id: stockPtDbId,
        p_cliente_id: clienteDbId,
        p_presentacion_key: presentacionKey,
        p_presentacion: persistencia.presentacion,
        p_cantidad: cantidad.cantidadKg,
        p_cantidad_original: payload.cantidad_original ?? cantidad.cantidadOriginal,
        p_unidad_cantidad: 'kg',
        p_precio_unitario_venta: precioUnitarioVenta,
        p_total_venta: totalVenta,
        p_moneda: payload.moneda ?? 'ARS',
        p_fecha_programada: payload.fecha_programada ?? null,
        p_modo_calculo: persistencia.modo_calculo,
        p_tipo_empaque: persistencia.tipo_empaque,
        p_capacidad_empaque_kg: persistencia.capacidad_empaque_kg,
        p_cantidad_empaques: persistencia.cantidad_empaques,
        p_motivo: payload.motivo ?? null,
        p_referencia: payload.referencia ?? null,
      });

      if (error) throw error;
      const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) throw new Error('No se pudo registrar la orden de expedición.');
      return mapRow(updated as unknown as OrdenExpedicionRow);
    } catch (error) {
      const message = formatRpcError(error, 'No se pudo registrar la orden de expedición.');
      console.warn('Error RPC registrar_orden_expedicion', {
        payload: {
          ...payload,
          p_stock_pt_id: stockPtDbId,
          p_cliente_id: clienteDbId,
        },
        error,
      });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(message, { cause: error });
    }
  },

  async update(id: string, payload: ActualizarOrdenExpedicionPayload): Promise<OrdenExpedicion> {
    const cantidad = payload.cantidad !== undefined || payload.unidad_cantidad !== undefined
      ? normalizeCantidadOrden(payload.cantidad ?? 0, payload.unidad_cantidad ?? 'kg')
      : null;
    const presentacionKey = isPresentacionExpedicionKey(payload.presentacion_key) ? payload.presentacion_key : 'GRANEL_KG';
    const persistencia = buildPresentacionPersistencia(presentacionKey, payload.cantidad_empaques ?? 0);
    const precioUnitarioVenta = payload.precio_unitario_venta;
    if (precioUnitarioVenta !== undefined && (!Number.isFinite(Number(precioUnitarioVenta)) || Number(precioUnitarioVenta) <= 0)) {
      throw new Error('El precio unitario de venta debe ser mayor a cero.');
    }
    const totalVenta = payload.total_venta ?? (
      precioUnitarioVenta !== undefined && precioUnitarioVenta !== null
        ? Number(((cantidad?.cantidadKg ?? 0) * Number(precioUnitarioVenta)).toFixed(2))
        : null
    );

    const rpcPayload = {
      p_orden_id: id,
      p_presentacion_key: presentacionKey,
      p_presentacion: persistencia.presentacion,
      p_cantidad: cantidad?.cantidadKg ?? null,
      p_cantidad_original: payload.cantidad_original ?? cantidad?.cantidadOriginal ?? null,
      p_unidad_cantidad: 'kg',
      p_precio_unitario_venta: precioUnitarioVenta ?? null,
      p_total_venta: totalVenta ?? null,
      p_moneda: payload.moneda ?? 'ARS',
      p_fecha_programada: payload.fecha_programada ?? null,
      p_modo_calculo: persistencia.modo_calculo,
      p_tipo_empaque: persistencia.tipo_empaque,
      p_capacidad_empaque_kg: persistencia.capacidad_empaque_kg,
      p_cantidad_empaques: persistencia.cantidad_empaques,
      p_motivo: payload.motivo ?? null,
      p_referencia: payload.referencia ?? null,
    };
    const { data, error } = await supabaseClient.rpc('actualizar_orden_expedicion', rpcPayload);

    if (error) {
      console.error('[ordenes-salida][actualizar_orden_expedicion]', {
        payload: rpcPayload,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error,
      });
      throw new Error(error.message || 'No se pudo actualizar la orden de expedición.');
    }
    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) throw new Error('No se pudo actualizar la orden de expedición.');
    return mapRow(updated as unknown as OrdenExpedicionRow);
  },

  async iniciarPreparacion(id: string): Promise<OrdenExpedicion> {
    return ensureState(id, ['pendiente'], 'preparando');
  },

  async marcarLista(id: string): Promise<OrdenExpedicion> {
    return ensureState(id, ['preparando'], 'lista');
  },

  async despachar(id: string): Promise<OrdenExpedicion> {
    await ensureState(id, ['lista'], 'lista');
    const { data, error } = await supabaseClient.rpc('despachar_orden_expedicion', { p_orden_id: id });
    if (error) throw error;
    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) throw new Error('No se pudo despachar la orden de expedición.');
    return mapRow(updated as unknown as OrdenExpedicionRow);
  },

  async cancelar(id: string): Promise<OrdenExpedicion> {
    const { data, error } = await supabaseClient.rpc('cancelar_orden_expedicion', { p_orden_id: id });
    if (error) throw error;
    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) throw new Error('No se pudo cancelar la orden de expedición.');
    return mapRow(updated as unknown as OrdenExpedicionRow);
  },
};
