const rawUseMocks = import.meta.env.VITE_USE_MOCKS;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isProduction = import.meta.env.PROD;
const environment = isProduction ? 'production' : 'development';

const hasSupabaseConfig = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
const missingVariables = [
  !rawUseMocks ? 'VITE_USE_MOCKS' : null,
  !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter((item): item is string => Boolean(item));

const fail = (message: string): never => {
  throw new Error(message);
};

const resolveApiMode = () => {
  if (rawUseMocks === 'false') {
    if (!hasSupabaseConfig) {
      const message = '[api] VITE_USE_MOCKS=false requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.';
      if (isProduction) fail(`${message} Producción no puede continuar sin esas variables.`);
      console.warn(`${message} Se usará mock solo en desarrollo.`);
      return 'mock' as const;
    }

    return 'supabase' as const;
  }

  if (rawUseMocks === 'true') {
    if (isProduction) {
      fail('[api] Producción no puede ejecutarse con VITE_USE_MOCKS=true. Configure VITE_USE_MOCKS=false y variables de Supabase válidas.');
    }

    return 'mock' as const;
  }

  const message = '[api] VITE_USE_MOCKS debe definirse explícitamente como "false" (Supabase) o "true" (mock).';
  if (isProduction) {
    fail(`${message} Producción no puede depender de un valor omitido.`);
  }

  console.warn(`${message} Se usará mock solo en desarrollo.`);
  return 'mock' as const;
};

export const runtimeConfig = {
  mode: resolveApiMode(),
  hasSupabaseConfig,
  environment,
  missingVariables,
  supabaseUrl,
  supabaseAnonKey,
};

export const runtimeSummary = {
  backend: runtimeConfig.mode,
  environment,
  hasSupabaseConfig,
  missingVariables,
};

if (typeof window !== 'undefined') {
  console.info('[nutribalance/runtime]', runtimeSummary);
}
