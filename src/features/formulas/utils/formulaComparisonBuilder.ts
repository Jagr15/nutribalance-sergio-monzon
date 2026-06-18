import type { Formula, Ingrediente } from '../types';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import { calculateFormulaNutrition } from './nutritionCalculator';
import { calculateFormulaCost } from './costCalculator';
import { compareFormulas, type FormulaComparisonResult } from './formulaComparison';

export interface FormulaDraftState {
  id: string;
  nombre_producto: string;
  esta_activa: boolean;
  ingredientes: Ingrediente[];
}

export interface FormulaDraftEnvironment {
  maestroInsumos: Insumo[];
  maestroStock: StockMateriaPrima[];
  currentUser: {
    id: string;
    name: string;
  };
}

const now = () => new Date();

const normalizeIngredient = (ingredient: Ingrediente, maestroInsumos: Insumo[]) => {
  const selected = maestroInsumos.find((item) => item.uid === ingredient.id_insumo);
  return {
    ...ingredient,
    nombre_insumo: ingredient.nombre_insumo || selected?.nombre || '',
  };
};

export const createEmptyFormulaDraft = (id: string, suffix: string): FormulaDraftState => ({
  id,
  nombre_producto: `Alternativa ${suffix}`,
  esta_activa: true,
  ingredientes: [
    { id_insumo: '', nombre_insumo: '', porcentaje: 0 },
  ],
});

export const getValidDraftIngredients = (draft: FormulaDraftState): Ingrediente[] => {
  return draft.ingredientes
    .filter((ingredient) => Boolean(ingredient.id_insumo))
    .map((ingredient) => ({ ...ingredient }));
};

export const buildFormulaDraftSnapshot = (
  draft: FormulaDraftState,
  environment: FormulaDraftEnvironment,
  tempUid?: string
): Formula => {
  const timestamp = now();
  const ingredientes = getValidDraftIngredients(draft).map((ingredient) => normalizeIngredient(ingredient, environment.maestroInsumos));
  const nutrition = calculateFormulaNutrition(ingredientes, environment.maestroInsumos);
  const cost = calculateFormulaCost(ingredientes, environment.maestroStock, environment.maestroInsumos);

  const enrichedIngredients = ingredientes.map((ingredient) => {
    const nutritionItem = nutrition.byIngredient.find((item) => item.id_insumo === ingredient.id_insumo);
    const costItem = cost.byIngredient.find((item) => item.id_insumo === ingredient.id_insumo);

    return {
      ...ingredient,
      aporte_proteina_pct: nutritionItem?.aporte_proteina_pct,
      aporte_proteina_g_kg: nutritionItem?.aporte_proteina_g_kg,
      costo_unitario_usado: costItem?.costo_unitario_usado,
      costo_contribucion_kg: costItem?.costo_contribucion_kg,
      fuente_costo: costItem?.fuente_costo,
    };
  });

  return {
    uid: tempUid ?? `draft-${draft.id}`,
    nombre_producto: draft.nombre_producto.trim() || 'Nueva Fórmula',
    ingredientes: enrichedIngredients,
    version: 0,
    esta_activa: draft.esta_activa,
    ultima_edicion: timestamp,
    id_usuario: environment.currentUser.id,
    author: environment.currentUser.name,
    createdAt: timestamp,
    proteina_calculada_pct: nutrition.totals.proteina_bruta_pct,
    costo_total: cost.costo_total_formula,
    costo_por_kg: cost.costo_por_kg,
    costo_por_tonelada: cost.costo_por_tonelada,
    advertencias_nutricionales: nutrition.warnings,
    advertencias_costos: cost.warnings,
  };
};

export const buildFormulaCreatePayloadFromDraft = (
  draft: FormulaDraftState,
  environment: FormulaDraftEnvironment
): Omit<Formula, 'uid' | 'ultima_edicion'> => {
  const snapshot = buildFormulaDraftSnapshot(draft, environment, `draft-${draft.id}`);

  return {
    nombre_producto: snapshot.nombre_producto.toUpperCase(),
    ingredientes: snapshot.ingredientes,
    version: 1,
    esta_activa: snapshot.esta_activa,
    id_usuario: environment.currentUser.id,
    author: environment.currentUser.name,
    createdAt: snapshot.createdAt,
    proteina_calculada_pct: snapshot.proteina_calculada_pct,
    costo_total: snapshot.costo_total,
    costo_por_kg: snapshot.costo_por_kg,
    costo_por_tonelada: snapshot.costo_por_tonelada,
    advertencias_nutricionales: snapshot.advertencias_nutricionales,
    advertencias_costos: snapshot.advertencias_costos,
  };
};

export const compareFormulaDrafts = (
  draftA: FormulaDraftState,
  draftB: FormulaDraftState,
  environment: FormulaDraftEnvironment
): FormulaComparisonResult => {
  const formulaA = buildFormulaDraftSnapshot(draftA, environment, 'draft-a');
  const formulaB = buildFormulaDraftSnapshot(draftB, environment, 'draft-b');
  return compareFormulas(formulaA, formulaB);
};
