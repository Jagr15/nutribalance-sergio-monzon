import { getSessionUser, type DemoCredential, removeDemoCredentialsByAlias, upsertDemoCredentials } from '../../../../features/auth/session';
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

type MockUsuarioWritePayload = Omit<Usuario, 'uid'> & {
  password?: string;
  confirmPassword?: string;
};

const seedUsers: Usuario[] = cloneUsuarios(usersData as Usuario[]);
let mockUsers: Usuario[] = cloneUsuarios(seedUsers);
const passwordByUidKey = 'nutribalance_demo_user_passwords_v1';

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
    errors.password,
    errors.confirmPassword,
  ].filter(Boolean).join(' ');

const assertValidUserDraft = (draft: UsuarioFormInput, context: UsuarioDomainContext) => {
  const errors = validateUsuarioInput(draft, context);
  if (hasUsuarioDomainErrors(errors)) {
    throw new Error(formatDomainErrors(errors));
  }
};

const buildCreateDraft = (data: MockUsuarioWritePayload): UsuarioFormInput => normalizeUsuarioInput({
  nombre_completo: data.nombre_completo,
  username: data.username,
  email: data.email,
  role: data.role,
  estado: data.esta_activo ? 'activo' : 'inactivo',
  password: (data as { password?: string }).password ?? '',
  confirmPassword: (data as { confirmPassword?: string }).confirmPassword ?? '',
});

const buildUpdateDraft = (current: Usuario, data: Partial<MockUsuarioWritePayload>): UsuarioFormInput => {
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
    password: (data as { password?: string }).password ?? '',
    confirmPassword: (data as { confirmPassword?: string }).confirmPassword ?? '',
  } satisfies UsuarioFormInput;

  return normalizeUsuarioInput(next);
};

const persistUser = (user: Usuario) => {
  mockUsers = mockUsers.map((item) => (item.uid === user.uid ? cloneUsuario(user) : item));
};

const readPasswordMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(passwordByUidKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const getPasswordForUid = (uid: string) => readPasswordMap()[uid] ?? '';

const writePasswordMap = (map: Record<string, string>) => {
  localStorage.setItem(passwordByUidKey, JSON.stringify(map));
};

const upsertUserCredentials = (user: Usuario, password?: string) => {
  const currentMap = readPasswordMap();
  if (password) {
    currentMap[user.uid] = password;
  }
  writePasswordMap(currentMap);
  if (password) {
    upsertDemoCredentials({
      login: user.username,
      password,
      role: user.role as DemoCredential['role'],
      name: user.nombre_completo,
      managedUserUid: user.uid,
    }, [user.email]);
  }
};

export const mockUsuarioService = {
  getAll: async (): Promise<Usuario[]> => mockApiCall(cloneUsuarios(mockUsers)),

  getById: async (uid: string): Promise<Usuario | undefined> => {
    const user = mockUsers.find((item) => item.uid === uid);
    return mockApiCall(user ? cloneUsuario(user) : undefined);
  },

  create: async (data: MockUsuarioWritePayload): Promise<Usuario> => {
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
    upsertUserCredentials(created, (data as { password?: string }).password?.trim() || undefined);
    return mockApiCall(cloneUsuario(created));
  },

  update: async (uid: string, data: Partial<MockUsuarioWritePayload>): Promise<Usuario> => {
    const current = mockUsers.find((user) => user.uid === uid);
    if (!current) {
      throw new Error('Usuario no encontrado.');
    }

    const draft = buildUpdateDraft(current, data);
    assertValidUserDraft(draft, buildContext(uid));
    const nextPassword = (data as { password?: string }).password?.trim() || getPasswordForUid(uid);

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
    removeDemoCredentialsByAlias([current.username, current.email]);
    upsertUserCredentials(updated, nextPassword || undefined);
    return mockApiCall(cloneUsuario(updated));
  },

  delete: async (uid: string): Promise<boolean> => {
    await mockUsuarioService.update(uid, { esta_activo: false });
    return true;
  },
};

export const __resetMockUsuarioService = () => {
  mockUsers = cloneUsuarios(seedUsers);
  localStorage.removeItem(passwordByUidKey);
  removeDemoCredentialsByAlias(seedUsers.flatMap((user) => [user.username, user.email]));
};
