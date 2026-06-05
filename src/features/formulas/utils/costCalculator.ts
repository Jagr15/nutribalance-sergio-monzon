import type { Ingrediente } from '../types';
import type { StockMateriaPrima, Insumo } from '../../insumos/types';

export interface FormulaCostIngredientBreakdown {
  id_insumo: string;
  nombre_insumo: string;
  inclusion_pct: number;
  inclusion_kg_per_kg: number;
  inclusion_kg_per_ton: number;
  costo_unitario_usado: number;
  fuente_costo: 'ULTIMO_LOTE' | 'REFERENCIA' | 'SIN_COSTO';
  costo_contribucion_kg: number;
  costo_contribucion_ton: number;
  warnings: string[];
}

export interface FormulaCostResult {
  byIngredient: FormulaCostIngredientBreakdown[];
  costo_total_formula: number;
  costo_por_kg: number;
  costo_por_tonelada: number;
  warnings: string[];
  hasMissingCosts: boolean;
}

const resolveIngredientCost = (
  ingrediente: Ingrediente,
  maestroStock: StockMateriaPrima[],
  maestroInsumos: Insumo[]
): Pick<FormulaCostIngredientBreakdown, 'costo_unitario_usado' | 'fuente_costo' | 'warnings'> => {
  const warnings: string[] = [];

  const lotesInsumo = maestroStock
    .filter((lote) => lote.id_insumo === ingrediente.id_insumo)
    .sort((a, b) => new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime());

  if (lotesInsumo.length > 0 && typeof lotesInsumo[0].costo_unitario === 'number' && lotesInsumo[0].costo_unitario > 0) {
    return {
      costo_unitario_usado: lotesInsumo[0].costo_unitario,
      fuente_costo: 'ULTIMO_LOTE',
      warnings,
    };
  }

  const insumo = maestroInsumos.find((item) => item.uid === ingrediente.id_insumo);
  if (typeof insumo?.ref_costo_unitario === 'number' && insumo.ref_costo_unitario > 0) {
    warnings.push(`Sin lote reciente para ${ingrediente.nombre_insumo}; se usa costo de referencia.`);
    return {
      costo_unitario_usado: insumo.ref_costo_unitario,
      fuente_costo: 'REFERENCIA',
      warnings,
    };
  }

  warnings.push(`Sin costo disponible para ${ingrediente.nombre_insumo}.`);
  return {
    costo_unitario_usado: 0,
    fuente_costo: 'SIN_COSTO',
    warnings,
  };
};

export const calculateFormulaCost = (
  ingredientes: Ingrediente[],
  maestroStock: StockMateriaPrima[],
  maestroInsumos: Insumo[]
): FormulaCostResult => {
  const allWarnings: string[] = [];

  const byIngredient = ingredientes.map((item) => {
    const inclusionKgPerKg = (Number(item.porcentaje) || 0) / 100;
    const inclusionKgPerTon = inclusionKgPerKg * 1000;

    const resolved = resolveIngredientCost(item, maestroStock, maestroInsumos);

    const costoContribucionKg = inclusionKgPerKg * resolved.costo_unitario_usado;
    const costoContribucionTon = inclusionKgPerTon * resolved.costo_unitario_usado;

    allWarnings.push(...resolved.warnings);

    return {
      id_insumo: item.id_insumo,
      nombre_insumo: item.nombre_insumo,
      inclusion_pct: Number(item.porcentaje) || 0,
      inclusion_kg_per_kg: inclusionKgPerKg,
      inclusion_kg_per_ton: inclusionKgPerTon,
      costo_unitario_usado: resolved.costo_unitario_usado,
      fuente_costo: resolved.fuente_costo,
      costo_contribucion_kg: costoContribucionKg,
      costo_contribucion_ton: costoContribucionTon,
      warnings: resolved.warnings,
    };
  });

  const costoPorKg = byIngredient.reduce((acc, item) => acc + item.costo_contribucion_kg, 0);
  const costoPorTonelada = byIngredient.reduce((acc, item) => acc + item.costo_contribucion_ton, 0);

  return {
    byIngredient,
    costo_total_formula: costoPorTonelada,
    costo_por_kg: costoPorKg,
    costo_por_tonelada: costoPorTonelada,
    warnings: allWarnings,
    hasMissingCosts: byIngredient.some((item) => item.fuente_costo === 'SIN_COSTO'),
  };
};
