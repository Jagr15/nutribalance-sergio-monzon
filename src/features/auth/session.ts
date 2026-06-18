import { ROLE_LABELS, normalizeRole, type UserRole } from "./permissions";

export interface SessionUser {
  name: string;
  role: UserRole;
  roleLabel: string;
  login: string;
  managedUserUid?: string;
}

const AUTH_KEY = "nutribalance_auth";
const NAME_KEY = "nutribalance_user_name";
const ROLE_KEY = "nutribalance_user_role";
const LOGIN_KEY = "nutribalance_user_login";
const MANAGED_UID_KEY = "nutribalance_user_managed_uid";
const ALERTS_SEEN_SESSION_KEY = "nutribalance_alerts_seen_session";

const DEFAULT_USER: SessionUser = {
  name: "Edwin",
  role: "admin",
  roleLabel: ROLE_LABELS.admin,
  login: "admin@nutribalance.com",
  managedUserUid: "u-001",
};

const CREDENTIALS = [
  { login: "superadmin@nutribalance.com", password: "super123", role: "superadmin" as UserRole, name: "Super Admin", managedUserUid: "u-001" },
  { login: "superadmin", password: "super123", role: "superadmin" as UserRole, name: "Super Admin", managedUserUid: "u-001" },
  { login: "admin@nutribalance.com", password: "admin123", role: "admin" as UserRole, name: "Admin", managedUserUid: "u-001" },
  { login: "admin", password: "admin123", role: "admin" as UserRole, name: "Admin", managedUserUid: "u-001" },
  { login: "produccion", password: "demo123", role: "produccion" as UserRole, name: "Operador Producción" },
  { login: "inventario", password: "demo123", role: "inventario" as UserRole, name: "Operador Inventario" },
  { login: "finanzas", password: "demo123", role: "finanzas" as UserRole, name: "Analista Finanzas" },
  { login: "supervisor", password: "demo123", role: "supervisor" as UserRole, name: "Supervisor Planta" },
  { login: "lectura", password: "demo123", role: "solo_lectura" as UserRole, name: "Usuario Lectura" },
];

export const authenticateDemoUser = (login: string, password: string): SessionUser | null => {
  const loginNormalized = login.trim().toLowerCase();
  const isValid = CREDENTIALS.some((item) => item.login === loginNormalized && item.password === password);
  if (!isValid) return null;

  const credential = CREDENTIALS.find((item) => item.login === loginNormalized && item.password === password);
  if (!credential) return null;

  return {
    name: credential.name,
    role: credential.role,
    roleLabel: ROLE_LABELS[credential.role],
    login: loginNormalized,
    managedUserUid: credential.managedUserUid,
  };
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
