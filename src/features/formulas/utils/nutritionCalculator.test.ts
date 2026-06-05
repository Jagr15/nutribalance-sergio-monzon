import { describe, expect, it } from 'vitest';
import type { Ingrediente } from '../types';
import type { Insumo } from '../../insumos/types';
import { calculateFormulaNutrition } from './nutritionCalculator';

const ingredientesBase: Ingrediente[] = [
  { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 60 },
  { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 40 },
];

const insumosBase: Insumo[] = [
  {
    uid: 'i-1', nombre: 'Maíz', unidad_medida: 'KG', umbral_alerta: 100, ref_costo_unitario: 0.3,
    categoria: 'Grano', proteina_bruta_pct: 8.5, humedad_pct: 12, fibra_pct: 2.2, grasa_pct: 3.9, cenizas_pct: 1.4,
  },
  {
    uid: 'i-2', nombre: 'Soja', unidad_medida: 'KG', umbral_alerta: 100, ref_costo_unitario: 0.4,
    categoria: 'Grano', proteina_bruta_pct: 44, humedad_pct: 11, fibra_pct: 6, grasa_pct: 1.8, cenizas_pct: 6.2,
  },
];

describe('calculateFormulaNutrition', () => {
  it('calcula proteína final ponderada y desglose total completo', () => {
    const result = calculateFormulaNutrition(ingredientesBase, insumosBase);

    expect(result.totals.proteina_bruta_pct).toBeCloseTo(22.7, 6);
    expect(result.totals.proteina_g_kg).toBeCloseTo(227, 6);
    expect(result.totals.humedad_pct).toBeCloseTo(11.6, 6);
    expect(result.totals.fibra_pct).toBeCloseTo(3.72, 6);
    expect(result.totals.grasa_pct).toBeCloseTo(3.06, 6);
    expect(result.totals.cenizas_pct).toBeCloseTo(3.32, 6);
    expect(result.warnings).toHaveLength(0);
  });

  it('calcula aporte g/kg por ingrediente', () => {
    const result = calculateFormulaNutrition(ingredientesBase, insumosBase);

    const maiz = result.byIngredient.find((x) => x.id_insumo === 'i-1');
    const soja = result.byIngredient.find((x) => x.id_insumo === 'i-2');

    expect(maiz?.aporte_proteina_g_kg).toBeCloseTo(51, 6);
    expect(soja?.aporte_proteina_g_kg).toBeCloseTo(176, 6);
  });

  it('advierte cuando falta proteína bruta', () => {
    const insumos = [{ ...insumosBase[0], proteina_bruta_pct: undefined }, insumosBase[1]];
    const result = calculateFormulaNutrition(ingredientesBase, insumos);

    expect(result.warnings.some((w) => w.includes('Falta PB'))).toBe(true);
    expect(result.hasMissingValues).toBe(true);
  });

  it('advierte cuando faltan valores nutricionales parciales', () => {
    const insumos = [{ ...insumosBase[0], fibra_pct: undefined, grasa_pct: undefined }, insumosBase[1]];
    const result = calculateFormulaNutrition(ingredientesBase, insumos);

    expect(result.warnings.some((w) => w.includes('Falta fibra'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('Falta grasa'))).toBe(true);
  });

  it('advierte cuando la suma de ingredientes es menor a 100%', () => {
    const result = calculateFormulaNutrition(
      [
        { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 50 },
        { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 40 },
      ],
      insumosBase
    );

    expect(result.warnings.some((w) => w.includes('suma de ingredientes'))).toBe(true);
  });

  it('advierte cuando la suma de ingredientes es mayor a 100%', () => {
    const result = calculateFormulaNutrition(
      [
        { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 70 },
        { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 40 },
      ],
      insumosBase
    );

    expect(result.warnings.some((w) => w.includes('suma de ingredientes'))).toBe(true);
  });

  it('maneja ingredientes en cero sin romper cálculos', () => {
    const result = calculateFormulaNutrition(
      [{ id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 0 }],
      insumosBase
    );

    expect(result.totals.proteina_bruta_pct).toBe(0);
    expect(result.totals.proteina_g_kg).toBe(0);
  });

  it('mantiene tolerancia numérica en decimales', () => {
    const result = calculateFormulaNutrition(
      [
        { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 33.3333 },
        { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 66.6667 },
      ],
      insumosBase
    );

    expect(result.totals.proteina_bruta_pct).toBeCloseTo(32.1666785, 6);
  });
});
