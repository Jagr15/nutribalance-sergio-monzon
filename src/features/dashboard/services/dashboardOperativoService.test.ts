import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: { from: mockFrom },
}));

import { dashboardOperativoService } from './dashboardOperativoService';

describe('dashboardOperativoService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mapea KPIs reales desde vistas', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_dashboard_stock_resumen') return { select: () => ({ single: async () => ({ data: { stock_total_mp: 100, stock_critico: 2, valor_inventario_mp: 1000, valor_inventario_pt: 500 }, error: null }) }) };
      if (table === 'vw_dashboard_produccion_resumen') return { select: () => ({ single: async () => ({ data: { ordenes_pendientes: 1, ordenes_en_proceso: 2, ordenes_finalizadas: 3, produccion_total: 1000, costo_promedio_produccion: 1.5, merma_total: 30 }, error: null }) }) };
      if (table === 'vw_dashboard_costos_resumen') return { select: () => ({ single: async () => ({ data: { proteina_promedio_formula: 18.2 }, error: null }) }) };
      throw new Error('tabla inesperada');
    });

    const kpi = await dashboardOperativoService.getKPIs();
    expect(kpi.stock_total_mp).toBe(100);
    expect(kpi.ordenes_finalizadas).toBe(3);
    expect(kpi.proteina_promedio_formula).toBe(18.2);
  });

  it('retorna alertas operativas reales', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_dashboard_alertas_operativas') {
        return { select: () => ({ order: async () => ({ data: [{ alerta_id: 'a1', tipo: 'Stock bajo', prioridad: 'critica', area: 'stock', titulo: 'x', dato_asociado: {}, fecha_evento: new Date().toISOString() }], error: null }) }) };
      }
      throw new Error('tabla inesperada');
    });

    const rows = await dashboardOperativoService.getAlertasOperativas();
    expect(rows).toHaveLength(1);
    expect(rows[0].prioridad).toBe('critica');
  });

  it('retorna trazabilidad visual', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_dashboard_trazabilidad') {
        return { select: () => ({ order: async () => ({ data: [{ id: '1', fecha_evento: new Date().toISOString(), tipo: 'CONSUMO_MP', referencia: null, payload: {}, orden_legacy_uid: 'OP-1', orden_lote: 'OP-1', nombre_producto: 'Prod', lote_mp_legacy_uid: 'L1', lote_mp: 'L1', stock_pt_legacy_uid: 'PT1', lote_pt: 'PT1', silo_destino: 'S1' }], error: null }) }) };
      }
      throw new Error('tabla inesperada');
    });

    const rows = await dashboardOperativoService.getTrazabilidad();
    expect(rows[0].orden_legacy_uid).toBe('OP-1');
  });
});
