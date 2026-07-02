import { describe, expect, it } from 'vitest';
import type { Formula } from '../types';
import { compareFormulas } from './formulaComparison';

const formulaA: Formula = {
  uid: 'for-a',
  nombre_producto: 'Balanceado A',
  version: 1,
  esta_activa: true,
  ultima_edicion: new Date('2026-05-01T00:00:00Z'),
  id_usuario: 'usr-1',
  author: 'Admin',
  createdAt: new Date('2026-05-01T00:00:00Z'),
  proteina_calculada_pct: 18,
  costo_por_kg: 120,
  costo_por_tonelada: 120000,
  ingredientes: [
    { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 60, aporte_proteina_pct: 4.8, costo_contribucion_kg: 72, fuente_costo: 'PROMEDIO_STOCK' },
    { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 40, aporte_proteina_pct: 13.2, costo_contribucion_kg: 48, fuente_costo: 'PROMEDIO_STOCK' },
  ],
};

const formulaB: Formula = {
  uid: 'for-b',
  nombre_producto: 'Balanceado B',
  version: 2,
  esta_activa: true,
  ultima_edicion: new Date('2026-05-10T00:00:00Z'),
  id_usuario: 'usr-2',
  author: 'Producción',
  createdAt: new Date('2026-05-10T00:00:00Z'),
  proteina_calculada_pct: 21,
  costo_por_kg: 150,
  costo_por_tonelada: 150000,
  ingredientes: [
    { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 50, aporte_proteina_pct: 4, costo_contribucion_kg: 60, fuente_costo: 'PROMEDIO_STOCK' },
    { id_insumo: 'i-3', nombre_insumo: 'Núcleo', porcentaje: 50, aporte_proteina_pct: 17, fuente_costo: 'SIN_COSTO' },
  ],
};

describe('compareFormulas', () => {
  it('compara métricas generales y diferencias de costo y proteína', () => {
    const result = compareFormulas(formulaA, formulaB);

    expect(result.formulaA.nombre_producto).toBe('Balanceado A');
    expect(result.formulaB.version).toBe(2);
    expect(result.formulaA.cantidad_ingredientes).toBe(2);
    expect(result.formulaB.total_ingredientes_pct).toBe(100);
    expect(result.diferencias.costo_por_kg).toBe(30);
    expect(result.diferencias.proteina_formula).toBe(3);
    expect(result.diferencias.pb_g_kg).toBe(30);
    expect(result.diferencias.costo_por_tonelada).toBe(30000);
  });

  it('consolida ingredientes compartidos y exclusivos como 0% cuando faltan', () => {
    const result = compareFormulas(formulaA, formulaB);

    const maiz = result.ingredientes.find((row) => row.id_insumo === 'i-1');
    const soja = result.ingredientes.find((row) => row.id_insumo === 'i-2');
    const nucleo = result.ingredientes.find((row) => row.id_insumo === 'i-3');

    expect(maiz?.porcentaje_a).toBe(60);
    expect(maiz?.porcentaje_b).toBe(50);
    expect(maiz?.diferencia_pct).toBe(-10);
    expect(maiz?.costo_estimado_a_kg).toBe(72);
    expect(maiz?.costo_estimado_b_kg).toBe(60);

    expect(soja?.porcentaje_a).toBe(40);
    expect(nucleo?.porcentaje_a).toBe(0);
    expect(nucleo?.porcentaje_b).toBe(50);
    expect(nucleo?.costo_estimado_a_kg).toBeNull();
    expect(nucleo?.costo_estimado_b_kg).toBeNull();
    expect(soja?.porcentaje_b).toBe(0);
    expect(soja?.costo_estimado_a_kg).toBe(48);
    expect(soja?.costo_estimado_b_kg).toBeNull();
  });
});
