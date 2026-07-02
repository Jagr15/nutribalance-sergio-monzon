import type { StockMateriaPrima, StockMateriaPrimaResumen, StockMPEstadoResumen } from '../types/insumo';

type SourceInsumo = {
  uid: string;
  nombre?: string;
  unidad_medida?: string;
  umbral_alerta?: number | null;
  costo_por_kg?: number | null;
};

const num = (value: unknown) => Number(value ?? 0);
const normalize = (value?: string | null) => (value ?? '').trim().toLowerCase();

const buildInsumoLookups = (insumos: SourceInsumo[]) => {
  const byId = new Map<string, SourceInsumo>();
  const byName = new Map<string, SourceInsumo>();

  insumos.forEach((insumo) => {
    if (insumo.uid) {
      byId.set(normalize(insumo.uid), insumo);
    }
    const nombre = normalize(insumo.nombre);
    if (nombre && !byName.has(nombre)) {
      byName.set(nombre, insumo);
    }
  });

  return { byId, byName };
};

const resolveInsumoKey = (
  lote: StockMateriaPrima,
  lookups: ReturnType<typeof buildInsumoLookups>,
) => {
  const { byId, byName } = lookups;
  const candidates = [lote.insumo_id, lote.id_insumo, lote.nombre_insumo]
    .map((value) => normalize(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    const byCandidate = byId.get(candidate) ?? byName.get(candidate);
    if (byCandidate?.uid) {
      return byCandidate.uid;
    }
  }

  return candidates[0] ?? lote.uid;
};

const getEstadoResumen = (stockDisponible: number, umbralAlerta: number): StockMPEstadoResumen => {
  if (stockDisponible <= umbralAlerta) return 'CRITICO';
  if (stockDisponible <= umbralAlerta * 2) return 'BAJO';
  return 'OK';
};

const calculateInventoryMetrics = (lotes: StockMateriaPrima[]) => {
  const stockActual = lotes.reduce((acc, lote) => acc + num(lote.cantidad_actual), 0);
  const stockComprometido = lotes.reduce((acc, lote) => acc + num(lote.cantidad_comprometida), 0);
  const stockDisponible = lotes.reduce((acc, lote) => acc + (num(lote.cantidad_actual) - num(lote.cantidad_comprometida)), 0);
  const valorInventario = lotes.reduce((acc, lote) => acc + (num(lote.cantidad_actual) * num(lote.costo_unitario)), 0);
  const costoPromedioPonderado = stockActual > 0 ? valorInventario / stockActual : 0;
  const lotesSinCosto = lotes.filter((lote) => num(lote.costo_unitario) <= 0).length;

  return {
    stockActual,
    stockComprometido,
    stockDisponible,
    valorInventario,
    costoPromedioPonderado,
    lotesSinCosto,
  };
};

export const buildStockMPResumen = (
  lotes: StockMateriaPrima[],
  insumos: SourceInsumo[] = [],
): StockMateriaPrimaResumen[] => {
  const lookups = buildInsumoLookups(insumos);
  const insumoById = lookups.byId;
  const grouped = new Map<string, StockMateriaPrima[]>();

  lotes.forEach((lote) => {
    const insumoId = resolveInsumoKey(lote, lookups);
    const current = grouped.get(insumoId) ?? [];
    current.push(lote);
    grouped.set(insumoId, current);
  });

  const resumenDesdeInsumos = insumos.map((insumo) => {
    const lotesInsumo = grouped.get(insumo.uid) ?? grouped.get(normalize(insumo.uid)) ?? [];
    const {
      stockActual,
      stockComprometido,
      stockDisponible,
      valorInventario,
      costoPromedioPonderado,
      lotesSinCosto,
    } = calculateInventoryMetrics(lotesInsumo);
    const umbralAlerta = num(insumo.umbral_alerta);

    return {
      insumo_id: insumo.uid,
      nombre_insumo: insumo.nombre ?? 'Sin dato',
      unidad: insumo.unidad_medida ?? 'KG',
      stock_actual: stockActual,
      stock_comprometido: stockComprometido,
      stock_disponible: stockDisponible,
      umbral_alerta: umbralAlerta,
      estado: getEstadoResumen(stockDisponible, umbralAlerta),
      costo_promedio_ponderado: costoPromedioPonderado,
      valor_inventario: valorInventario,
      lotes_sin_costo: lotesSinCosto,
    };
  });

  const extrasDesdeLotes = [...grouped.entries()]
    .filter(([insumoId]) => !insumoById.has(normalize(insumoId)))
    .map(([insumoId, lotesInsumo]) => {
      const nombreDesdeLote = lotesInsumo.find((lote) => lote.nombre_insumo?.trim())?.nombre_insumo?.trim();
      const {
        stockActual,
        stockComprometido,
        stockDisponible,
        valorInventario,
        costoPromedioPonderado,
        lotesSinCosto,
      } = calculateInventoryMetrics(lotesInsumo);
      const umbralAlerta = 0;

      return {
        insumo_id: insumoId,
        nombre_insumo: nombreDesdeLote ?? 'Sin dato',
        unidad: 'KG',
        stock_actual: stockActual,
        stock_comprometido: stockComprometido,
        stock_disponible: stockDisponible,
        umbral_alerta: umbralAlerta,
        estado: getEstadoResumen(stockDisponible, umbralAlerta),
        costo_promedio_ponderado: costoPromedioPonderado,
        valor_inventario: valorInventario,
        lotes_sin_costo: lotesSinCosto,
      };
    });

  return [...resumenDesdeInsumos, ...extrasDesdeLotes].sort((a, b) => a.nombre_insumo.localeCompare(b.nombre_insumo));
};

export const resolveStockMPGroupingKey = (lote: StockMateriaPrima, insumos: SourceInsumo[] = []) => resolveInsumoKey(lote, buildInsumoLookups(insumos));
