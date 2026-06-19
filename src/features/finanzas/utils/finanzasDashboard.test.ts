import { describe, expect, it } from 'vitest';
import type { CostosFormulaVsReal } from '../types';
import {
  buildMateriaPrimaSimulation,
  enrichIngresosPtPorProducto,
  getPresupuestoEstado,
  hasRubroFinancieroErrors,
  normalizeRubroFinancieroInput,
  sortIngresosPtPorProducto,
  validateRubroFinancieroInput,
} from './finanzasDashboard';

describe('finanzasDashboard', () => {
  it('valida rubros y detecta duplicados sin depender de mayúsculas', () => {
    const errors = validateRubroFinancieroInput(
      { nombre: '  materia prima ', tipo: 'EGRESO', activo: true },
      [
        { id: '1', nombre: 'Materia Prima', tipo: 'VARIABLE', activo: true, editable: false, origen: 'base' },
      ],
    );

    expect(errors.nombre).toBe('Ya existe un rubro con ese nombre para ese tipo.');
    expect(hasRubroFinancieroErrors(errors)).toBe(true);
  });

  it('normaliza texto de rubro antes de guardar', () => {
    expect(
      normalizeRubroFinancieroInput({
        nombre: '  Gastos   generales ',
        tipo: 'INGRESO',
        activo: true,
      }),
    ).toEqual({
      nombre: 'Gastos generales',
      tipo: 'INGRESO',
      activo: true,
    });
  });

  it('clasifica el estado del presupuesto', () => {
    expect(getPresupuestoEstado(100, 80)).toBe('OK');
    expect(getPresupuestoEstado(100, 95)).toBe('Atención');
    expect(getPresupuestoEstado(100, 120)).toBe('Excedido');
  });

  it('ordena ingresos por venta real, variación y alfabético', () => {
    const rows = [
      { producto: 'Zeta', cantidad_kg: 10, importe_total: 100, clientes_count: 1, ultima_fecha: null, variacion_pct: 3, costo_referencial_kg: 10 },
      { producto: 'Alfa', cantidad_kg: 30, importe_total: 300, clientes_count: 2, ultima_fecha: null, variacion_pct: 12, costo_referencial_kg: 20 },
      { producto: 'Beta', cantidad_kg: 20, importe_total: 250, clientes_count: 1, ultima_fecha: null, variacion_pct: -20, costo_referencial_kg: 15 },
    ];

    expect(sortIngresosPtPorProducto(rows, 'venta_real')[0].producto).toBe('Alfa');
    expect(sortIngresosPtPorProducto(rows, 'variacion')[0].producto).toBe('Beta');
    expect(sortIngresosPtPorProducto(rows, 'alfabetico')[0].producto).toBe('Alfa');
  });

  it('enriquece ingresos PT con variación y costo de referencia', () => {
    const comparativas: CostosFormulaVsReal[] = [
      {
        producto_formula_id: '1',
        nombre_producto: 'Pellet Crecimiento',
        version_formula: 1,
        costo_formulado_kg: 100,
        costo_formulado_ton: 100000,
        costo_real_kg: 120,
        costo_real_ton: 120000,
        variacion_abs: 20,
        variacion_pct: 20,
        ultima_op: null,
      },
    ];

    const rows = enrichIngresosPtPorProducto(
      [
        {
          producto: 'Pellet Crecimiento',
          cantidad_kg: 60,
          importe_total: 24000,
          clientes_count: 1,
          ultima_fecha: '2026-06-18T00:00:00Z',
        },
      ],
      comparativas,
    );

    expect(rows[0].variacion_pct).toBe(20);
    expect(rows[0].costo_referencial_kg).toBe(120);
  });

  it('simula el impacto de un aumento de costo de materia prima', () => {
    const result = buildMateriaPrimaSimulation({
      insumo: 'Maiz',
      incremento_pct: 10,
      volumen_estimado: 100,
      costo_unitario_actual: 50,
      ingresos_periodo: 10000,
      egresos_periodo: 7000,
    });

    expect(result.costo_unitario_nuevo).toBe(55);
    expect(result.impacto_costo).toBe(500);
    expect(result.impacto_utilidad).toBe(-500);
    expect(result.margen_nuevo_pct).toBeLessThan(result.margen_actual_pct);
  });
});
