// src/infrastructure/api/mocks/mockFormulaService.ts
import type { Formula } from '../../../../features/formulas/types';
import formulasData from '../data/formulas.json';
import insumosData from '../data/insumos.json';
import stockData from '../data/stockMateriaPrima.json';
import { mockApiCall } from '../mockClient';
import { calculateFormulaNutrition } from '../../../../features/formulas/utils/nutritionCalculator';
import { calculateFormulaCost } from '../../../../features/formulas/utils/costCalculator';
import type { Insumo, StockMateriaPrima } from '../../../../features/insumos/types/insumo';

type FormulaRaw = Omit<Formula, 'ultima_edicion'> & { ultima_edicion: string };
type FormulaEnriched = Formula & {
  proteina_calculada_pct?: number;
  costo_total?: number;
  costo_por_kg?: number;
  costo_por_tonelada?: number;
  advertencias_nutricionales?: string[];
  advertencias_costos?: string[];
};

const maestroInsumos: Insumo[] = insumosData as unknown as Insumo[];
const maestroStock: StockMateriaPrima[] = stockData as unknown as StockMateriaPrima[];

const withSnapshots = (formula: Formula): FormulaEnriched => {
  const nutrition = calculateFormulaNutrition(formula.ingredientes, maestroInsumos);
  const cost = calculateFormulaCost(formula.ingredientes, maestroStock, maestroInsumos);

  const byNutritionId = new Map(nutrition.byIngredient.map((item) => [item.id_insumo, item]));
  const byCostId = new Map(cost.byIngredient.map((item) => [item.id_insumo, item]));

  return {
    ...formula,
    ingredientes: formula.ingredientes.map((ing) => {
      const n = byNutritionId.get(ing.id_insumo);
      const c = byCostId.get(ing.id_insumo);
      return {
        ...ing,
        aporte_proteina_pct: n?.aporte_proteina_pct ?? ing.aporte_proteina_pct,
        aporte_proteina_g_kg: n?.aporte_proteina_g_kg ?? ing.aporte_proteina_g_kg,
        costo_unitario_usado: c?.costo_unitario_usado ?? ing.costo_unitario_usado,
        costo_contribucion_kg: c?.costo_contribucion_kg ?? ing.costo_contribucion_kg,
        fuente_costo: c?.fuente_costo ?? ing.fuente_costo,
      };
    }),
    proteina_calculada_pct: nutrition.totals.proteina_bruta_pct,
    costo_total: cost.costo_total_formula,
    costo_por_kg: cost.costo_por_kg,
    costo_por_tonelada: cost.costo_por_tonelada,
    advertencias_nutricionales: nutrition.warnings,
    advertencias_costos: cost.warnings,
  };
};

// Mapeo inicial para asegurar que las fechas sean objetos Date
let mockFormulas: Formula[] = (formulasData as unknown as FormulaRaw[]).map((f) => withSnapshots({
  ...f,
  ultima_edicion: new Date(f.ultima_edicion)
}));

export const mockFormulaService = {
  // Obtener todas las recetas
  findAll: async (): Promise<Formula[]> => {
    return mockApiCall([...mockFormulas]);
  },

  // Obtener una receta específica
  getById: async (uid: string): Promise<Formula | undefined> => {
    const formula = mockFormulas.find((f) => f.uid === uid);
    return mockApiCall(formula);
  },

  // Crear una nueva fórmula con VALIDACIÓN DE NEGOCIO
  create: async (data: Omit<Formula, 'uid' | 'ultima_edicion'>): Promise<Formula> => {
    if (!data.nombre_producto?.trim()) {
      throw new Error('El nombre del producto es obligatorio.');
    }
    if (!data.ingredientes?.length) {
      throw new Error('Debe incluir al menos un ingrediente.');
    }
    if (data.ingredientes.some((ing) => !ing.id_insumo)) {
      throw new Error('Todos los ingredientes deben tener insumo.');
    }
    if (data.ingredientes.some((ing) => ing.porcentaje <= 0)) {
      throw new Error('Todos los porcentajes deben ser mayores a 0.');
    }
    const ids = data.ingredientes.map((ing) => ing.id_insumo);
    if (new Set(ids).size !== ids.length) {
      throw new Error('No se permiten ingredientes duplicados.');
    }

    // REGLA DE ORO: Validación del 100%
    const sumaTotal = data.ingredientes.reduce((acc, ing) => acc + ing.porcentaje, 0);
    
    // Usamos un margen de error mínimo por decimales (ej. 99.999 es válido como 100)
    if (Math.abs(sumaTotal - 100) > 0.01) {
      throw new Error(`La fórmula no suma 100% (Suma actual: ${sumaTotal.toFixed(2)}%).`);
    }

    const newFormula: Formula = {
      ...data,
      uid: `for-${Math.floor(Math.random() * 10000)}`,
      esta_activa: true,
      ultima_edicion: new Date()
    };

    const enriched = withSnapshots(newFormula);
    mockFormulas = [enriched, ...mockFormulas];
    return mockApiCall(enriched);
  },

  // Actualizar datos de la receta
  update: async (uid: string, data: Partial<Formula>): Promise<Formula> => {
    // Si se actualizan ingredientes, validamos el 100% nuevamente
    if (data.ingredientes) {
      if (data.ingredientes.some((ing) => !ing.id_insumo)) {
        throw new Error('Todos los ingredientes deben tener insumo.');
      }
      if (data.ingredientes.some((ing) => ing.porcentaje <= 0)) {
        throw new Error('Todos los porcentajes deben ser mayores a 0.');
      }
      const ids = data.ingredientes.map((ing) => ing.id_insumo);
      if (new Set(ids).size !== ids.length) {
        throw new Error('No se permiten ingredientes duplicados.');
      }
      const suma = data.ingredientes.reduce((acc, ing) => acc + ing.porcentaje, 0);
      if (Math.abs(suma - 100) > 0.01) {
        throw new Error("Los nuevos porcentajes deben sumar 100%");
      }
    }

    mockFormulas = mockFormulas.map((f) =>
      f.uid === uid ? withSnapshots({ ...f, ...data, ultima_edicion: new Date() }) : f
    );
    
    const updated = mockFormulas.find((f) => f.uid === uid);
    if (!updated) throw new Error("Fórmula no encontrada");
    
    return mockApiCall(updated);
  },

  // Borrado lógico (según el requerimiento: desactivar en lugar de eliminar físicamente)
  delete: async (uid: string): Promise<boolean> => {
    mockFormulas = mockFormulas.map((f) =>
      f.uid === uid ? { ...f, esta_activa: false, ultima_edicion: new Date() } : f
    );
    return mockApiCall(true);
  }
};
