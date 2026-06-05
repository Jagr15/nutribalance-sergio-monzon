import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock('../../../infrastructure/api/supabase/client', () => ({ supabaseClient: { from: mockFrom } }));

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
        return { select: () => ({ single: async () => ({ data: { payload: { flujo_caja_mensual: [{ mes: '2026-05', ingresos: 1, egresos: 2, neto: -1 }], gastos_por_categoria: [], ingresos_por_categoria: [], rentabilidad_por_formula: [], costo_operativo_mensual: [] } }, error: null }) }) };
      }
      throw new Error('tabla inesperada');
    });

    const r = await finanzasService.getReportes();
    expect(r.flujo_caja_mensual).toHaveLength(1);
  });
});
