import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureMock } = vi.hoisted(() => ({
  ensureMock: vi.fn(),
}));

vi.mock('../../finanzas/services/contabilidadOperativaService', () => ({
  contabilidadOperativaService: { ensureMovimiento: ensureMock },
}));

import { costosContabilidadService } from './costosContabilidadService';

describe('costosContabilidadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sincroniza un ingreso de costos de forma idempotente y trazable', async () => {
    await costosContabilidadService.sincronizarMovimiento({
      origen_id: 'costo-001',
      fecha: '2026-06-18T00:00:00Z',
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: 'Cobranza cliente',
      monto: 2500,
      metadata: { comprobante: 'c-1' },
    });

    expect(ensureMock).toHaveBeenCalledWith(expect.objectContaining({
      legacy_uid: 'fcm-costos-costo-001',
      tipo: 'INGRESO',
      origen_modulo: 'costos',
      origen_id: 'costo-001',
      origen_operativo: 'COBRANZA',
      descripcion: 'Cobranza cliente',
      monto: 2500,
      estado: 'CONFIRMADO',
      metadata: expect.objectContaining({
        comprobante: 'c-1',
        origen_modulo: 'costos',
        origen_id: 'costo-001',
      }),
    }));
  });

  it('anula un egreso de costos sin perder trazabilidad', async () => {
    await costosContabilidadService.anularMovimiento({
      origen_id: 'costo-002',
      fecha: '2026-06-18T00:00:00Z',
      monto: 1800,
      tipo: 'EGRESO',
      origen_operativo: 'EGRESO_OPERATIVO',
      descripcion: 'Anulación de egreso',
      metadata: { motivo: 'corrección' },
    });

    expect(ensureMock).toHaveBeenCalledWith(expect.objectContaining({
      legacy_uid: 'fcm-costos-costo-002',
      tipo: 'EGRESO',
      origen_modulo: 'costos',
      origen_id: 'costo-002',
      origen_operativo: 'EGRESO_OPERATIVO',
      descripcion: 'Anulación de egreso',
      monto: 1800,
      estado: 'ANULADO',
      metadata: expect.objectContaining({
        motivo: 'corrección',
        accion: 'anulacion',
        origen_modulo: 'costos',
        origen_id: 'costo-002',
      }),
    }));
  });
});
