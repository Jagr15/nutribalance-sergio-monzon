import { ROLE_LABELS, normalizeRole, type UserRole } from "./permissions";

export interface SessionUser {
  name: string;
  role: UserRole;
  roleLabel: string;
  login: string;
  managedUserUid?: string;
}

export type DemoCredential = {
  login: string;
  password: string;
  role: UserRole;
  name: string;
  managedUserUid?: string;
};

const AUTH_KEY = "nutribalance_auth";
const NAME_KEY = "nutribalance_user_name";
const ROLE_KEY = "nutribalance_user_role";
const LOGIN_KEY = "nutribalance_user_login";
const MANAGED_UID_KEY = "nutribalance_user_managed_uid";
const DEMO_CREDENTIALS_KEY = "nutribalance_demo_credentials_v1";
const ALERTS_SEEN_SESSION_KEY = "nutribalance_alerts_seen_session";

export const DEMO_LOGIN_EMAIL = "admin@nutribalance.com";

const DEFAULT_USER: SessionUser = {
  name: "Edwin",
  role: "admin",
  roleLabel: ROLE_LABELS.admin,
  login: DEMO_LOGIN_EMAIL,
  managedUserUid: "u-001",
};

const CREDENTIALS = [
  { login: "superadmin@nutribalance.com", password: "super123", role: "superadmin" as UserRole, name: "Super Admin", managedUserUid: "u-001" },
  { login: "superadmin", password: "super123", role: "superadmin" as UserRole, name: "Super Admin", managedUserUid: "u-001" },
  { login: DEMO_LOGIN_EMAIL, password: "admin123", role: "encargado" as UserRole, name: "Encargado", managedUserUid: "u-001" },
  { login: "admin", password: "admin123", role: "encargado" as UserRole, name: "Encargado", managedUserUid: "u-001" },
  { login: "encargado", password: "demo123", role: "encargado" as UserRole, name: "Encargado" },
  { login: "operario", password: "demo123", role: "operario" as UserRole, name: "Operario" },
  { login: "produccion", password: "demo123", role: "operario" as UserRole, name: "Operario Producción" },
  { login: "inventario", password: "demo123", role: "operario" as UserRole, name: "Operario Inventario" },
  { login: "finanzas", password: "demo123", role: "encargado" as UserRole, name: "Analista Finanzas" },
  { login: "supervisor", password: "demo123", role: "encargado" as UserRole, name: "Supervisor Planta" },
  { login: "lectura", password: "demo123", role: "solo_lectura" as UserRole, name: "Usuario Lectura" },
] satisfies DemoCredential[];

const readStoredDemoCredentials = (): DemoCredential[] => {
  try {
    const raw = localStorage.getItem(DEMO_CREDENTIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DemoCredential[]) : [];
  } catch {
    return [];
  }
};

const writeStoredDemoCredentials = (credentials: DemoCredential[]) => {
  localStorage.setItem(DEMO_CREDENTIALS_KEY, JSON.stringify(credentials));
};

const normalizeLogin = (value: string) => value.trim().toLowerCase();

const findCredential = (login: string, password: string) => {
  const loginNormalized = normalizeLogin(login);
  const stored = readStoredDemoCredentials();
  const combined = [...stored, ...CREDENTIALS];
  return combined.find((item) => item.login === loginNormalized && item.password === password) ?? null;
};

export const authenticateDemoUser = (login: string, password: string): SessionUser | null => {
  const loginNormalized = normalizeLogin(login);
  const credential = findCredential(loginNormalized, password);
  if (!credential) return null;

  return {
    name: credential.name,
    role: credential.role,
    roleLabel: ROLE_LABELS[credential.role],
    login: loginNormalized,
    managedUserUid: credential.managedUserUid,
  };
};

export const upsertDemoCredentials = (credential: DemoCredential, aliases: string[] = []) => {
  const loginNormalized = normalizeLogin(credential.login);
  const nextAliases = [loginNormalized, ...aliases.map(normalizeLogin)].filter(Boolean);
  const stored = readStoredDemoCredentials().filter((item) => !nextAliases.includes(item.login));
  const nextEntries = nextAliases.map((login) => ({ ...credential, login }));
  writeStoredDemoCredentials([...stored, ...nextEntries]);
};

export const removeDemoCredentialsByAlias = (aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeLogin);
  const stored = readStoredDemoCredentials().filter((item) => !normalizedAliases.includes(item.login));
  writeStoredDemoCredentials(stored);
};

export const saveSession = (user: SessionUser) => {
  localStorage.setItem(AUTH_KEY, "true");
  localStorage.setItem(NAME_KEY, user.name);
  localStorage.setItem(ROLE_KEY, user.role);
  localStorage.setItem(LOGIN_KEY, user.login);
  if (user.managedUserUid) {
    localStorage.setItem(MANAGED_UID_KEY, user.managedUserUid);
  } else {
    localStorage.removeItem(MANAGED_UID_KEY);
  }
};

export const clearSession = () => {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(LOGIN_KEY);
  localStorage.removeItem(MANAGED_UID_KEY);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(ALERTS_SEEN_SESSION_KEY);
  }
};

export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === "true";

export const getSessionUser = (): SessionUser => {
  if (!isAuthenticated()) return DEFAULT_USER;

  return {
    name: localStorage.getItem(NAME_KEY) || DEFAULT_USER.name,
    role: normalizeRole(localStorage.getItem(ROLE_KEY) || DEFAULT_USER.role),
    roleLabel: ROLE_LABELS[normalizeRole(localStorage.getItem(ROLE_KEY) || DEFAULT_USER.role)],
    login: localStorage.getItem(LOGIN_KEY) || DEFAULT_USER.login,
    managedUserUid: localStorage.getItem(MANAGED_UID_KEY) || DEFAULT_USER.managedUserUid,
  };
};
