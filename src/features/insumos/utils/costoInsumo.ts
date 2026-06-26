import type { TipoUnidad } from '../../../shared/types/global.interface';

export type UnidadCostoInsumo = 'KG' | 'TON';

export interface CostoInsumoInput {
  costo?: number;
  unidad_costo?: UnidadCostoInsumo;
}

export interface CostoInsumoNormalizado {
  costo: number;
  unidad_costo: UnidadCostoInsumo;
  costo_por_kg: number;
  costo_por_tonelada: number;
}

const round6 = (value: number) => Number(value.toFixed(6));

const toKgFactor = (unidad: TipoUnidad | UnidadCostoInsumo) => (unidad === 'TON' ? 1000 : 1);

export const normalizarCostoInsumo = (input: CostoInsumoInput): CostoInsumoNormalizado | null => {
  const costo = Number(input.costo ?? 0);
  if (!Number.isFinite(costo) || costo < 0) return null;
  if (costo === 0) {
    return {
      costo: 0,
      unidad_costo: input.unidad_costo ?? 'KG',
      costo_por_kg: 0,
      costo_por_tonelada: 0,
    };
  }

  const unidad_costo = input.unidad_costo ?? 'KG';
  const factor = toKgFactor(unidad_costo);
  const costo_por_kg = round6(costo / factor);
  return {
    costo,
    unidad_costo,
    costo_por_kg,
    costo_por_tonelada: round6(costo_por_kg * 1000),
  };
};

