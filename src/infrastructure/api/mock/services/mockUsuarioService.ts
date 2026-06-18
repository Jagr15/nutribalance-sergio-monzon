import { getSessionUser } from '../../../../features/auth/session';
import type { Usuario } from '../../../../features/usuarios/types/usuario';
import {
  cloneUsuario,
  cloneUsuarios,
  hasUsuarioDomainErrors,
  normalizeUsuarioInput,
  type UsuarioDomainContext,
  type UsuarioFormInput,
  validateUsuarioInput,
} from '../../../../features/usuarios/utils/usuarioRules';
import usersData from '../data/usuarios.json';
import { mockApiCall } from '../mockClient';

const seedUsers: Usuario[] = cloneUsuarios(usersData as Usuario[]);
let mockUsers: Usuario[] = cloneUsuarios(seedUsers);

const generateUid = () => `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const buildContext = (editingUid?: string | null): UsuarioDomainContext => ({
  existingUsers: cloneUsuarios(mockUsers),
  currentUser: getSessionUser(),
  editingUid: editingUid ?? null,
});

const formatDomainErrors = (errors: ReturnType<typeof validateUsuarioInput>) =>
  [
    errors.general,
    errors.nombre_completo,
    errors.username,
    errors.email,
    errors.role,
    errors.estado,
  ].filter(Boolean).join(' ');

const assertValidUserDraft = (draft: UsuarioFormInput, context: UsuarioDomainContext) => {
  const errors = validateUsuarioInput(draft, context);
  if (hasUsuarioDomainErrors(errors)) {
    throw new Error(formatDomainErrors(errors));
  }
};

const buildCreateDraft = (data: Omit<Usuario, 'uid'>): UsuarioFormInput => normalizeUsuarioInput({
  nombre_completo: data.nombre_completo,
  username: data.username,
  email: data.email,
  role: data.role,
  estado: data.esta_activo ? 'activo' : 'inactivo',
});

const buildUpdateDraft = (current: Usuario, data: Partial<Usuario>): UsuarioFormInput => {
  const next = {
    nombre_completo: data.nombre_completo ?? current.nombre_completo,
    username: data.username ?? current.username,
    email: data.email ?? current.email,
    role: (data.role ?? current.role) as Usuario['role'],
    estado:
      data.esta_activo === undefined
        ? current.esta_activo
          ? 'activo'
          : 'inactivo'
        : data.esta_activo
          ? 'activo'
          : 'inactivo',
  } satisfies UsuarioFormInput;

  return normalizeUsuarioInput(next);
};

const persistUser = (user: Usuario) => {
  mockUsers = mockUsers.map((item) => (item.uid === user.uid ? cloneUsuario(user) : item));
};

export const mockUsuarioService = {
  getAll: async (): Promise<Usuario[]> => mockApiCall(cloneUsuarios(mockUsers)),

  getById: async (uid: string): Promise<Usuario | undefined> => {
    const user = mockUsers.find((item) => item.uid === uid);
    return mockApiCall(user ? cloneUsuario(user) : undefined);
  },

  create: async (data: Omit<Usuario, 'uid'>): Promise<Usuario> => {
    const draft = buildCreateDraft(data);
    assertValidUserDraft(draft, buildContext());

    const created: Usuario = {
      uid: generateUid(),
      nombre_completo: draft.nombre_completo,
      username: draft.username,
      email: draft.email,
      role: draft.role as Usuario['role'],
      esta_activo: draft.estado === 'activo',
      fecha_creacion: new Date().toISOString(),
    };

    mockUsers = [...mockUsers, cloneUsuario(created)];
    return mockApiCall(cloneUsuario(created));
  },

  update: async (uid: string, data: Partial<Usuario>): Promise<Usuario> => {
    const current = mockUsers.find((user) => user.uid === uid);
    if (!current) {
      throw new Error('Usuario no encontrado.');
    }

    const draft = buildUpdateDraft(current, data);
    assertValidUserDraft(draft, buildContext(uid));

    const updated: Usuario = {
      ...current,
      nombre_completo: draft.nombre_completo,
      username: draft.username,
      email: draft.email,
      role: draft.role as Usuario['role'],
      esta_activo: draft.estado === 'activo',
      fecha_creacion: current.fecha_creacion ?? new Date().toISOString(),
    };

    persistUser(updated);
    return mockApiCall(cloneUsuario(updated));
  },

  delete: async (uid: string): Promise<boolean> => {
    await mockUsuarioService.update(uid, { esta_activo: false });
    return true;
  },
};

export const __resetMockUsuarioService = () => {
  mockUsers = cloneUsuarios(seedUsers);
};
