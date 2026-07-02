import { describe, expect, it } from 'vitest';
import type { Ingrediente } from '../types';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import { calculateFormulaNutrition } from './nutritionCalculator';
import { calculateFormulaCost } from './costCalculator';

const ingredientes: Ingrediente[] = [
  { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 50 },
  { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 50 },
];

const insumos: Insumo[] = [
  {
    uid: 'i-1', nombre: 'Maíz', unidad_medida: 'KG', umbral_alerta: 0, categoria: 'Grano',
    ref_costo_unitario: 0.3, proteina_bruta_pct: 8, humedad_pct: 12, fibra_pct: 2, grasa_pct: 3.5, cenizas_pct: 1.5,
  },
  {
    uid: 'i-2', nombre: 'Soja', unidad_medida: 'KG', umbral_alerta: 0, categoria: 'Grano',
    ref_costo_unitario: 0.4, proteina_bruta_pct: 44, humedad_pct: 11, fibra_pct: 6, grasa_pct: 1.8, cenizas_pct: 6,
  },
];

const stock: StockMateriaPrima[] = [
  {
    uid: 'stk-1', id_insumo: 'i-1', id_proveedor: 'p-1', lote: 'L1', cantidad_actual: 100, cantidad_inicial: 100,
    costo_unitario: 0.29, costo_total: 29, fecha_ingreso: new Date('2026-01-01T00:00:00Z'), remito_nro: 'r1',
    ubicacion: 'S1', id_usuario: 'u', createdAt: new Date(), updatedAt: new Date(),
  },
];

describe('nutrition + cost snapshot compatibility', () => {
  it('genera snapshot compatible con FormulaModal/supabaseFormulaService', () => {
    const nutrition = calculateFormulaNutrition(ingredientes, insumos);
    const cost = calculateFormulaCost(ingredientes, stock, insumos);

    const enrichedIngredientes = ingredientes.map((ing) => {
      const n = nutrition.byIngredient.find((item) => item.id_insumo === ing.id_insumo);
      const c = cost.byIngredient.find((item) => item.id_insumo === ing.id_insumo);
      return {
        ...ing,
        aporte_proteina_pct: n?.aporte_proteina_pct,
        aporte_proteina_g_kg: n?.aporte_proteina_g_kg,
        costo_unitario_usado: c?.costo_unitario_usado,
        costo_contribucion_kg: c?.costo_contribucion_kg,
        fuente_costo: c?.fuente_costo,
      };
    });

    const snapshot = {
      proteina_calculada_pct: nutrition.totals.proteina_bruta_pct,
      costo_total: cost.costo_total_formula,
      costo_por_kg: cost.costo_por_kg,
      costo_por_tonelada: cost.costo_por_tonelada,
      advertencias_nutricionales: nutrition.warnings,
      advertencias_costos: cost.warnings,
      ingredientes: enrichedIngredientes,
    };

    expect(typeof snapshot.proteina_calculada_pct).toBe('number');
    expect(typeof snapshot.costo_total).toBe('number');
    expect(snapshot.ingredientes[0]).toHaveProperty('aporte_proteina_pct');
    expect(snapshot.ingredientes[0]).toHaveProperty('costo_unitario_usado');
    expect(['PROMEDIO_STOCK', 'REFERENCIA', 'SIN_COSTO']).toContain(snapshot.ingredientes[0].fuente_costo);
  });
});
