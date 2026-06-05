import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, updateMock, deleteMock, auditMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  auditMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/', () => ({
  ApiService: { stockMP: { getAllLotes: vi.fn(), create: createMock, update: updateMock, delete: deleteMock } },
}));
vi.mock('../../auth/audit', () => ({ auditAction: auditMock }));

import { stockMateriaPrimaService } from './stockMateriaPrimaService';
import type { StockMateriaPrima } from '../types';

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

describe('stockMateriaPrimaService permisos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('bloquea modify_stock sin permiso', async () => {
    setRole('finanzas');
    await expect(stockMateriaPrimaService.delete('stk-1')).rejects.toThrow(/No tiene permisos/);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('audita modify_stock con nombre esperado', async () => {
    setRole('inventario');
    updateMock.mockResolvedValue({ uid: 'stk-1' });
    await stockMateriaPrimaService.update('stk-1', { cantidad_actual: 1 } as Partial<StockMateriaPrima>);
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ accion: 'modify_stock' }));
  });
});
