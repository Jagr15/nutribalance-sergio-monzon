import { beforeEach, describe, expect, it } from 'vitest';
import { assertPermission } from './accessControl';

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

describe('access control', () => {
  beforeEach(() => localStorage.clear());

  it('bloquea cuando la sesión no es válida', () => {
    expect(() => assertPermission('formulas', 'create_formula')).toThrow(/Sesión no válida o expirada/);
  });

  it('permite acción autorizada', () => {
    setRole('admin');
    expect(() => assertPermission('formulas', 'create_formula')).not.toThrow();
  });

  it('bloquea acción no autorizada', () => {
    setRole('solo_lectura');
    expect(() => assertPermission('finanzas', 'register_financial_movement')).toThrow(/No tiene permisos/);
  });
});
