import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFrom,
  mockStockMpResumen,
  mockStockPtResumen,
  mockStockMpAll,
  mockStockPtAll,
  mockStockPtMovs,
  mockInsumosAll,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockStockMpResumen: vi.fn(),
  mockStockPtResumen: vi.fn(),
  mockStockMpAll: vi.fn(),
  mockStockPtAll: vi.fn(),
  mockStockPtMovs: vi.fn(),
  mockInsumosAll: vi.fn(),
}));

vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: { from: mockFrom },
}));

vi.mock('../../../infrastructure/api', () => ({
  ApiService: {
    stockMP: {
      getResumen: mockStockMpResumen,
      getAllLotes: mockStockMpAll,
    },
    stockPT: {
      getResumen: mockStockPtResumen,
      getAll: mockStockPtAll,
      getMovimientos: mockStockPtMovs,
    },
    insumos: {
      getAllInsumos: mockInsumosAll,
    },
  },
}));

import { dashboardOperativoService } from './dashboardOperativoService';

describe('dashboardOperativoService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mapea KPIs reales desde vistas', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'vw_dashboard_stock_resumen') return { select: () => ({ single: async () => ({ data: { stock_total_mp: 100, stock_total_pt: 50, stock_critico: 2, valor_inventario_mp: 1000, valor_inventario_pt: 500 }, error: null }) }) };
      if (table === 'vw_dashboard_produccion_resumen') return { select: () => ({ single: async () => ({ data: { ordenes_pendientes: 1, ordenes_en_proceso: 2, ordenes_finalizadas: 3, produccion_total: 1000, costo_promedio_produccion: 1.5, merma_total: 30 }, error: null }) }) };
      if (table === 'vw_dashboard_costos_resumen') return { select: () => ({ single: async () => ({ data: { proteina_promedio_formula: 18.2 }, error: null }) }) };
      if (table === 'stock_lotes_mp') return { select: () => ({ is: async () => ({ data: [{ cantidad_actual: 70, cantidad_comprometida: 20 }], error: null }) }) };
      throw new Error('tabla inesperada');
    });

    const kpi = await dashboardOperativoService.getKPIs();
    expect(kpi.stock_total_mp).toBe(70);
    expect(kpi.stock_comprometido_mp).toBe(20);
    expect(kpi.stock_disponible_mp).toBe(50);
    expect(kpi.ordenes_finalizadas).toBe(3);
    expect(kpi.proteina_promedio_formula).toBe(18.2);
    expect(kpi.stock_total_pt).toBe(50);
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

  it('expone resúmenes canónicos de MP y PT', async () => {
    mockStockMpResumen.mockResolvedValue([
      {
        insumo_id: 'i1',
        nombre_insumo: 'Maíz',
        unidad: 'KG',
        stock_actual: 100,
        stock_comprometido: 30,
        stock_disponible: 70,
        umbral_alerta: 20,
        estado: 'OK',
      },
    ]);
    mockStockPtResumen.mockResolvedValue([
      {
        producto_id: 'p1',
        nombre_producto: 'Balanceado Demo',
        unidad: 'KG',
        stock_actual: 55,
        valor_monetario: 1234,
        estado: 'BAJO',
        cantidad_lotes: 2,
        ultima_actualizacion: new Date().toISOString(),
        numero_orden: 'OP-000001',
        id_formula: 'f1',
        version_formula: 1,
      },
    ]);

    const resumenes = await dashboardOperativoService.getStockResumenes();

    expect(mockStockMpResumen).toHaveBeenCalledTimes(1);
    expect(mockStockPtResumen).toHaveBeenCalledTimes(1);
    expect(resumenes.stockMateriaPrima[0].nombre_insumo).toBe('Maíz');
    expect(resumenes.stockProductoTerminado[0].nombre_producto).toBe('Balanceado Demo');
  });
});
