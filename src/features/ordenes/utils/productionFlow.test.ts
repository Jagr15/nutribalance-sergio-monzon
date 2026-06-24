import { describe, expect, it } from 'vitest';
import type { Ingrediente } from '../../formulas/types';
import type { StockLoteForFlow } from './productionFlow';
import { planFifoConsumption, buildFinalizationPlan, buildFinalizationStockCheck } from './productionFlow';
import { TipoUnidad } from '../../../shared/types/global.interface';

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

  it('prioriza insumo_id UUID y mantiene fallback legacy', () => {
    const uuidLotes: StockLoteForFlow[] = [
      {
        id: 'db-uuid-1',
        legacy_uid: 'stk-uuid-1',
        lote: 'L1',
        insumo_id: 'i-1',
        insumo_legacy_uid: 'legacy-maiz',
        insumo_nombre: 'Maíz',
        fecha_ingreso: '2026-01-01T00:00:00Z',
        cantidad_actual: 200,
        cantidad_comprometida: 0,
        costo_unitario: 1,
      },
      {
        id: 'db-legacy-1',
        legacy_uid: 'stk-legacy-1',
        lote: 'L2',
        insumo_legacy_uid: 'i-2',
        insumo_nombre: 'Soja',
        fecha_ingreso: '2026-01-02T00:00:00Z',
        cantidad_actual: 200,
        cantidad_comprometida: 0,
        costo_unitario: 1,
      },
    ];

    const result = planFifoConsumption(100, ingredientes, uuidLotes);

    expect(result.stockSuficiente).toBe(true);
    expect(result.faltantes).toHaveLength(0);
    expect(result.detalle.some((d) => d.id_insumo === 'i-1')).toBe(true);
    expect(result.detalle.some((d) => d.id_insumo === 'i-2')).toBe(true);
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

  it('usa stock agregado por insumo aunque el id del detalle no coincida con el lote exacto', () => {
    const ingredienteDesfasado: Ingrediente[] = [
      { id_insumo: 'legacy-maiz', nombre_insumo: 'HARINA DE SOJA', porcentaje: 100 },
    ];
    const lotesDesfasados: StockLoteForFlow[] = [
      {
        id: 'db-qa-1',
        legacy_uid: 'qa-stock-soja',
        lote: 'QA STOCK SOJA',
        insumo_id: 'uuid-soja',
        insumo_legacy_uid: 'legacy-soja',
        insumo_nombre: 'Harina de Soja',
        fecha_ingreso: '2026-06-01T00:00:00Z',
        cantidad_actual: 1000,
        cantidad_comprometida: 0,
        costo_unitario: 1,
      },
    ];

    const result = buildFinalizationStockCheck(100, 100, ingredienteDesfasado.map((item) => ({
      id_lote: 'lote-inexistente',
      id_insumo: item.id_insumo,
      nombre_insumo: item.nombre_insumo,
      cantidad_usada: 50,
      tipo_unidad: TipoUnidad.KG,
      costo_unitario: 1,
      costo_total: 50,
    })), lotesDesfasados);

    expect(result.stockSuficiente).toBe(true);
    expect(result.faltantes).toHaveLength(0);
    expect(result.totalRequerido).toBe(50);
  });
});
