export interface SessionUser {
  name: string;
  role: string;
  login: string;
}

const AUTH_KEY = "nutribalance_auth";
const NAME_KEY = "nutribalance_user_name";
const ROLE_KEY = "nutribalance_user_role";
const LOGIN_KEY = "nutribalance_user_login";

const DEFAULT_USER: SessionUser = {
  name: "Edwin",
  role: "Administrador",
  login: "admin@nutribalance.com",
};

const CREDENTIALS = [
  { login: "admin@nutribalance.com", password: "admin123" },
  { login: "admin", password: "admin123" },
];

export const authenticateDemoUser = (login: string, password: string): SessionUser | null => {
  const loginNormalized = login.trim().toLowerCase();
  const isValid = CREDENTIALS.some((item) => item.login === loginNormalized && item.password === password);
  if (!isValid) return null;

  return {
    ...DEFAULT_USER,
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
};

export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === "true";

export const getSessionUser = (): SessionUser => {
  if (!isAuthenticated()) return DEFAULT_USER;

  return {
    name: localStorage.getItem(NAME_KEY) || DEFAULT_USER.name,
    role: localStorage.getItem(ROLE_KEY) || DEFAULT_USER.role,
    login: localStorage.getItem(LOGIN_KEY) || DEFAULT_USER.login,
  };
};
