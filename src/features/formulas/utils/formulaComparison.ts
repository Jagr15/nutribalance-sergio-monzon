import type { Formula, Ingrediente } from '../types';

export interface FormulaComparisonMetric {
  uid: string;
  nombre_producto: string;
  version: number;
  proteina_formula: number | null;
  pb_g_kg: number | null;
  costo_por_kg: number | null;
  costo_por_tonelada: number | null;
  total_ingredientes_pct: number;
  cantidad_ingredientes: number;
}

export interface FormulaComparisonIngredientRow {
  id_insumo: string;
  nombre_insumo: string;
  porcentaje_a: number;
  porcentaje_b: number;
  diferencia_pct: number;
  costo_estimado_a_kg: number | null;
  costo_estimado_b_kg: number | null;
}

export interface FormulaComparisonResult {
  formulaA: FormulaComparisonMetric;
  formulaB: FormulaComparisonMetric;
  diferencias: {
    proteina_formula: number | null;
    pb_g_kg: number | null;
    costo_por_kg: number | null;
    costo_por_tonelada: number | null;
  };
  ingredientes: FormulaComparisonIngredientRow[];
}

const round6 = (value: number) => Number(value.toFixed(6));

const getIngredientCost = (ing: Ingrediente): number | null => {
  if (ing.fuente_costo === 'SIN_COSTO') return null;
  if (typeof ing.costo_contribucion_kg === 'number' && !Number.isNaN(ing.costo_contribucion_kg)) {
    return round6(ing.costo_contribucion_kg);
  }
  if (typeof ing.costo_unitario_usado === 'number' && ing.costo_unitario_usado > 0) {
    return round6((Number(ing.porcentaje) || 0) * ing.costo_unitario_usado / 100);
  }
  return null;
};

const getFormulaProtein = (formula: Formula): number | null => {
  const hasIngredientProteinData = formula.ingredientes.some((ing) => typeof ing.aporte_proteina_pct === 'number' && !Number.isNaN(ing.aporte_proteina_pct));
  const computed = formula.ingredientes.reduce((acc, ing) => acc + (Number(ing.aporte_proteina_pct) || 0), 0);

  if (hasIngredientProteinData) {
    return round6(computed);
  }

  if (typeof formula.proteina_calculada_pct === 'number' && !Number.isNaN(formula.proteina_calculada_pct)) {
    return round6(formula.proteina_calculada_pct);
  }

  return formula.ingredientes.length > 0 ? round6(computed) : null;
};

const getFormulaCostPerKg = (formula: Formula): number | null => {
  if (typeof formula.costo_por_kg === 'number' && !Number.isNaN(formula.costo_por_kg)) {
    return round6(formula.costo_por_kg);
  }

  const ingredientCosts = formula.ingredientes
    .map((ing) => getIngredientCost(ing))
    .filter((value): value is number => typeof value === 'number');

  if (ingredientCosts.length === 0) return null;
  return round6(ingredientCosts.reduce((acc, value) => acc + value, 0));
};

const getFormulaCostPerTon = (formula: Formula, costoKg: number | null): number | null => {
  if (typeof formula.costo_por_tonelada === 'number' && !Number.isNaN(formula.costo_por_tonelada)) {
    return round6(formula.costo_por_tonelada);
  }

  return costoKg === null ? null : round6(costoKg * 1000);
};

const getFormulaSummary = (formula: Formula): FormulaComparisonMetric => {
  const totalIngredientesPct = formula.ingredientes.reduce((acc, ing) => acc + (Number(ing.porcentaje) || 0), 0);
  const proteinaFormula = getFormulaProtein(formula);
  const costoKg = getFormulaCostPerKg(formula);

  return {
    uid: formula.uid,
    nombre_producto: formula.nombre_producto,
    version: formula.version,
    proteina_formula: proteinaFormula,
    pb_g_kg: proteinaFormula === null ? null : round6(proteinaFormula * 10),
    costo_por_kg: costoKg,
    costo_por_tonelada: getFormulaCostPerTon(formula, costoKg),
    total_ingredientes_pct: round6(totalIngredientesPct),
    cantidad_ingredientes: formula.ingredientes.length,
  };
};

const diffValue = (a: number | null, b: number | null): number | null => {
  if (a === null || b === null) return null;
  return round6(b - a);
};

const toIngredientMap = (formula: Formula) => {
  const map = new Map<string, Ingrediente>();
  formula.ingredientes.forEach((ing) => {
    if (!ing.id_insumo) return;
    map.set(ing.id_insumo, ing);
  });
  return map;
};

export const compareFormulas = (formulaA: Formula, formulaB: Formula): FormulaComparisonResult => {
  const summaryA = getFormulaSummary(formulaA);
  const summaryB = getFormulaSummary(formulaB);

  const ingredientMapA = toIngredientMap(formulaA);
  const ingredientMapB = toIngredientMap(formulaB);

  const ingredientIds = [...new Set([...ingredientMapA.keys(), ...ingredientMapB.keys()])].sort((left, right) => {
    const nameLeft = ingredientMapA.get(left)?.nombre_insumo ?? ingredientMapB.get(left)?.nombre_insumo ?? left;
    const nameRight = ingredientMapA.get(right)?.nombre_insumo ?? ingredientMapB.get(right)?.nombre_insumo ?? right;
    return nameLeft.localeCompare(nameRight);
  });

  const ingredientes = ingredientIds.map((id_insumo) => {
    const ingA = ingredientMapA.get(id_insumo);
    const ingB = ingredientMapB.get(id_insumo);
    const porcentajeA = round6(Number(ingA?.porcentaje ?? 0));
    const porcentajeB = round6(Number(ingB?.porcentaje ?? 0));

    return {
      id_insumo,
      nombre_insumo: ingA?.nombre_insumo ?? ingB?.nombre_insumo ?? id_insumo,
      porcentaje_a: porcentajeA,
      porcentaje_b: porcentajeB,
      diferencia_pct: round6(porcentajeB - porcentajeA),
      costo_estimado_a_kg: ingA ? getIngredientCost(ingA) : null,
      costo_estimado_b_kg: ingB ? getIngredientCost(ingB) : null,
    };
  });

  return {
    formulaA: summaryA,
    formulaB: summaryB,
    diferencias: {
      proteina_formula: diffValue(summaryA.proteina_formula, summaryB.proteina_formula),
      pb_g_kg: diffValue(summaryA.pb_g_kg, summaryB.pb_g_kg),
      costo_por_kg: diffValue(summaryA.costo_por_kg, summaryB.costo_por_kg),
      costo_por_tonelada: diffValue(summaryA.costo_por_tonelada, summaryB.costo_por_tonelada),
    },
    ingredientes,
  };
};
