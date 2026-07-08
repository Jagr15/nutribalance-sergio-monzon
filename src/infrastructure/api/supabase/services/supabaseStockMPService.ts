import type {
  HistorialCompraMP,
  StockMateriaPrima,
  StockMateriaPrimaResumen,
  UltimoPrecioPagadoInsumo,
} from '../../../../features/insumos/types';
import type { StockMPCreateData } from '../../types';
import { supabaseClient } from '../client';
import { runtimeConfig } from '../../runtimeConfig';
import {
  getStockLotesMpSelect,
  hasStockLotesMpSiloIdColumn,
  isMissingStockLotesMpSiloIdError,
  STOCK_LOTES_MP_SELECT_LEGACY,
  STOCK_LOTES_MP_SELECT_WITH_SILO_ID,
} from './stockLotesMpSiloSupport';

interface StockLoteRow {
  legacy_uid: string | null;
  insumo_id: string;
  lote: string;
  remito_nro: string;
  ubicacion: string;
  silo_id: string | null;
  cantidad_actual: number;
  cantidad_inicial: number;
  cantidad_comprometida: number;
  costo_unitario: number;
  costo_total: number;
  fecha_ingreso: string;
  created_at: string;
  updated_at: string;
  insumos: { legacy_uid: string | null; nombre: string | null } | null;
  proveedores: { legacy_uid: string | null } | null;
  usuarios: { legacy_uid: string | null } | null;
}

interface SourceInsumoResumen {
  uid: string;
  nombre: string;
  unidad_medida: string;
  umbral_alerta: number;
  costo_por_kg: number;
}

interface HistorialCompraRow {
  proveedor: string;
  id_proveedor: string;
  insumo: string;
  id_insumo: string;
  fecha_compra: string;
  lote: string;
  remito_nro?: string | null;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
}

type HistorialPeriodo = 'HOY' | 'SEMANA' | 'MES' | 'TODO';
const BUSINESS_TIME_ZONE = 'America/Mexico_City';

const TEST_PREFIXES = ['demo-', 'qa-', 'test-', 'prueba-', 'sample-'];

const isTestLegacyUid = (value: string | null | undefined) => {
  const normalized = (value ?? '').trim().toLowerCase();
  return TEST_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const isProductionDataRow = (legacyUid: string | null | undefined, lote: string | null | undefined) => {
  if (runtimeConfig.mode !== 'supabase') return true;
  if (isTestLegacyUid(legacyUid)) return false;
  const normalizedLote = (lote ?? '').trim().toLowerCase();
  if (normalizedLote.startsWith('qa stock')) return false;
  if (/^(demo|test|prueba)\b/.test(normalizedLote)) return false;
  return true;
};

const getZonedDateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const zoned = getZonedDateParts(date, timeZone);
  const utcTimestamp = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return utcTimestamp - date.getTime();
};

const zonedDateTimeToUtc = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs);
};

const addDays = (year: number, month: number, day: number, delta: number) => {
  const shifted = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const getPeriodoRange = (periodo: HistorialPeriodo, now = new Date()) => {
  const zonedNow = getZonedDateParts(now, BUSINESS_TIME_ZONE);
  if (periodo === 'HOY') {
    return {
      start: zonedDateTimeToUtc(BUSINESS_TIME_ZONE, zonedNow.year, zonedNow.month, zonedNow.day, 0, 0, 0, 0),
      end: zonedDateTimeToUtc(BUSINESS_TIME_ZONE, zonedNow.year, zonedNow.month, zonedNow.day, 23, 59, 59, 999),
    };
  }
  if (periodo === 'SEMANA') {
    const dayOfWeek = new Date(Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day)).getUTCDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const startDay = addDays(zonedNow.year, zonedNow.month, zonedNow.day, -mondayOffset);
    const endDay = addDays(startDay.year, startDay.month, startDay.day, 6);
    return {
      start: zonedDateTimeToUtc(BUSINESS_TIME_ZONE, startDay.year, startDay.month, startDay.day, 0, 0, 0, 0),
      end: zonedDateTimeToUtc(BUSINESS_TIME_ZONE, endDay.year, endDay.month, endDay.day, 23, 59, 59, 999),
    };
  }
  if (periodo === 'MES') {
    const startDay = { year: zonedNow.year, month: zonedNow.month, day: 1 };
    const endOfMonth = new Date(Date.UTC(zonedNow.year, zonedNow.month, 0));
    return {
      start: zonedDateTimeToUtc(BUSINESS_TIME_ZONE, startDay.year, startDay.month, startDay.day, 0, 0, 0, 0),
      end: zonedDateTimeToUtc(BUSINESS_TIME_ZONE, endOfMonth.getUTCFullYear(), endOfMonth.getUTCMonth() + 1, endOfMonth.getUTCDate(), 23, 59, 59, 999),
    };
  }
  return null;
};

const mapHistorial = (rows: HistorialCompraRow[]): HistorialCompraMP[] => rows.map((row) => ({
  proveedor: row.proveedor,
  id_proveedor: row.id_proveedor,
  insumo: row.insumo,
  id_insumo: row.id_insumo,
  fecha_compra: row.fecha_compra,
  lote: row.lote,
  remito_nro: row.remito_nro ?? undefined,
  cantidad: Number(row.cantidad),
  costo_unitario: Number(row.costo_unitario),
  costo_total: Number(row.costo_total),
}));

const buildResumenFromSources = (lotes: StockMateriaPrima[], insumos: SourceInsumoResumen[]): StockMateriaPrimaResumen[] => {
  const insumoById = new Map(insumos.map((item) => [item.uid, item]));
  const grouped = new Map<string, StockMateriaPrima[]>();

  const calculateInventoryMetrics = (items: StockMateriaPrima[]) => {
    const stockActual = items.reduce((acc, lote) => acc + Number(lote.cantidad_actual ?? 0), 0);
    const stockComprometido = items.reduce((acc, lote) => acc + Number(lote.cantidad_comprometida ?? 0), 0);
    const stockDisponible = items.reduce((acc, lote) => acc + (Number(lote.cantidad_actual ?? 0) - Number(lote.cantidad_comprometida ?? 0)), 0);
    const valorInventario = items.reduce((acc, lote) => acc + (Number(lote.cantidad_actual ?? 0) * Number(lote.costo_unitario ?? 0)), 0);
    const costoPromedioPonderado = stockActual > 0 ? valorInventario / stockActual : 0;
    const lotesSinCosto = items.filter((lote) => Number(lote.costo_unitario ?? 0) <= 0).length;

    return {
      stockActual,
      stockComprometido,
      stockDisponible,
      valorInventario,
      costoPromedioPonderado,
      lotesSinCosto,
    };
  };

  lotes.forEach((lote) => {
    const insumoId = lote.insumo_id ?? lote.id_insumo;
    const current = grouped.get(insumoId) ?? [];
    current.push(lote);
    grouped.set(insumoId, current);
  });

  const resumenDesdeInsumos = insumos.map((insumo) => {
    const lotesInsumo = grouped.get(insumo.uid) ?? [];
    const {
      stockActual,
      stockComprometido,
      stockDisponible,
      valorInventario,
      costoPromedioPonderado,
      lotesSinCosto,
    } = calculateInventoryMetrics(lotesInsumo);

    return {
      insumo_id: insumo.uid,
      nombre_insumo: insumo.nombre,
      unidad: insumo.unidad_medida,
      stock_actual: stockActual,
      stock_comprometido: stockComprometido,
      stock_disponible: stockDisponible,
      umbral_alerta: insumo.umbral_alerta,
      estado: stockDisponible <= insumo.umbral_alerta ? 'CRITICO' : stockDisponible <= insumo.umbral_alerta * 2 ? 'BAJO' : 'OK',
      costo_promedio_ponderado: costoPromedioPonderado,
      valor_inventario: valorInventario,
      lotes_sin_costo: lotesSinCosto,
    } satisfies StockMateriaPrimaResumen;
  });

  const extrasDesdeLotes = [...grouped.entries()]
    .filter(([insumoId]) => !insumoById.has(insumoId))
    .map(([insumoId, lotesInsumo]) => {
      const nombreDesdeLote = lotesInsumo.find((lote) => lote.nombre_insumo?.trim())?.nombre_insumo?.trim() ?? 'Sin dato';
      const {
        stockActual,
        stockComprometido,
        stockDisponible,
        valorInventario,
        costoPromedioPonderado,
        lotesSinCosto,
      } = calculateInventoryMetrics(lotesInsumo);

      return {
        insumo_id: insumoId,
        nombre_insumo: nombreDesdeLote,
        unidad: 'KG',
        stock_actual: stockActual,
        stock_comprometido: stockComprometido,
        stock_disponible: stockDisponible,
        umbral_alerta: 0,
        estado: stockDisponible <= 0 ? 'CRITICO' : 'OK',
        costo_promedio_ponderado: costoPromedioPonderado,
        valor_inventario: valorInventario,
        lotes_sin_costo: lotesSinCosto,
      } satisfies StockMateriaPrimaResumen;
    });

  return [...resumenDesdeInsumos, ...extrasDesdeLotes].sort((a, b) => a.nombre_insumo.localeCompare(b.nombre_insumo));
};

interface UltimoPrecioRow {
  insumo: string;
  id_insumo: string;
  ultimo_proveedor: string;
  id_proveedor: string;
  fecha_ultima_compra: string;
  ultimo_precio: number;
  precio_compra_anterior: number | null;
  variacion_absoluta: number | null;
  variacion_pct: number | null;
}

const mapStock = (row: StockLoteRow): StockMateriaPrima => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  insumo_id: row.insumo_id,
  id_insumo: row.insumos?.legacy_uid ?? '',
  nombre_insumo: row.insumos?.nombre ?? undefined,
  id_proveedor: row.proveedores?.legacy_uid ?? '',
  lote: row.lote,
  cantidad_actual: Number(row.cantidad_actual),
  cantidad_inicial: Number(row.cantidad_inicial),
  cantidad_comprometida: Number(row.cantidad_comprometida),
  costo_unitario: Number(row.costo_unitario),
  costo_total: Number(row.costo_total),
  fecha_ingreso: new Date(row.fecha_ingreso),
  remito_nro: row.remito_nro,
  ubicacion: row.ubicacion,
  silo_id: row.silo_id ?? undefined,
  id_usuario: row.usuarios?.legacy_uid ?? 'usr-admin-01',
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const runStockLotesMpSelect = async () => {
  const select = await getStockLotesMpSelect();
  const result = await supabaseClient
    .from('stock_lotes_mp')
    .select(select)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (result.error && select === STOCK_LOTES_MP_SELECT_WITH_SILO_ID && isMissingStockLotesMpSiloIdError(result.error)) {
    return supabaseClient
      .from('stock_lotes_mp')
      .select(STOCK_LOTES_MP_SELECT_LEGACY)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
  }

  return result;
};

export const supabaseStockMPService = {
  async getAllLotes(): Promise<StockMateriaPrima[]> {
    const { data, error } = await runStockLotesMpSelect();

    if (error) throw error;
    return (data ?? [])
      .filter((row) => isProductionDataRow((row as unknown as StockLoteRow).legacy_uid, (row as unknown as StockLoteRow).lote))
      .map((row) => mapStock(row as unknown as StockLoteRow));
  },

  async getResumen(): Promise<StockMateriaPrimaResumen[]> {
    const [lotesResult, insumos] = await Promise.all([
      runStockLotesMpSelect(),
      supabaseClient
        .from('insumos')
        .select('id,legacy_uid,nombre,unidad_medida,umbral_alerta,costo_por_kg,deleted_at,esta_activo')
        .is('deleted_at', null)
        .eq('esta_activo', true)
        .order('nombre', { ascending: true }),
    ]);

    if (lotesResult.error) throw lotesResult.error;
    if (insumos.error) throw insumos.error;

    const lotes = (lotesResult.data ?? [])
      .filter((row) => isProductionDataRow((row as unknown as StockLoteRow).legacy_uid, (row as unknown as StockLoteRow).lote))
      .map((row) => mapStock(row as unknown as StockLoteRow));

    const sourceInsumos = (insumos.data ?? [])
      .filter((row) => isProductionDataRow((row as { legacy_uid?: string | null }).legacy_uid, (row as { nombre?: string | null }).nombre))
      .map((row) => ({
        uid: (row as { id?: string | null }).id ?? crypto.randomUUID(),
        nombre: (row as { nombre?: string | null }).nombre ?? 'Sin dato',
        unidad_medida: (row as { unidad_medida?: string | null }).unidad_medida ?? 'KG',
        umbral_alerta: Number((row as { umbral_alerta?: number | null }).umbral_alerta ?? 0),
        costo_por_kg: Number((row as { costo_por_kg?: number | null }).costo_por_kg ?? 0),
      }));

    return buildResumenFromSources(lotes, sourceInsumos);
  },

  async getHistorialCompras(params: { periodo?: HistorialPeriodo; page?: number; pageSize?: number } = {}): Promise<{ data: HistorialCompraMP[]; total: number }> {
    const page = Math.max(1, Number(params.page ?? 1));
    const pageSize = Math.max(1, Number(params.pageSize ?? 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const periodo = params.periodo ?? 'HOY';
    const range = getPeriodoRange(periodo);

    let query = supabaseClient
      .from('historial_compras_mp')
      .select('proveedor,id_proveedor,insumo,id_insumo,fecha_compra,lote,remito_nro,cantidad,costo_unitario,costo_total', { count: 'exact' })
      .order('fecha_compra', { ascending: false })
      .order('lote', { ascending: false });

    if (range) {
      query = query
        .gte('fecha_compra', range.start.toISOString())
        .lte('fecha_compra', range.end.toISOString());
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    return {
      data: mapHistorial((data ?? []) as HistorialCompraRow[])
        .filter((row) => isProductionDataRow(null, row.lote)),
      total: count ?? 0,
    };
  },

  async getUltimosPrecios(): Promise<UltimoPrecioPagadoInsumo[]> {
    const { data, error } = await supabaseClient
      .from('ultimo_precio_pagado_insumo')
      .select('insumo,id_insumo,ultimo_proveedor,id_proveedor,fecha_ultima_compra,ultimo_precio,precio_compra_anterior,variacion_absoluta,variacion_pct')
      .order('fecha_ultima_compra', { ascending: false })
      .order('insumo', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const precio = row as unknown as UltimoPrecioRow;
      return {
        insumo: precio.insumo,
        id_insumo: precio.id_insumo,
        ultimo_proveedor: precio.ultimo_proveedor,
        id_proveedor: precio.id_proveedor,
        fecha_ultima_compra: precio.fecha_ultima_compra,
        ultimo_precio: Number(precio.ultimo_precio),
        precio_compra_anterior: precio.precio_compra_anterior === null ? null : Number(precio.precio_compra_anterior),
        variacion_absoluta: precio.variacion_absoluta === null ? null : Number(precio.variacion_absoluta),
        variacion_pct: precio.variacion_pct === null ? null : Number(precio.variacion_pct),
      };
    });
  },

  async create(payload: StockMPCreateData): Promise<StockMateriaPrima> {
    const costoUnitario = Number(payload.costo_unitario ?? 0);
    const costoTotal = Number(payload.costo_total ?? 0);

    const { data: insumo, error: insumoError } = await supabaseClient
      .from('insumos')
      .select('id')
      .eq('legacy_uid', payload.id_insumo)
      .single<{ id: string }>();
    if (insumoError) throw insumoError;

    const { data: proveedor, error: proveedorError } = await supabaseClient
      .from('proveedores')
      .select('id')
      .eq('legacy_uid', payload.id_proveedor)
      .single<{ id: string }>();
    if (proveedorError) throw proveedorError;

    const { data: usuario, error: usuarioError } = await supabaseClient
      .from('usuarios')
      .select('id')
      .eq('legacy_uid', payload.id_usuario)
      .maybeSingle<{ id: string }>();
    if (usuarioError) throw usuarioError;

    let siloId: string | null = null;
    if (payload.silo_id || payload.ubicacion) {
      const query = supabaseClient.from('silos').select('id');
      const { data: sData } = payload.silo_id
        ? await query.eq('id', payload.silo_id).maybeSingle()
        : await query.eq('nombre', payload.ubicacion).maybeSingle();
      if (sData) siloId = sData.id;
    }

    const legacyUid = `stk-${Math.random().toString(36).slice(2, 11)}`;
    const supportsSiloId = await hasStockLotesMpSiloIdColumn();
    const insertPayload = {
      legacy_uid: legacyUid,
      insumo_id: insumo.id,
      proveedor_id: proveedor.id,
      lote: payload.lote.toUpperCase(),
      remito_nro: payload.remito_nro,
      ubicacion: payload.ubicacion,
      ...(supportsSiloId ? { silo_id: siloId } : {}),
      cantidad_inicial: payload.cantidad,
      cantidad_actual: payload.cantidad,
      cantidad_comprometida: 0,
      costo_unitario: costoUnitario,
      costo_total: costoTotal,
      fecha_ingreso: payload.fecha_ingreso.toISOString(),
      id_usuario: usuario?.id ?? null,
    };

    const { error } = await supabaseClient
      .from('stock_lotes_mp')
      .insert(insertPayload);

    if (error) {
      if (supportsSiloId || !isMissingStockLotesMpSiloIdError(error)) throw error;
      const { error: legacyError } = await supabaseClient
        .from('stock_lotes_mp')
        .insert({
          ...insertPayload,
          silo_id: undefined,
        });
      if (legacyError) throw legacyError;
    }

    const rows = await this.getAllLotes();
    const created = rows.find((row) => row.uid === legacyUid);
    if (!created) throw new Error('No se pudo recuperar el lote creado.');
    return created;
  },

  async update(uid: string, payload: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> {
    const rawInput: Record<string, unknown> = {
      lote: payload.lote,
      remito_nro: payload.remito_nro,
      ubicacion: payload.ubicacion,
      silo_id: payload.silo_id,
      cantidad_inicial: payload.cantidad_inicial,
      cantidad_actual: payload.cantidad_actual,
      cantidad_comprometida: payload.cantidad_comprometida,
      costo_unitario: payload.costo_unitario,
      costo_total: payload.costo_total,
      fecha_ingreso: payload.fecha_ingreso?.toISOString(),
    };
    const updateInput = Object.fromEntries(
      Object.entries(rawInput).filter(([, value]) => value !== undefined)
    );

    const supportsSiloId = await hasStockLotesMpSiloIdColumn();
    const { silo_id: maybeSiloId, ...legacyUpdateInput } = updateInput;
    const persistedUpdateInput = supportsSiloId ? updateInput : legacyUpdateInput;

    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .update(persistedUpdateInput)
      .eq('legacy_uid', uid)
      .select(await getStockLotesMpSelect())
      .single();

    if (error) {
      if (supportsSiloId || !isMissingStockLotesMpSiloIdError(error)) throw error;
      const legacyResult = await supabaseClient
        .from('stock_lotes_mp')
        .update(legacyUpdateInput)
        .eq('legacy_uid', uid)
        .select(STOCK_LOTES_MP_SELECT_LEGACY)
        .single();
      if (legacyResult.error) throw legacyResult.error;
      return mapStock(legacyResult.data as unknown as StockLoteRow);
    }
    return mapStock(data as unknown as StockLoteRow);
  },

  async delete(uid: string): Promise<void> {
    const { data: lot, error: lotErr } = await supabaseClient
      .from('stock_lotes_mp')
      .select('id, cantidad_actual, cantidad_inicial, cantidad_comprometida')
      .eq('legacy_uid', uid)
      .maybeSingle<{ id: string, cantidad_actual: number, cantidad_inicial: number, cantidad_comprometida: number }>();

    if (lotErr) throw lotErr;
    if (!lot) throw new Error('Lote no encontrado');

    const isModified = Number(lot.cantidad_actual) !== Number(lot.cantidad_inicial) || Number(lot.cantidad_comprometida) > 0;

    // Check if lot is used in any production orders
    const { count: consumoCount, error: consumoErr } = await supabaseClient
      .from('orden_consumo_lotes')
      .select('id', { count: 'exact', head: true })
      .eq('lote_id', lot.id);
    if (consumoErr) throw consumoErr;

    // Check if lot is associated with a CONFIRMED financial entry
    const { count: finCount, error: finErr } = await supabaseClient
      .from('flujo_caja_movimientos')
      .select('id', { count: 'exact', head: true })
      .eq('stock_lote_mp_id', lot.id)
      .eq('estado', 'CONFIRMADO');
    if (finErr) throw finErr;

    if (isModified || (consumoCount ?? 0) > 0 || (finCount ?? 0) > 0) {
      throw new Error('No se puede eliminar el lote porque tiene consumos de stock o transacciones financieras confirmadas asociadas.');
    }

    // Soft delete the lot
    const { error: deleteErr } = await supabaseClient
      .from('stock_lotes_mp')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', lot.id);
    if (deleteErr) throw deleteErr;

    // Soft delete corresponding pending cashflow movements
    const { error: finUpdateErr } = await supabaseClient
      .from('flujo_caja_movimientos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('stock_lote_mp_id', lot.id)
      .eq('estado', 'PENDIENTE');
    if (finUpdateErr) throw finUpdateErr;
  },
};
