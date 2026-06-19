import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock('../../../infrastructure/api/supabase/client', () => ({ supabaseClient: { from: mockFrom } }));
vi.mock('../../../infrastructure/api/runtimeConfig', () => ({ runtimeConfig: { mode: 'mock' } }));

import { finanzasService } from './finanzasService';

describe('finanzasService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('obtiene kpis financieros', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_finanzas_kpis') return { select: () => ({ single: async () => ({ data: { saldo_actual: 1000, ingresos_mes: 800, egresos_mes: 300 }, error: null }) }) };
      throw new Error('tabla inesperada');
    });

    const k = await finanzasService.getKPIs();
    expect(k.flujo_neto).toBe(500);
    expect(k.margen_operativo).toBeCloseTo(62.5, 6);
  });

  it('obtiene reportes financieros', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_finanzas_reportes') {
        return { select: () => ({ single: async () => ({ data: { payload: { flujo_caja_mensual: [{ mes: '2026-05', ingresos: 1, egresos: 2, neto: -1 }], gastos_por_categoria: [], ingresos_por_categoria: [], ingresos_pt_por_producto: [{ producto: 'Pellet Crecimiento', cantidad_kg: 60, importe_total: 21600, clientes_count: 1, ultima_fecha: '2026-05-10T00:00:00Z' }], rentabilidad_por_formula: [], costo_operativo_mensual: [] } }, error: null }) }) };
      }
      throw new Error('tabla inesperada');
    });

    const r = await finanzasService.getReportes();
    expect(r.flujo_caja_mensual).toHaveLength(1);
    expect(r.ingresos_pt_por_producto).toHaveLength(1);
  });

  it('obtiene comparativa de costos formulado vs real', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_costos_formula_vs_real') {
        return { select: () => ({ order: async () => ({ data: [{ producto_formula_id: 'for-1', nombre_producto: 'Balanceado X', version_formula: 2, costo_formulado_kg: 100, costo_formulado_ton: 100000, costo_real_kg: 120, costo_real_ton: 120000, variacion_abs: 20, variacion_pct: 20, ultima_op: 'OP-0001' }], error: null }) }) };
      }
      throw new Error('tabla inesperada');
    });

    const rows = await finanzasService.getCostosComparativos();
    expect(rows[0].variacion_pct).toBe(20);
  });

  it('crea rubro con tipo válido en mock', async () => {
    const rubro = await finanzasService.saveRubroFinanciero({ nombre: 'Gastos legales', tipo: 'EGRESO', activo: true, area: 'Administración' });
    expect(rubro.tipo).toBe('EGRESO');
    expect(rubro.nombre).toBe('Gastos legales');
  });

  it('rechaza tipo inválido al guardar rubro', async () => {
    await expect(finanzasService.saveRubroFinanciero({ nombre: 'Rubro raro', tipo: 'MIXTO' as never, activo: true, area: null })).rejects.toThrow(/Ingreso o Egreso/);
  });
});
