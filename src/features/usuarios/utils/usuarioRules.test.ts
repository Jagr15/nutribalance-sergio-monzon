import { describe, expect, it } from 'vitest';
import type { SessionUser } from '../../auth/session';
import type { Usuario } from '../types/usuario';
import {
  getRoleOptionsForCurrentUser,
  hasUsuarioDomainErrors,
  normalizeUsuarioInput,
  validateUsuarioInput,
} from './usuarioRules';

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

const users: Usuario[] = [
  {
    uid: 'u-001',
    username: 'sergio_admin',
    nombre_completo: 'Sergio Ramos',
    email: 'sergio@nutribalance.com',
    role: 'SUPERADMIN',
    esta_activo: true,
    fecha_creacion: '2026-06-18T00:00:00.000Z',
  },
  {
    uid: 'u-002',
    username: 'juan_operario',
    nombre_completo: 'Juan Perez',
    email: 'juan@nutribalance.com',
    role: 'OPERARIO',
    esta_activo: true,
    fecha_creacion: '2026-06-18T00:00:00.000Z',
  },
];

describe('usuarioRules', () => {
  it('oculta SUPERADMIN para admin y lo muestra para superadmin', () => {
    expect(getRoleOptionsForCurrentUser(adminSession.role).some((option) => option.value === 'SUPERADMIN')).toBe(false);
    expect(getRoleOptionsForCurrentUser(superadminSession.role).some((option) => option.value === 'SUPERADMIN')).toBe(true);
  });

  it('normaliza texto y email antes de guardar', () => {
    expect(
    normalizeUsuarioInput({
        nombre_completo: '  Sergio Ramos  ',
        username: '  sergio_admin ',
        email: '  SERGIO@NUTRIBALANCE.COM ',
        role: 'SUPERADMIN',
        estado: 'activo',
        password: 'secret123',
        confirmPassword: 'secret123',
      })
    ).toEqual({
      nombre_completo: 'Sergio Ramos',
      username: 'sergio_admin',
      email: 'sergio@nutribalance.com',
      role: 'SUPERADMIN',
      estado: 'activo',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
  });

  it('bloquea ADMIN creando SUPERADMIN y valida formato estricto', () => {
    const errors = validateUsuarioInput(
      {
        nombre_completo: 'A',
        username: 'bad user',
        email: 'correo-invalido',
        role: 'SUPERADMIN',
        estado: 'activo',
        password: 'short',
        confirmPassword: 'diff',
      },
      { existingUsers: users, currentUser: adminSession }
    );

    expect(errors.nombre_completo).toMatch(/al menos 2/);
    expect(errors.username).toMatch(/solo puede contener/);
    expect(errors.email).toBe('Ingresa un email válido.');
    expect(errors.role).toMatch(/Solo un SUPERADMIN/);
    expect(hasUsuarioDomainErrors(errors)).toBe(true);
  });

  it('permite SUPERADMIN crear SUPERADMIN', () => {
    const errors = validateUsuarioInput(
      {
        nombre_completo: 'Nuevo Admin',
        username: 'nuevo_admin',
        email: 'nuevo@nutribalance.com',
        role: 'SUPERADMIN',
        estado: 'activo',
        password: 'secret123',
        confirmPassword: 'secret123',
      },
      { existingUsers: users, currentUser: superadminSession }
    );

    expect(errors.role).toBeUndefined();
    expect(errors.general).toBeUndefined();
  });

  it('detecta duplicados sin importar mayúsculas al editar ignorando el propio usuario', () => {
    const duplicateErrors = validateUsuarioInput(
      {
        nombre_completo: 'Nuevo Usuario',
        username: 'SERGIO_ADMIN',
        email: 'SERGIO@NUTRIBALANCE.COM',
        role: 'ADMIN',
        estado: 'activo',
        password: '',
        confirmPassword: '',
      },
      { existingUsers: users, currentUser: superadminSession }
    );

    expect(duplicateErrors.username).toBe('Ya existe un usuario con ese username.');
    expect(duplicateErrors.email).toBe('Ya existe un usuario con ese email.');

    const editingOwnErrors = validateUsuarioInput(
      {
        nombre_completo: 'Sergio Ramos',
        username: 'sergio_admin',
        email: 'sergio@nutribalance.com',
        role: 'ADMIN',
        estado: 'activo',
        password: '',
        confirmPassword: '',
      },
      { existingUsers: users, currentUser: superadminSession, editingUid: 'u-001' }
    );

    expect(editingOwnErrors.username).toBeUndefined();
    expect(editingOwnErrors.email).toBeUndefined();
    expect(editingOwnErrors.role).toBe('No puedes cambiar tu propio rol desde este módulo.');
  });

  it('bloquea dejar al sistema sin usuarios administrativos activos', () => {
    const errors = validateUsuarioInput(
      {
        nombre_completo: 'Sergio Ramos',
        username: 'sergio_admin',
        email: 'sergio@nutribalance.com',
        role: 'SUPERADMIN',
        estado: 'inactivo',
        password: '',
        confirmPassword: '',
      },
      { existingUsers: users, currentUser: superadminSession, editingUid: 'u-001' }
    );

    expect(errors.general).toBe('Debe existir al menos un usuario administrativo activo.');
  });
});
