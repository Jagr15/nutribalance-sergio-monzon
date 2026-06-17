import { describe, expect, it } from 'vitest';
import type { Formula } from '../../formulas/types';
import type { OrdenProduccion } from '../../ordenes/types';
import { buildCostosFormulaVsReal } from './costosFormulaVsReal';

const formulas: Formula[] = [
  {
    uid: 'for-1',
    nombre_producto: 'Balanceado X',
    ingredientes: [],
    version: 2,
    esta_activa: true,
    ultima_edicion: new Date('2026-06-01T00:00:00Z'),
    id_usuario: 'usr-1',
    author: 'Tester',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    costo_por_kg: 100,
    costo_por_tonelada: 100000,
  },
];

const ordenes: OrdenProduccion[] = [
  {
    id: 'op-1',
    lote: 'OP-0001',
    id_formula: 'for-1',
    nombre_producto: 'Balanceado X',
    version_formula: 2,
    cantidad_objetivo: 1000,
    cantidad_real: 1000,
    estado: 'FINALIZADO',
    fecha_creacion: '2026-06-10T10:00:00Z',
    usuario_responsable: 'Operador',
    id_silo: null,
    destino_silo: null,
    detalle_insumos: [],
    costo_total_insumos: 120000,
  },
];

describe('buildCostosFormulaVsReal', () => {
  it('calcula comparación entre costo formulado y real', () => {
    const rows = buildCostosFormulaVsReal(formulas, ordenes);

    expect(rows).toHaveLength(1);
    expect(rows[0].costo_formulado_kg).toBe(100);
    expect(rows[0].costo_real_kg).toBe(120);
    expect(rows[0].variacion_abs).toBe(20);
    expect(rows[0].variacion_pct).toBe(20);
    expect(rows[0].ultima_op).toBe('OP-0001');
  });
});
