import { describe, expect, it } from 'vitest';
import type { Ingrediente } from '../types';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import { calculateFormulaCost } from './costCalculator';

const ingredientes: Ingrediente[] = [
  { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 60 },
  { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 40 },
  { id_insumo: 'i-3', nombre_insumo: 'Núcleo', porcentaje: 0 },
];

const insumos: Insumo[] = [
  { uid: 'i-1', nombre: 'Maíz', unidad_medida: 'KG', umbral_alerta: 0, categoria: 'Grano', ref_costo_unitario: 0.31 },
  { uid: 'i-2', nombre: 'Soja', unidad_medida: 'KG', umbral_alerta: 0, categoria: 'Grano', ref_costo_unitario: 0.4 },
  { uid: 'i-3', nombre: 'Núcleo', unidad_medida: 'KG', umbral_alerta: 0, categoria: 'Suplemento' },
];

const stock: StockMateriaPrima[] = [
  {
    uid: 'stk-old', id_insumo: 'i-1', id_proveedor: 'p-1', lote: 'A', cantidad_actual: 100, cantidad_inicial: 100,
    costo_unitario: 0.25, costo_total: 25, fecha_ingreso: new Date('2026-01-01T00:00:00Z'), remito_nro: '1', ubicacion: 'S1', id_usuario: 'u', createdAt: new Date(), updatedAt: new Date(),
  },
  {
    uid: 'stk-new', id_insumo: 'i-1', id_proveedor: 'p-1', lote: 'B', cantidad_actual: 100, cantidad_inicial: 100,
    costo_unitario: 0.3, costo_total: 30, fecha_ingreso: new Date('2026-02-01T00:00:00Z'), remito_nro: '2', ubicacion: 'S1', id_usuario: 'u', createdAt: new Date(), updatedAt: new Date(),
  },
];

describe('calculateFormulaCost', () => {
  it('usa costo del último lote cuando está disponible', () => {
    const result = calculateFormulaCost(ingredientes, stock, insumos);
    const maiz = result.byIngredient.find((x) => x.id_insumo === 'i-1');

    expect(maiz?.fuente_costo).toBe('ULTIMO_LOTE');
    expect(maiz?.costo_unitario_usado).toBeCloseTo(0.3, 6);
  });

  it('usa costo de referencia cuando no hay lote', () => {
    const result = calculateFormulaCost(ingredientes, stock, insumos);
    const soja = result.byIngredient.find((x) => x.id_insumo === 'i-2');

    expect(soja?.fuente_costo).toBe('REFERENCIA');
    expect(soja?.costo_unitario_usado).toBeCloseTo(0.4, 6);
    expect(result.warnings.some((w) => w.includes('Soja'))).toBe(true);
  });

  it('marca SIN_COSTO cuando no existe lote ni referencia', () => {
    const result = calculateFormulaCost(ingredientes, stock, insumos);
    const nucleo = result.byIngredient.find((x) => x.id_insumo === 'i-3');

    expect(nucleo?.fuente_costo).toBe('SIN_COSTO');
    expect(nucleo?.costo_unitario_usado).toBe(0);
    expect(result.hasMissingCosts).toBe(true);
  });

  it('calcula costo por ingrediente, por kg, por tonelada y total', () => {
    const result = calculateFormulaCost(ingredientes, stock, insumos);

    const maiz = result.byIngredient.find((x) => x.id_insumo === 'i-1');
    const soja = result.byIngredient.find((x) => x.id_insumo === 'i-2');

    expect(maiz?.costo_contribucion_kg).toBeCloseTo(0.18, 6);
    expect(soja?.costo_contribucion_kg).toBeCloseTo(0.16, 6);

    expect(result.costo_por_kg).toBeCloseTo(0.34, 6);
    expect(result.costo_por_tonelada).toBeCloseTo(340, 6);
    expect(result.costo_total_formula).toBeCloseTo(340, 6);
  });

  it('genera advertencias de costo faltante', () => {
    const result = calculateFormulaCost(ingredientes, stock, insumos);
    expect(result.warnings.some((w) => w.includes('Sin costo disponible'))).toBe(true);
  });
});
