import { describe, expect, it } from 'vitest';
import { mockTrazabilidadService } from './mockTrazabilidadService';

describe('mockTrazabilidadService', () => {
  it('expone movimientos MP de auditoría', async () => {
    const rows = await mockTrazabilidadService.getMovimientosMPAuditoria();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('tipo_movimiento');
    expect(rows[0]).toHaveProperty('insumo');
    expect(rows[0]).toHaveProperty('lote_mp');
  });

  it('expone trazabilidad por OP con PT y eventos', async () => {
    const rows = await mockTrazabilidadService.getTrazabilidadPorOP();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('mp_planificada');
    expect(rows[0]).toHaveProperty('pt_generado');
    expect(rows[0]).toHaveProperty('eventos');
  });
});
