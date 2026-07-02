import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureMock, auditMock, syncMock } = vi.hoisted(() => {
  const ensure = vi.fn();
  return {
    ensureMock: ensure,
    auditMock: vi.fn(),
    syncMock: vi.fn(async (payload: any) => {
      await ensure({
        legacy_uid: payload.origen_id,
        tipo: payload.tipo,
        origen_operativo: payload.origen_operativo,
        descripcion: payload.descripcion,
        monto: payload.monto,
      });
    }),
  };
});

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: { mode: 'supabase' },
}));
vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: { from: vi.fn() },
}));
vi.mock('./contabilidadOperativaService', () => ({
  contabilidadOperativaService: {
    ensureMovimiento: ensureMock,
    sincronizarMovimientoCostos: syncMock,
  },
}));
vi.mock('../../auth/audit', () => ({ auditAction: auditMock }));

import { finanzasService } from './finanzasService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
});

describe('finanzasService createMovimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('nutribalance_auth', 'true');
    localStorage.setItem('nutribalance_user_role', 'finanzas');
  });

  it('mapea cobranza manual a movimiento contable idempotente', async () => {
    await finanzasService.createMovimiento({
      tipo: 'COBRANZA',
      descripcion: 'Cobro manual cliente',
      monto: 1200,
    });

    expect(ensureMock).toHaveBeenCalledWith(expect.objectContaining({
      legacy_uid: expect.stringMatching(/^mov-/),
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA_MANUAL',
      descripcion: 'Cobro manual cliente',
      monto: 1200,
    }));
  });

  it('mapea pago manual a movimiento contable idempotente', async () => {
    await finanzasService.createMovimiento({
      tipo: 'PAGO',
      descripcion: 'Pago manual proveedor',
      monto: 2300,
    });

    expect(ensureMock).toHaveBeenCalledWith(expect.objectContaining({
      legacy_uid: expect.stringMatching(/^mov-/),
      tipo: 'EGRESO',
      origen_operativo: 'PAGO_MANUAL',
      descripcion: 'Pago manual proveedor',
      monto: 2300,
    }));
  });
});
