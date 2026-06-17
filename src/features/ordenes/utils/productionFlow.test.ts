import { describe, expect, it } from 'vitest';
import type { Ingrediente } from '../../formulas/types';
import type { StockLoteForFlow } from './productionFlow';
import { planFifoConsumption, buildFinalizationPlan } from './productionFlow';

const ingredientes: Ingrediente[] = [
  { id_insumo: 'i-1', nombre_insumo: 'Maíz', porcentaje: 60 },
  { id_insumo: 'i-2', nombre_insumo: 'Soja', porcentaje: 40 },
];

const lotes: StockLoteForFlow[] = [
  {
    id: 'db-1',
    legacy_uid: 'stk-1',
    lote: 'L1',
    insumo_legacy_uid: 'i-1',
    insumo_nombre: 'Maíz',
    fecha_ingreso: '2026-01-01T00:00:00Z',
    cantidad_actual: 500,
    cantidad_comprometida: 0,
    costo_unitario: 0.3,
  },
  {
    id: 'db-2',
    legacy_uid: 'stk-2',
    lote: 'L2',
    insumo_legacy_uid: 'i-1',
    insumo_nombre: 'Maíz',
    fecha_ingreso: '2026-02-01T00:00:00Z',
    cantidad_actual: 1000,
    cantidad_comprometida: 0,
    costo_unitario: 0.35,
  },
  {
    id: 'db-3',
    legacy_uid: 'stk-3',
    lote: 'L3',
    insumo_legacy_uid: 'i-2',
    insumo_nombre: 'Soja',
    fecha_ingreso: '2026-01-05T00:00:00Z',
    cantidad_actual: 1000,
    cantidad_comprometida: 0,
    costo_unitario: 0.41,
  },
];

describe('productionFlow - FIFO plan', () => {
  it('crea consumo FIFO para orden', () => {
    const result = planFifoConsumption(1000, ingredientes, lotes);

    expect(result.stockSuficiente).toBe(true);
    expect(result.faltantes).toHaveLength(0);
    expect(result.detalle.length).toBe(3);

    const maiz = result.detalle.filter((d) => d.id_insumo === 'i-1');
    expect(maiz).toHaveLength(2);
    expect(maiz[0].id_lote).toBe('stk-1');
    expect(maiz[0].cantidad_usada).toBeCloseTo(500, 6);
    expect(maiz[1].id_lote).toBe('stk-2');
    expect(maiz[1].cantidad_usada).toBeCloseTo(100, 6);
  });

  it('retorna error lógico por stock insuficiente', () => {
    const result = planFifoConsumption(4000, ingredientes, lotes);

    expect(result.stockSuficiente).toBe(false);
    expect(result.faltantes.length).toBeGreaterThan(0);
  });
});

describe('productionFlow - finalization plan', () => {
  it('genera movimientos, stock_pt y trazabilidad al finalizar', () => {
    const plan = planFifoConsumption(1000, ingredientes, lotes);
    const map = new Map<string, string>([
      ['stk-1', 'db-1'],
      ['stk-2', 'db-2'],
      ['stk-3', 'db-3'],
    ]);

    const finalization = buildFinalizationPlan(
      'OP-TEST-001',
      'Producto Test',
      'PT-TEST-001',
      'Silo Lechera',
      1000,
      980,
      plan.detalle,
      map
    );

    expect(finalization.movimientos.length).toBe(plan.detalle.length);
    expect(finalization.stockPtPayload.lote).toBe('PT-TEST-001');
    expect(finalization.stockPtPayload.cantidad_total).toBe(980);
    expect(finalization.trazabilidad.map((t) => t.tipo)).toEqual(['CONSUMO_MP', 'PRODUCCION_FIN', 'INGRESO_PT']);
  });

  it('falla si no existe mapeo de lote para consumo', () => {
    const plan = planFifoConsumption(1000, ingredientes, lotes);
    const map = new Map<string, string>();

    expect(() =>
      buildFinalizationPlan('OP-TEST-002', 'Producto Test', 'PT-TEST-002', 'Silo Lechera', 1000, 980, plan.detalle, map)
    ).toThrowError(/No se encontró lote físico/);
  });
});
