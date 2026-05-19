import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
const hasSupabaseConfig = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

if (!useMocks && !hasSupabaseConfig) {
  console.warn('[supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no configuradas.');
}

const failSafeClient = new Proxy(
  {},
  {
    get() {
      throw new Error('[supabase] Cliente no disponible. Activa mocks o configura variables de Supabase.');
    },
  }
);

export const supabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : (failSafeClient as ReturnType<typeof createClient>);
