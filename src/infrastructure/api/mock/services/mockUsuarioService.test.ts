import { beforeEach, describe, expect, it } from 'vitest';
import { authenticateDemoUser, saveSession, clearSession, type SessionUser } from '../../../../features/auth/session';
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
        password: 'secret123',
        confirmPassword: 'secret123',
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
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    expect(created.role).toBe('SUPERADMIN');
    expect(authenticateDemoUser('nuevo_admin', 'secret123')).not.toBeNull();
    expect(authenticateDemoUser('nuevo@nutribalance.com', 'secret123')).not.toBeNull();
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
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    await expect(
      mockUsuarioService.create({
        nombre_completo: 'Duplicado Dos',
        username: 'duplicado_user',
        email: 'otro@example.com',
        role: 'OPERARIO',
        esta_activo: true,
        fecha_creacion: '2026-06-18T00:00:00.000Z',
        password: 'secret123',
        confirmPassword: 'secret123',
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
        password: 'secret123',
        confirmPassword: 'secret123',
      })
    ).rejects.toThrow(/email/i);
  });

  it('permite editar sin contraseña y conservar acceso', async () => {
    setSession(superadminSession);

    const created = await mockUsuarioService.create({
      nombre_completo: 'Usuario Test',
      username: 'usuario_test',
      email: 'usuario@test.com',
      role: 'OPERARIO',
      esta_activo: true,
      fecha_creacion: '2026-06-18T00:00:00.000Z',
      password: 'clave1234',
      confirmPassword: 'clave1234',
    });

    const updated = await mockUsuarioService.update(created.uid, {
      nombre_completo: 'Usuario Test Editado',
    });

    expect(updated.nombre_completo).toBe('Usuario Test Editado');
    expect(authenticateDemoUser('usuario_test', 'clave1234')).not.toBeNull();
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
