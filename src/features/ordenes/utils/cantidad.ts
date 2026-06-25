export const UNIDADES_CANTIDAD_ORDEN = ['kg', 'tonelada'] as const;

export type UnidadCantidadOrden = (typeof UNIDADES_CANTIDAD_ORDEN)[number];

export interface CantidadNormalizadaOrden {
  cantidadOriginal: number;
  unidad: UnidadCantidadOrden;
  cantidadKg: number;
}

const UNIT_TO_KG: Record<UnidadCantidadOrden, number> = {
  kg: 1,
  tonelada: 1000,
};

export const normalizeCantidadOrden = (cantidad: unknown, unidad: unknown): CantidadNormalizadaOrden => {
  const cantidadOriginal = Number(cantidad);
  const normalizedUnidad = String(unidad ?? '').trim().toLowerCase() as UnidadCantidadOrden;

  if (!Number.isFinite(cantidadOriginal) || cantidadOriginal <= 0) {
    throw new Error('La cantidad debe ser mayor a 0.');
  }
  if (!UNIDADES_CANTIDAD_ORDEN.includes(normalizedUnidad)) {
    throw new Error('La unidad de medida debe ser kg o tonelada.');
  }

  return {
    cantidadOriginal,
    unidad: normalizedUnidad,
    cantidadKg: Number((cantidadOriginal * UNIT_TO_KG[normalizedUnidad]).toFixed(3)),
  };
};
