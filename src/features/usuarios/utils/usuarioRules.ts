import type { SessionUser } from '../../auth/session';
import type { Role, Usuario } from '../types/usuario';

export const USER_ROLE_VALUES = ['SUPERADMIN', 'ENCARGADO', 'OPERARIO', 'ADMIN', 'FINANZAS'] as const satisfies readonly Role[];

export const ADMIN_ROLES: Role[] = ['SUPERADMIN', 'ADMIN', 'ENCARGADO'];

export const USER_ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'SUPERADMIN', label: 'SUPERADMIN' },
  { value: 'ENCARGADO', label: 'ENCARGADO' },
  { value: 'OPERARIO', label: 'OPERARIO' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'FINANZAS', label: 'FINANZAS' },
];

export const ADMINISTRATIVE_ROLE_OPTIONS = USER_ROLE_OPTIONS.filter((option) => option.value !== 'SUPERADMIN');

export const getRoleOptionsForCurrentUser = (currentRole: SessionUser['role']) =>
  currentRole === 'superadmin' ? USER_ROLE_OPTIONS : ADMINISTRATIVE_ROLE_OPTIONS;

export const isAdministrativeUserRole = (role: Role) => ADMIN_ROLES.includes(role);

export const isSensitiveUsuarioRole = (role: Role) => role === 'SUPERADMIN';

export const normalizeUsuarioText = (value: string) => value.trim();

export const normalizeUsuarioEmail = (value: string) => value.trim().toLowerCase();

export interface UsuarioFormInput {
  nombre_completo: string;
  username: string;
  email: string;
  role: Role | '';
  estado: 'activo' | 'inactivo';
  password: string;
  confirmPassword: string;
}

export interface UsuarioDomainContext {
  existingUsers: Usuario[];
  currentUser: SessionUser;
  editingUid?: string | null;
}

export interface UsuarioDomainErrors {
  nombre_completo?: string;
  username?: string;
  email?: string;
  role?: string;
  estado?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const normalizeValueForMatch = (value: string) => value.trim().toLowerCase();

const isCurrentUserTarget = (ctx: UsuarioDomainContext, usuario: Usuario) => {
  const currentUserUid = ctx.currentUser.managedUserUid?.trim();
  const identifiers = [
    currentUserUid ? normalizeValueForMatch(currentUserUid) : '',
    normalizeValueForMatch(ctx.currentUser.login),
    normalizeValueForMatch(ctx.currentUser.name),
  ].filter(Boolean);

  const targetIdentifiers = [
    normalizeValueForMatch(usuario.uid),
    normalizeValueForMatch(usuario.username),
    normalizeValueForMatch(usuario.email),
    normalizeValueForMatch(usuario.nombre_completo),
  ];

  return targetIdentifiers.some((item) => identifiers.includes(item));
};

export const normalizeUsuarioInput = (input: UsuarioFormInput) => ({
  nombre_completo: normalizeUsuarioText(input.nombre_completo),
  username: normalizeUsuarioText(input.username),
  email: normalizeUsuarioEmail(input.email),
  role: input.role,
  estado: input.estado,
  password: input.password.trim(),
  confirmPassword: input.confirmPassword.trim(),
});

const buildCandidateUsers = (
  existingUsers: Usuario[],
  candidate: Omit<Usuario, 'uid'>,
  editingUid?: string | null
) =>
  editingUid
    ? existingUsers.map((user) => {
        if (user.uid === editingUid) return { ...candidate, uid: user.uid };
        return user;
      })
    : [...existingUsers, { ...candidate, uid: 'draft-user' }];

const hasValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const hasValidUsernameFormat = (value: string) => /^[A-Za-z0-9._-]+$/.test(value);

export const validateUsuarioInput = (input: UsuarioFormInput, ctx: UsuarioDomainContext): UsuarioDomainErrors => {
  const errors: UsuarioDomainErrors = {};
  const normalized = normalizeUsuarioInput(input);
  const candidateRole = normalized.role;

  if (!normalized.nombre_completo) {
    errors.nombre_completo = 'El nombre completo es obligatorio.';
  } else if (normalized.nombre_completo.length < 2) {
    errors.nombre_completo = 'El nombre completo debe tener al menos 2 caracteres.';
  } else if (normalized.nombre_completo.length > 80) {
    errors.nombre_completo = 'El nombre completo no puede superar 80 caracteres.';
  }

  if (!normalized.username) {
    errors.username = 'El usuario es obligatorio.';
  } else if (normalized.username.length < 3) {
    errors.username = 'El usuario debe tener al menos 3 caracteres.';
  } else if (normalized.username.length > 40) {
    errors.username = 'El usuario no puede superar 40 caracteres.';
  } else if (!hasValidUsernameFormat(normalized.username)) {
    errors.username = 'El usuario solo puede contener letras, números, punto, guion bajo o guion.';
  }

  if (!normalized.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!hasValidEmailFormat(normalized.email)) {
    errors.email = 'Ingresa un email válido.';
  }

  if (!candidateRole) {
    errors.role = 'Selecciona un rol.';
  } else if (!USER_ROLE_VALUES.includes(candidateRole as Role)) {
    errors.role = 'Selecciona un rol válido.';
  }

  if (!normalized.estado) {
    errors.estado = 'Selecciona un estado.';
  }

  const isCreating = !ctx.editingUid;
  if (isCreating) {
    if (!input.password.trim()) {
      errors.password = 'La contraseña es obligatoria al crear un usuario.';
    } else if (input.password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (!input.confirmPassword.trim()) {
      errors.confirmPassword = 'Confirma la contraseña.';
    } else if (input.password.trim() && input.confirmPassword !== input.password) {
      errors.confirmPassword = 'Las contraseñas no coinciden.';
    }
  } else if (input.password.trim() || input.confirmPassword.trim()) {
    if (input.password.trim() && input.password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (input.password.trim() && input.confirmPassword.trim() && input.confirmPassword !== input.password) {
      errors.confirmPassword = 'Las contraseñas no coinciden.';
    }
  }

  const canAssignSuperadmin = ctx.currentUser.role === 'superadmin';
  if (candidateRole === 'SUPERADMIN' && !canAssignSuperadmin) {
    errors.role = 'Solo un SUPERADMIN puede crear o asignar este rol.';
  }

  const editingUser = ctx.editingUid ? ctx.existingUsers.find((user) => user.uid === ctx.editingUid) : undefined;
  const normalizedUsername = normalizeValueForMatch(normalized.username);
  const normalizedEmail = normalizeValueForMatch(normalized.email);
  const duplicateUsername = ctx.existingUsers.find(
    (user) =>
      normalizeValueForMatch(user.username) === normalizedUsername &&
      user.uid !== ctx.editingUid
  );
  const duplicateEmail = ctx.existingUsers.find(
    (user) =>
      normalizeValueForMatch(user.email) === normalizedEmail &&
      user.uid !== ctx.editingUid
  );

  if (duplicateUsername) {
    errors.username = 'Ya existe un usuario con ese username.';
  }

  if (duplicateEmail) {
    errors.email = 'Ya existe un usuario con ese email.';
  }

  if (editingUser && isCurrentUserTarget(ctx, editingUser)) {
    if (editingUser.esta_activo && normalized.estado === 'inactivo') {
      errors.estado = 'No puedes desactivar tu propio usuario.';
    }
    if (editingUser.role !== candidateRole) {
      errors.role = 'No puedes cambiar tu propio rol desde este módulo.';
    }
  }

  const candidateUser: Omit<Usuario, 'uid'> = {
    nombre_completo: normalized.nombre_completo,
    username: normalized.username,
    email: normalized.email,
    role: (candidateRole || 'OPERARIO') as Role,
    esta_activo: normalized.estado === 'activo',
    fecha_creacion: editingUser?.fecha_creacion ?? new Date().toISOString(),
  };

  const nextUsers = buildCandidateUsers(ctx.existingUsers, candidateUser, ctx.editingUid);
  const activeAdminCount = nextUsers.filter((user) => user.esta_activo && isAdministrativeUserRole(user.role)).length;

  if (activeAdminCount < 1) {
    errors.general = 'Debe existir al menos un usuario administrativo activo.';
  }

  return errors;
};

export const hasUsuarioDomainErrors = (errors: UsuarioDomainErrors) => Object.values(errors).some(Boolean);

export const cloneUsuario = (usuario: Usuario): Usuario => ({ ...usuario });

export const cloneUsuarios = (usuarios: Usuario[]): Usuario[] => usuarios.map(cloneUsuario);
