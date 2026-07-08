import { supabaseClient } from '../client';

type MaybeDbError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

export interface StockLoteMpSiloCompatRow {
  silo_id?: string | null;
  ubicacion?: string | null;
  cantidad_actual?: number | string | null;
  cantidad_comprometida?: number | string | null;
}

const STOCK_LOTES_MP_SELECT_BASE = [
  'legacy_uid',
  'insumo_id',
  'lote',
  'remito_nro',
  'ubicacion',
  'cantidad_actual',
  'cantidad_inicial',
  'cantidad_comprometida',
  'costo_unitario',
  'costo_total',
  'fecha_ingreso',
  'created_at',
  'updated_at',
  'insumos(legacy_uid,nombre)',
  'proveedores(legacy_uid)',
  'usuarios(legacy_uid)',
].join(',');

export const STOCK_LOTES_MP_SELECT_WITH_SILO_ID = `silo_id,${STOCK_LOTES_MP_SELECT_BASE}`;
export const STOCK_LOTES_MP_SELECT_LEGACY = STOCK_LOTES_MP_SELECT_BASE;

let stockLotesMpHasSiloIdCache: boolean | null = null;

export const isMissingStockLotesMpSiloIdError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const dbError = error as MaybeDbError;
  const raw = [dbError.message, dbError.details, dbError.hint, dbError.code]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (!raw) return false;

  return (
    raw.includes('stock_lotes_mp.silo_id') ||
    (raw.includes('silo_id') && raw.includes('does not exist')) ||
    (raw.includes('column') && raw.includes('silo_id') && raw.includes('missing'))
  );
};

export const resetStockLotesMpSiloIdCache = () => {
  stockLotesMpHasSiloIdCache = null;
};

export const hasStockLotesMpSiloIdColumn = async (): Promise<boolean> => {
  if (stockLotesMpHasSiloIdCache !== null) return stockLotesMpHasSiloIdCache;

  const { error } = await supabaseClient
    .from('stock_lotes_mp')
    .select('silo_id')
    .limit(1);

  if (error) {
    if (isMissingStockLotesMpSiloIdError(error)) {
      stockLotesMpHasSiloIdCache = false;
      return false;
    }
    throw error;
  }

  stockLotesMpHasSiloIdCache = true;
  return true;
};

export const getStockLotesMpSelect = async () => (
  await hasStockLotesMpSiloIdColumn()
    ? STOCK_LOTES_MP_SELECT_WITH_SILO_ID
    : STOCK_LOTES_MP_SELECT_LEGACY
);
