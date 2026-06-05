import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, updateMock, deleteMock, auditMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  auditMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/', () => ({
  ApiService: { formulas: { findAll: vi.fn(), getById: vi.fn(), create: createMock, update: updateMock, delete: deleteMock } },
}));
vi.mock('../../auth/audit', () => ({ auditAction: auditMock }));

import { formulaService } from './formulaService';
import type { Formula } from '../types';

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
const minimalFormulaPayload = (): Omit<Formula, 'uid' | 'ultima_edicion'> => ({
  nombre_producto: 'Formula test',
  ingredientes: [],
  version: 1,
  esta_activa: true,
  id_usuario: 'usr-1',
  author: 'Admin',
  createdAt: new Date(),
});

describe('formulaService permisos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('bloquea create sin permiso', async () => {
    setRole('solo_lectura');
    expect(() => formulaService.create(minimalFormulaPayload())).toThrow(/No tiene permisos/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('audita create con nombre esperado', async () => {
    setRole('admin');
    createMock.mockResolvedValue({ uid: 'f-1', nombre_producto: 'x', version: 1 });
    await formulaService.create(minimalFormulaPayload());
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ accion: 'create_formula' }));
  });
});
