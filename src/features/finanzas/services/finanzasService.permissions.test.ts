import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, auditMock } = vi.hoisted(() => ({ fromMock: vi.fn(), auditMock: vi.fn() }));
vi.mock('../../../infrastructure/api/supabase/client', () => ({ supabaseClient: { from: fromMock } }));
vi.mock('../../auth/audit', () => ({ auditAction: auditMock }));

import { finanzasService } from './finanzasService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
});

const setRole = (role: string) => {
  localStorage.setItem('nutribalance_auth', 'true');
  localStorage.setItem('nutribalance_user_role', role);
};

describe('finanzasService permisos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fromMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it('bloquea register_financial_movement sin permiso', async () => {
    setRole('produccion');
    await expect(finanzasService.createMovimiento({ tipo: 'EGRESO', descripcion: 'x', monto: 1 })).rejects.toThrow(/No tiene permisos/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('audita register_financial_movement con nombre esperado', async () => {
    setRole('finanzas');
    await finanzasService.createMovimiento({ tipo: 'EGRESO', descripcion: 'x', monto: 1 });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ accion: 'register_financial_movement' }));
  });
});
