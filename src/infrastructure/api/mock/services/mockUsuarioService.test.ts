import { beforeEach, describe, expect, it } from 'vitest';
import { saveSession, clearSession, type SessionUser } from '../../../../features/auth/session';
import { mockUsuarioService, __resetMockUsuarioService } from './mockUsuarioService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
});

const setSession = (session: SessionUser) => {
  saveSession(session);
};

const adminSession: SessionUser = {
  name: 'Admin',
  role: 'admin',
  roleLabel: 'Admin',
  login: 'admin@nutribalance.com',
  managedUserUid: 'u-001',
};

const superadminSession: SessionUser = {
  name: 'Super Admin',
  role: 'superadmin',
  roleLabel: 'Super Admin',
  login: 'superadmin@nutribalance.com',
  managedUserUid: 'u-001',
};

describe('mockUsuarioService', () => {
  beforeEach(() => {
    clearSession();
    __resetMockUsuarioService();
  });

  it('bloquea a ADMIN al crear SUPERADMIN', async () => {
    setSession(adminSession);

    await expect(
      mockUsuarioService.create({
        nombre_completo: 'Nuevo Admin',
        username: 'nuevo_admin',
        email: 'nuevo@nutribalance.com',
        role: 'SUPERADMIN',
        esta_activo: true,
        fecha_creacion: '2026-06-18T00:00:00.000Z',
      })
    ).rejects.toThrow(/SUPERADMIN/);
  });

  it('permite a SUPERADMIN crear SUPERADMIN', async () => {
    setSession(superadminSession);

    const created = await mockUsuarioService.create({
      nombre_completo: 'Nuevo Admin',
      username: 'nuevo_admin',
      email: 'nuevo@nutribalance.com',
      role: 'SUPERADMIN',
      esta_activo: true,
      fecha_creacion: '2026-06-18T00:00:00.000Z',
    });

    expect(created.role).toBe('SUPERADMIN');
  });

  it('rechaza duplicados y respeta unicidad case-insensitive', async () => {
    setSession(superadminSession);

    await mockUsuarioService.create({
      nombre_completo: 'Duplicado Uno',
      username: 'Duplicado_User',
      email: 'duplicado@example.com',
      role: 'OPERARIO',
      esta_activo: true,
      fecha_creacion: '2026-06-18T00:00:00.000Z',
    });

    await expect(
      mockUsuarioService.create({
        nombre_completo: 'Duplicado Dos',
        username: 'duplicado_user',
        email: 'otro@example.com',
        role: 'OPERARIO',
        esta_activo: true,
        fecha_creacion: '2026-06-18T00:00:00.000Z',
      })
    ).rejects.toThrow(/username/i);

    await expect(
      mockUsuarioService.create({
        nombre_completo: 'Duplicado Tres',
        username: 'otro_usuario',
        email: 'DUPLICADO@EXAMPLE.COM',
        role: 'OPERARIO',
        esta_activo: true,
        fecha_creacion: '2026-06-18T00:00:00.000Z',
      })
    ).rejects.toThrow(/email/i);
  });

  it('bloquea la desactivacion del ultimo superadmin y del propio usuario', async () => {
    setSession(superadminSession);

    await expect(mockUsuarioService.delete('u-001')).rejects.toThrow(/administrativo activo|tu propio usuario/i);
  });

  it('devuelve copias y no expone estado interno', async () => {
    setSession(superadminSession);

    const listA = await mockUsuarioService.getAll();
    listA[0].nombre_completo = 'Mutado';

    const listB = await mockUsuarioService.getAll();
    expect(listB[0].nombre_completo).not.toBe('Mutado');

    const byId = await mockUsuarioService.getById('u-001');
    if (!byId) throw new Error('Usuario esperado no encontrado');
    byId.nombre_completo = 'Cambio local';

    const byIdAgain = await mockUsuarioService.getById('u-001');
    expect(byIdAgain?.nombre_completo).not.toBe('Cambio local');
  });
});
