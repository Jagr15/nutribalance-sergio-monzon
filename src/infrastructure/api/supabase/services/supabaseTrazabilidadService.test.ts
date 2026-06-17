import { describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../client', () => ({
  supabaseClient: { from: fromMock },
}));

import { supabaseTrazabilidadService } from './supabaseTrazabilidadService';

describe('supabaseTrazabilidadService', () => {
  it('mapea movimientos MP desde la vista de auditoría', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'vw_movimientos_mp_auditoria') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  fecha: '2026-06-16T00:00:00Z',
                  tipo_movimiento: 'SALIDA',
                  insumo: 'Maiz',
                  lote_mp: 'L-1',
                  cantidad: 10,
                  unidad: 'KG',
                  op_relacionada: 'OP-0001',
                  op_lote: 'OP-0001',
                  origen: 'PRODUCCION',
                  observaciones: 'Consumo OP',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    });

    const rows = await supabaseTrazabilidadService.getMovimientosMPAuditoria();
    expect(rows[0].insumo).toBe('Maiz');
    expect(rows[0].op_relacionada).toBe('OP-0001');
  });

  it('mapea trazabilidad por OP desde la vista consolidada', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'vw_trazabilidad_por_op') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  op_id: 'uuid-op-1',
                  orden_legacy_uid: 'OP-0001',
                  numero_orden: 'OP-0001',
                  producto: 'Balanceado Demo',
                  formula: 'FORM-1',
                  version_formula: 1,
                  estado_op: 'FINALIZADO',
                  cantidad_objetivo: 1000,
                  cantidad_real: 950,
                  merma_manual: 50,
                  destino_silo: 'Silo 1',
                  usuario_responsable: 'Sergio',
                  fecha_creacion: '2026-06-16T00:00:00Z',
                  actualizada_en: '2026-06-16T01:00:00Z',
                  mp_planificada: [{ insumo: 'Maiz', lote_mp: 'L-1', cantidad: 10, unidad: 'KG', costo_unitario: 1, costo_total: 10 }],
                  lotes_mp_usados: ['L-1'],
                  mp_movimientos: [],
                  pt_generado: [{ stock_pt_id: 'pt-1', lote_pt: 'PT-1', cantidad: 950, unidad: 'KG', silo: 'Silo 1', fecha: '2026-06-16T01:00:00Z' }],
                  salidas_pt: [],
                  eventos: [{ tipo: 'INGRESO_PT', referencia: 'Ingreso PT', fecha: '2026-06-16T01:00:00Z', payload: {} }],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    });

    const rows = await supabaseTrazabilidadService.getTrazabilidadPorOP();
    expect(rows[0].numero_orden).toBe('OP-0001');
    expect(rows[0].pt_generado[0].lote_pt).toBe('PT-1');
    expect(rows[0].eventos[0].tipo).toBe('INGRESO_PT');
  });
});
