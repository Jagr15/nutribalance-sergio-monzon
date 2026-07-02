import type {
  HistorialCompraMP,
  StockMateriaPrima,
  StockMateriaPrimaResumen,
  UltimoPrecioPagadoInsumo,
} from '../../../../features/insumos/types';
import type { StockMPCreateData } from '../../types';
import { supabaseClient } from '../client';
import { runtimeConfig } from '../../runtimeConfig';

interface StockLoteRow {
  legacy_uid: string | null;
  insumo_id: string;
  lote: string;
  remito_nro: string;
  ubicacion: string;
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

  lotes.forEach((lote) => {
    const insumoId = lote.insumo_id ?? lote.id_insumo;
    const current = grouped.get(insumoId) ?? [];
    current.push(lote);
    grouped.set(insumoId, current);
  });

  const resumenDesdeInsumos = insumos.map((insumo) => {
    const lotesInsumo = grouped.get(insumo.uid) ?? [];
    const stockActual = lotesInsumo.reduce((acc, lote) => acc + Number(lote.cantidad_actual ?? 0), 0);
    const stockComprometido = lotesInsumo.reduce((acc, lote) => acc + Number(lote.cantidad_comprometida ?? 0), 0);
    const stockDisponible = lotesInsumo.reduce((acc, lote) => acc + (Number(lote.cantidad_actual ?? 0) - Number(lote.cantidad_comprometida ?? 0)), 0);
    const valorInventario = stockActual * insumo.costo_por_kg;

    return {
      insumo_id: insumo.uid,
      nombre_insumo: insumo.nombre,
      unidad: insumo.unidad_medida,
      stock_actual: stockActual,
      stock_comprometido: stockComprometido,
      stock_disponible: stockDisponible,
      umbral_alerta: insumo.umbral_alerta,
      estado: stockDisponible <= insumo.umbral_alerta ? 'CRITICO' : stockDisponible <= insumo.umbral_alerta * 2 ? 'BAJO' : 'OK',
      valor_inventario: valorInventario,
    } satisfies StockMateriaPrimaResumen;
  });

  const extrasDesdeLotes = [...grouped.entries()]
    .filter(([insumoId]) => !insumoById.has(insumoId))
    .map(([insumoId, lotesInsumo]) => {
      const nombreDesdeLote = lotesInsumo.find((lote) => lote.nombre_insumo?.trim())?.nombre_insumo?.trim() ?? 'Sin dato';
      const stockActual = lotesInsumo.reduce((acc, lote) => acc + Number(lote.cantidad_actual ?? 0), 0);
      const stockComprometido = lotesInsumo.reduce((acc, lote) => acc + Number(lote.cantidad_comprometida ?? 0), 0);
      const stockDisponible = lotesInsumo.reduce((acc, lote) => acc + (Number(lote.cantidad_actual ?? 0) - Number(lote.cantidad_comprometida ?? 0)), 0);

      return {
        insumo_id: insumoId,
        nombre_insumo: nombreDesdeLote,
        unidad: 'KG',
        stock_actual: stockActual,
        stock_comprometido: stockComprometido,
        stock_disponible: stockDisponible,
        umbral_alerta: 0,
        estado: stockDisponible <= 0 ? 'CRITICO' : 'OK',
        valor_inventario: 0,
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
  id_usuario: row.usuarios?.legacy_uid ?? 'usr-admin-01',
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export const supabaseStockMPService = {
  async getAllLotes(): Promise<StockMateriaPrima[]> {
    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .select(
        'legacy_uid,insumo_id,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid,nombre),proveedores(legacy_uid),usuarios(legacy_uid)'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? [])
      .filter((row) => isProductionDataRow((row as unknown as StockLoteRow).legacy_uid, (row as unknown as StockLoteRow).lote))
      .map((row) => mapStock(row as unknown as StockLoteRow));
  },

  async getResumen(): Promise<StockMateriaPrimaResumen[]> {
    const [lotesResult, insumos] = await Promise.all([
      supabaseClient
        .from('stock_lotes_mp')
        .select(
          'legacy_uid,insumo_id,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid,nombre),proveedores(legacy_uid),usuarios(legacy_uid)'
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabaseClient
        .from('insumos')
        .select('legacy_uid,nombre,unidad_medida,umbral_alerta,costo_por_kg,deleted_at,esta_activo')
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
        uid: (row as { legacy_uid?: string | null }).legacy_uid ?? crypto.randomUUID(),
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

    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .insert({
        legacy_uid: `stk-${Math.random().toString(36).slice(2, 11)}`,
        insumo_id: insumo.id,
        proveedor_id: proveedor.id,
        lote: payload.lote.toUpperCase(),
        remito_nro: payload.remito_nro,
        ubicacion: payload.ubicacion,
        cantidad_inicial: payload.cantidad,
        cantidad_actual: payload.cantidad,
        cantidad_comprometida: 0,
        costo_unitario: costoUnitario,
        costo_total: costoTotal,
        fecha_ingreso: payload.fecha_ingreso.toISOString(),
        id_usuario: usuario?.id ?? null,
      })
      .select(
        'legacy_uid,insumo_id,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid,nombre),proveedores(legacy_uid),usuarios(legacy_uid)'
      )
      .single();

    if (error) throw error;
    return mapStock(data as unknown as StockLoteRow);
  },

  async update(uid: string, payload: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> {
    const rawInput: Record<string, unknown> = {
      lote: payload.lote,
      remito_nro: payload.remito_nro,
      ubicacion: payload.ubicacion,
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

    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .update(updateInput)
      .eq('legacy_uid', uid)
      .select(
        'legacy_uid,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid,nombre),proveedores(legacy_uid),usuarios(legacy_uid)'
      )
      .single();

    if (error) throw error;
    return mapStock(data as unknown as StockLoteRow);
  },

  async delete(uid: string): Promise<void> {
    const { error } = await supabaseClient
      .from('stock_lotes_mp')
      .update({ deleted_at: new Date().toISOString() })
      .eq('legacy_uid', uid);

    if (error) throw error;
  },
};
