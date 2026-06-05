import type { Insumo } from '../../insumos/types';
import type { Ingrediente } from '../types';

export interface NutritionIngredientBreakdown {
  id_insumo: string;
  nombre_insumo: string;
  inclusion_pct: number;
  proteina_bruta_pct?: number;
  aporte_proteina_pct: number;
  aporte_proteina_g_kg: number;
  aporte_humedad_pct: number;
  aporte_fibra_pct: number;
  aporte_grasa_pct: number;
  aporte_cenizas_pct: number;
  warnings: string[];
}

export interface NutritionTotals {
  proteina_bruta_pct: number;
  proteina_g_kg: number;
  humedad_pct: number;
  fibra_pct: number;
  grasa_pct: number;
  cenizas_pct: number;
}

export interface NutritionCalculationResult {
  byIngredient: NutritionIngredientBreakdown[];
  totals: NutritionTotals;
  warnings: string[];
  hasMissingValues: boolean;
}

const safeNumber = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
};

export const calculateFormulaNutrition = (
  ingredientes: Ingrediente[],
  maestroInsumos: Insumo[]
): NutritionCalculationResult => {
  const warnings: string[] = [];
  const inclusionTotal = ingredientes.reduce((acc, item) => acc + safeNumber(item.porcentaje), 0);

  if (Math.abs(inclusionTotal - 100) > 0.01) {
    warnings.push(`La suma de ingredientes es ${inclusionTotal.toFixed(2)}% (debe ser 100%).`);
  }

  const byIngredient = ingredientes.map((item) => {
    const insumo = maestroInsumos.find((ins) => ins.uid === item.id_insumo);
    const localWarnings: string[] = [];

    const inclusion = safeNumber(item.porcentaje) / 100;

    const pb = insumo?.proteina_bruta_pct;
    const humedad = insumo?.humedad_pct;
    const fibra = insumo?.fibra_pct;
    const grasa = insumo?.grasa_pct;
    const cenizas = insumo?.cenizas_pct;

    if (typeof pb !== 'number') localWarnings.push(`Falta PB en ${item.nombre_insumo}`);
    if (typeof humedad !== 'number') localWarnings.push(`Falta humedad en ${item.nombre_insumo}`);
    if (typeof fibra !== 'number') localWarnings.push(`Falta fibra en ${item.nombre_insumo}`);
    if (typeof grasa !== 'number') localWarnings.push(`Falta grasa en ${item.nombre_insumo}`);
    if (typeof cenizas !== 'number') localWarnings.push(`Faltan cenizas en ${item.nombre_insumo}`);

    const aportePbPct = inclusion * safeNumber(pb);

    return {
      id_insumo: item.id_insumo,
      nombre_insumo: item.nombre_insumo,
      inclusion_pct: safeNumber(item.porcentaje),
      proteina_bruta_pct: pb,
      aporte_proteina_pct: aportePbPct,
      aporte_proteina_g_kg: aportePbPct * 10,
      aporte_humedad_pct: inclusion * safeNumber(humedad),
      aporte_fibra_pct: inclusion * safeNumber(fibra),
      aporte_grasa_pct: inclusion * safeNumber(grasa),
      aporte_cenizas_pct: inclusion * safeNumber(cenizas),
      warnings: localWarnings,
    };
  });

  byIngredient.forEach((item) => warnings.push(...item.warnings));

  const totals: NutritionTotals = {
    proteina_bruta_pct: byIngredient.reduce((acc, item) => acc + item.aporte_proteina_pct, 0),
    proteina_g_kg: byIngredient.reduce((acc, item) => acc + item.aporte_proteina_g_kg, 0),
    humedad_pct: byIngredient.reduce((acc, item) => acc + item.aporte_humedad_pct, 0),
    fibra_pct: byIngredient.reduce((acc, item) => acc + item.aporte_fibra_pct, 0),
    grasa_pct: byIngredient.reduce((acc, item) => acc + item.aporte_grasa_pct, 0),
    cenizas_pct: byIngredient.reduce((acc, item) => acc + item.aporte_cenizas_pct, 0),
  };

  return {
    byIngredient,
    totals,
    warnings,
    hasMissingValues: warnings.length > 0,
  };
};
