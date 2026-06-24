import type { Ingrediente } from '../../formulas/types';
import type { DetalleInsumoLote } from '../types';

export interface StockLoteForFlow {
  id: string;
  legacy_uid?: string | null;
  lote: string;
  insumo_id?: string;
  insumo_legacy_uid: string;
  insumo_nombre: string;
  fecha_ingreso: string;
  cantidad_actual: number;
  cantidad_comprometida?: number;
  costo_unitario: number;
}

export interface FifoPlanResult {
  detalle: DetalleInsumoLote[];
  stockSuficiente: boolean;
  faltantes: string[];
  costoTotal: number;
}

export interface FinalizationPlanResult {
  movimientos: Array<{ lote_id: string; cantidad: number; observaciones: string; metadata: Record<string, unknown> }>;
  stockPtPayload: {
    nombre_producto: string;
    cantidad_total: number;
    lote: string;
    unidad_medida: 'KG';
    destino_silo: string;
    detalle_insumos: unknown;
  };
  trazabilidad: Array<{ tipo: 'CONSUMO_MP' | 'PRODUCCION_FIN' | 'INGRESO_PT'; referencia: string; payload: Record<string, unknown> }>;
}

export interface FinalizationStockCheckRow {
  id_lote: string;
  nombre_insumo: string;
  lote: string;
  requerida: number;
  disponible: number;
  faltante: number;
}

export interface FinalizationStockCheckResult {
  stockSuficiente: boolean;
  totalRequerido: number;
  faltantes: FinalizationStockCheckRow[];
  mensaje: string | null;
}

export interface StockRequirementRow {
  nombre_insumo: string;
  disponible: number;
  requerida: number;
  faltante: number;
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getStockMatchesForIngredient = (ingrediente: Ingrediente, lotes: StockLoteForFlow[]) => {
  const id = ingrediente.id_insumo.trim();
  const normalizedNombreIngrediente = normalizeText(ingrediente.nombre_insumo);

  const byIds = lotes.filter((lote) =>
    lote.insumo_id === id ||
    lote.legacy_uid === id ||
    lote.insumo_legacy_uid === id
  );

  if (byIds.length > 0) return byIds;

  const byNombre = lotes.filter((lote) => {
    const loteNombre = normalizeText(lote.insumo_nombre ?? lote.lote ?? '');
    return loteNombre === normalizedNombreIngrediente;
  });

  return byNombre;
};

export const planFifoConsumption = (
  cantidadObjetivoKg: number,
  ingredientes: Ingrediente[],
  lotes: StockLoteForFlow[]
): FifoPlanResult => {
  let costoTotal = 0;
  const detalle: DetalleInsumoLote[] = [];
  const faltantes: string[] = [];

  for (const ingrediente of ingredientes) {
    const requerida = cantidadObjetivoKg * ((ingrediente.porcentaje || 0) / 100);
    let pendiente = requerida;

    const lotesInsumo = getStockMatchesForIngredient(ingrediente, lotes)
      .sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime());

    for (const lote of lotesInsumo) {
      if (pendiente <= 0) break;

      const disponible = lote.cantidad_actual - (lote.cantidad_comprometida || 0);
      if (disponible <= 0) continue;

      const usar = Math.min(disponible, pendiente);
      const costo = usar * lote.costo_unitario;

      detalle.push({
        id_lote: lote.legacy_uid || lote.lote,
        id_insumo: ingrediente.id_insumo,
        nombre_insumo: ingrediente.nombre_insumo,
        cantidad_usada: usar,
        tipo_unidad: 'KG',
        costo_unitario: lote.costo_unitario,
        costo_total: costo,
      });

      costoTotal += costo;
      pendiente -= usar;
    }

    if (pendiente > 0.01) {
      faltantes.push(ingrediente.nombre_insumo);
    }
  }

  return {
    detalle,
    stockSuficiente: faltantes.length === 0,
    faltantes,
    costoTotal,
  };
};

const findStockLote = (lotes: StockLoteForFlow[], idLote: string) => {
  const normalized = idLote.trim().toUpperCase();
  return lotes.find((current) =>
    current.id === idLote ||
    current.legacy_uid === idLote ||
    current.lote === idLote ||
    current.lote.toUpperCase() === normalized
  );
};

export const buildFinalizationPlan = (
  ordenLegacyUid: string,
  nombreProducto: string,
  loteSalida: string,
  destinoSilo: string,
  cantidadObjetivoKg: number,
  cantidadReal: number,
  detalle: DetalleInsumoLote[],
  stockLoteIdMap: Map<string, string>,
  stockLotes: StockLoteForFlow[] = []
): FinalizationPlanResult => {
  const factor = cantidadObjetivoKg > 0 ? cantidadReal / cantidadObjetivoKg : 1;
  const movimientos = detalle.map((item) => {
    const loteId = stockLoteIdMap.get(item.id_lote)
      ?? stockLoteIdMap.get(item.id_insumo)
      ?? stockLotes.find((lote) => lote.insumo_id === item.id_insumo || lote.insumo_legacy_uid === item.id_insumo)?.legacy_uid
      ?? stockLotes.find((lote) => lote.insumo_id === item.id_insumo || lote.insumo_legacy_uid === item.id_insumo)?.id
      ?? null;

    if (!loteId) {
      throw new Error(`No se encontró lote físico para ${item.id_lote}.`);
    }

    const cantidadRealMP = Number((item.cantidad_usada * factor).toFixed(3));

    return {
      lote_id: loteId,
      cantidad: cantidadRealMP,
      observaciones: `Consumo de orden ${ordenLegacyUid}`,
      metadata: {
        orden_legacy_uid: ordenLegacyUid,
        insumo_legacy_uid: item.id_insumo,
        cantidad_planificada: item.cantidad_usada,
        cantidad_real: cantidadRealMP,
        factor_aplicado: factor,
      },
    };
  });

  return {
    movimientos,
    stockPtPayload: {
      nombre_producto: nombreProducto,
      cantidad_total: cantidadReal,
      lote: loteSalida,
      unidad_medida: 'KG',
      destino_silo: destinoSilo,
      detalle_insumos: detalle,
    },
    trazabilidad: [
      {
        tipo: 'CONSUMO_MP',
        referencia: `Consumo MP de ${ordenLegacyUid}`,
        payload: { cantidad_real: cantidadReal, lotes: detalle.length },
      },
      {
        tipo: 'PRODUCCION_FIN',
        referencia: `Producción finalizada ${ordenLegacyUid}`,
        payload: { cantidad_real: cantidadReal, lote_salida: loteSalida },
      },
      {
        tipo: 'INGRESO_PT',
        referencia: `Ingreso PT de ${ordenLegacyUid}`,
        payload: { destino_silo: destinoSilo, lote_salida: loteSalida },
      },
    ],
  };
};

export const buildFinalizationStockCheck = (
  cantidadObjetivoKg: number,
  cantidadRealKg: number,
  detalle: DetalleInsumoLote[],
  lotes: StockLoteForFlow[]
): FinalizationStockCheckResult => {
  const factor = cantidadObjetivoKg > 0 ? cantidadRealKg / cantidadObjetivoKg : 0;
  const faltantes: FinalizationStockCheckRow[] = [];
  let totalRequerido = 0;

  for (const item of detalle) {
    const requerida = Number((item.cantidad_usada * factor).toFixed(3));
    totalRequerido += requerida;

    const lote = findStockLote(lotes, item.id_lote);
    const lotesDelInsumo = getStockMatchesForIngredient(
      { id_insumo: item.id_insumo, nombre_insumo: item.nombre_insumo, porcentaje: 0 },
      lotes
    );
    const lotesEvaluados = lote ? [lote] : lotesDelInsumo;

    if (lotesEvaluados.length === 0) {
      faltantes.push({
        id_lote: item.id_lote,
        nombre_insumo: item.nombre_insumo,
        lote: item.id_lote,
        requerida,
        disponible: 0,
        faltante: requerida,
      });
      continue;
    }

    const disponible = Number(
      lotesEvaluados
        .reduce((acc, current) => acc + Math.max(0, current.cantidad_actual - (current.cantidad_comprometida || 0)), 0)
        .toFixed(3)
    );
    const faltante = Number((requerida - disponible).toFixed(3));

    if (faltante > 0.0005) {
      faltantes.push({
        id_lote: item.id_lote,
        nombre_insumo: item.nombre_insumo,
        lote: lote?.lote ?? (lotesDelInsumo[0]?.lote ?? item.id_lote),
        requerida,
        disponible,
        faltante,
      });
    }
  }

  return {
    stockSuficiente: faltantes.length === 0,
    totalRequerido,
    faltantes,
    mensaje: faltantes.length > 0
      ? 'No hay stock suficiente para finalizar esta orden. Revisa materia prima disponible.'
      : null,
  };
};

export const buildStockRequirementRows = (
  cantidadObjetivoKg: number,
  ingredientes: Ingrediente[],
  lotes: StockLoteForFlow[],
): StockRequirementRow[] => {
  const rows: StockRequirementRow[] = [];

  for (const ingrediente of ingredientes) {
    const requerida = Number((cantidadObjetivoKg * ((ingrediente.porcentaje || 0) / 100)).toFixed(3));
    const disponible = Number(
      getStockMatchesForIngredient(ingrediente, lotes)
        .reduce((acc, lote) => acc + Math.max(0, lote.cantidad_actual - (lote.cantidad_comprometida || 0)), 0)
        .toFixed(3),
    );
    const faltante = Number(Math.max(0, requerida - disponible).toFixed(3));

    rows.push({
      nombre_insumo: ingrediente.nombre_insumo,
      disponible,
      requerida,
      faltante,
    });
  }

  return rows.filter((row) => row.requerida > 0 || row.disponible > 0 || row.faltante > 0);
};
