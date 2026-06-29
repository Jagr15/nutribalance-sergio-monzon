import type { StockMateriaPrima, StockMateriaPrimaResumen, StockMPEstadoResumen } from '../types/insumo';

type SourceInsumo = {
  uid: string;
  nombre?: string;
  unidad_medida?: string;
  umbral_alerta?: number | null;
  costo_por_kg?: number | null;
};

const num = (value: unknown) => Number(value ?? 0);

const getEstadoResumen = (stockDisponible: number, umbralAlerta: number): StockMPEstadoResumen => {
  if (stockDisponible <= umbralAlerta) return 'CRITICO';
  if (stockDisponible <= umbralAlerta * 2) return 'BAJO';
  return 'OK';
};

export const buildStockMPResumen = (
  lotes: StockMateriaPrima[],
  insumos: SourceInsumo[] = [],
): StockMateriaPrimaResumen[] => {
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
    const stockActual = lotesInsumo.reduce((acc, lote) => acc + num(lote.cantidad_actual), 0);
    const stockComprometido = lotesInsumo.reduce((acc, lote) => acc + num(lote.cantidad_comprometida), 0);
    const stockDisponible = lotesInsumo.reduce((acc, lote) => acc + (num(lote.cantidad_actual) - num(lote.cantidad_comprometida)), 0);
    const umbralAlerta = num(insumo.umbral_alerta);
    const valorInventario = stockActual * num(insumo.costo_por_kg);

    return {
      insumo_id: insumo.uid,
      nombre_insumo: insumo.nombre ?? 'Sin dato',
      unidad: insumo.unidad_medida ?? 'KG',
      stock_actual: stockActual,
      stock_comprometido: stockComprometido,
      stock_disponible: stockDisponible,
      umbral_alerta: umbralAlerta,
      estado: getEstadoResumen(stockDisponible, umbralAlerta),
      valor_inventario: valorInventario,
    };
  });

  const extrasDesdeLotes = [...grouped.entries()]
    .filter(([insumoId]) => !insumoById.has(insumoId))
    .map(([insumoId, lotesInsumo]) => {
      const nombreDesdeLote = lotesInsumo.find((lote) => lote.nombre_insumo?.trim())?.nombre_insumo?.trim();
      const stockActual = lotesInsumo.reduce((acc, lote) => acc + num(lote.cantidad_actual), 0);
      const stockComprometido = lotesInsumo.reduce((acc, lote) => acc + num(lote.cantidad_comprometida), 0);
      const stockDisponible = lotesInsumo.reduce((acc, lote) => acc + (num(lote.cantidad_actual) - num(lote.cantidad_comprometida)), 0);
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
        valor_inventario: 0,
      };
    });

  return [...resumenDesdeInsumos, ...extrasDesdeLotes].sort((a, b) => a.nombre_insumo.localeCompare(b.nombre_insumo));
};
