import type { Ingrediente } from '../../formulas/types';
import type { DetalleInsumoLote } from '../types';

export interface StockLoteForFlow {
  id: string;
  legacy_uid?: string | null;
  lote: string;
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

    const lotesInsumo = lotes
      .filter((l) => l.insumo_legacy_uid === ingrediente.id_insumo)
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

export const buildFinalizationPlan = (
  ordenLegacyUid: string,
  nombreProducto: string,
  loteSalida: string,
  destinoSilo: string,
  cantidadReal: number,
  detalle: DetalleInsumoLote[],
  stockLoteIdMap: Map<string, string>
): FinalizationPlanResult => {
  const movimientos = detalle.map((item) => {
    const loteId = stockLoteIdMap.get(item.id_lote);
    if (!loteId) {
      throw new Error(`No se encontró lote físico para ${item.id_lote}.`);
    }

    return {
      lote_id: loteId,
      cantidad: item.cantidad_usada,
      observaciones: `Consumo de orden ${ordenLegacyUid}`,
      metadata: {
        orden_legacy_uid: ordenLegacyUid,
        insumo_legacy_uid: item.id_insumo,
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
