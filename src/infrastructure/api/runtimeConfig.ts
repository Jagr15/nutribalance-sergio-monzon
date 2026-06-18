export type ApiMode = 'supabase' | 'mock';
export type RuntimeConfigStatus = 'ready' | 'invalid';
export type RuntimeConfig = {
  mode: ApiMode;
  status: RuntimeConfigStatus;
  environment: 'production' | 'development';
  isProduction: boolean;
  isMockRequested: boolean;
  isSupabaseRequested: boolean;
  hasSupabaseConfig: boolean;
  warnings: string[];
  errors: string[];
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const normalizeEnvValue = (value: string | undefined) => value?.trim() ?? '';

const rawUseMocks = normalizeEnvValue(import.meta.env.VITE_USE_MOCKS);
const supabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

const isProduction = import.meta.env.PROD;
const environment = isProduction ? 'production' : 'development';

const isMockRequested = rawUseMocks === 'true';
const isSupabaseRequested = rawUseMocks === 'false';
const hasSupabaseConfig = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

const warnings: string[] = [];
const errors: string[] = [];

if (!isMockRequested && !isSupabaseRequested) {
  const message = '[api] VITE_USE_MOCKS debe definirse como "false" (Supabase) o "true" (mock).';
  if (isProduction) {
    errors.push(`${message} Producción no puede depender de un valor omitido o inválido.`);
  } else {
    warnings.push(`${message} Se usará mock solo en desarrollo.`);
  }
}

if (isSupabaseRequested && !hasSupabaseConfig) {
  const message = '[api] VITE_USE_MOCKS=false requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.';
  if (isProduction) {
    errors.push(`${message} Producción no puede continuar sin esas variables.`);
  } else {
    warnings.push(`${message} Se usará mock solo en desarrollo.`);
  }
}

if (isMockRequested && isProduction) {
  errors.push('[api] Producción no puede ejecutarse con VITE_USE_MOCKS=true. Configure VITE_USE_MOCKS=false y variables de Supabase válidas.');
}

if (isProduction && !hasSupabaseConfig) {
  errors.push('[api] Producción requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY válidas.');
}

const mode: ApiMode = isSupabaseRequested && hasSupabaseConfig ? 'supabase' : 'mock';
const uniqueWarnings = Array.from(new Set(warnings));
const uniqueErrors = Array.from(new Set(errors));
const status: RuntimeConfigStatus = uniqueErrors.length > 0 ? 'invalid' : 'ready';

export const runtimeConfig: RuntimeConfig = {
  mode,
  status,
  environment,
  isProduction,
  isMockRequested,
  isSupabaseRequested,
  hasSupabaseConfig,
  warnings: uniqueWarnings,
  errors: uniqueErrors,
  supabaseUrl,
  supabaseAnonKey,
};

export const runtimeSummary = {
  backend: runtimeConfig.mode,
  status: runtimeConfig.status,
  environment,
  hasSupabaseConfig,
  warnings: uniqueWarnings,
  errors: uniqueErrors,
};

if (typeof window !== 'undefined') {
  const logger = runtimeConfig.status === 'invalid' ? console.error : console.info;
  logger('[nutribalance/runtime]', runtimeSummary);
}
