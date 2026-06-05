import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMock, deleteMock, auditMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  auditMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/', () => ({
  ApiService: { ordenes: { getAll: vi.fn(), create: vi.fn(), update: updateMock, delete: deleteMock } },
}));
vi.mock('../../auth/audit', () => ({ auditAction: auditMock }));

import { useOrdenService } from './ordenService';

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

describe('ordenService permisos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('bloquea finish_order sin permiso', async () => {
    setRole('inventario');
    expect(() => useOrdenService.finishProduction('OP-1', { cantidad_real: 1, destino_silo: 'S', lote_salida: 'L', merma: 0 })).toThrow(/No tiene permisos/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('audita start_order con nombre esperado', async () => {
    setRole('supervisor');
    updateMock.mockResolvedValue({ id: '1' });
    await useOrdenService.startProduction('OP-1');
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ accion: 'start_order' }));
  });
});
