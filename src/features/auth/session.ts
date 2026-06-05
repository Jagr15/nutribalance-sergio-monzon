import { ROLE_LABELS, normalizeRole, type UserRole } from "./permissions";

export interface SessionUser {
  name: string;
  role: UserRole;
  roleLabel: string;
  login: string;
}

const AUTH_KEY = "nutribalance_auth";
const NAME_KEY = "nutribalance_user_name";
const ROLE_KEY = "nutribalance_user_role";
const LOGIN_KEY = "nutribalance_user_login";
const ALERTS_SEEN_SESSION_KEY = "nutribalance_alerts_seen_session";

const DEFAULT_USER: SessionUser = {
  name: "Edwin",
  role: "admin",
  roleLabel: ROLE_LABELS.admin,
  login: "admin@nutribalance.com",
};

const CREDENTIALS = [
  { login: "admin@nutribalance.com", password: "admin123", role: "admin" as UserRole, name: "Admin" },
  { login: "admin", password: "admin123", role: "admin" as UserRole, name: "Admin" },
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
  };
};

export const saveSession = (user: SessionUser) => {
  localStorage.setItem(AUTH_KEY, "true");
  localStorage.setItem(NAME_KEY, user.name);
  localStorage.setItem(ROLE_KEY, user.role);
  localStorage.setItem(LOGIN_KEY, user.login);
};

export const clearSession = () => {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(LOGIN_KEY);
  sessionStorage.removeItem(ALERTS_SEEN_SESSION_KEY);
};

export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === "true";

export const getSessionUser = (): SessionUser => {
  if (!isAuthenticated()) return DEFAULT_USER;

  return {
    name: localStorage.getItem(NAME_KEY) || DEFAULT_USER.name,
    role: normalizeRole(localStorage.getItem(ROLE_KEY) || DEFAULT_USER.role),
    roleLabel: ROLE_LABELS[normalizeRole(localStorage.getItem(ROLE_KEY) || DEFAULT_USER.role)],
    login: localStorage.getItem(LOGIN_KEY) || DEFAULT_USER.login,
  };
};
