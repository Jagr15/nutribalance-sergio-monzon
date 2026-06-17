import { createClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../runtimeConfig';

const failSafeClient = new Proxy(
  {},
  {
    get() {
      throw new Error('[supabase] Cliente no disponible. Activa mocks o configura variables de Supabase.');
    },
  }
);

export const supabaseClient = runtimeConfig.mode === 'supabase'
  ? createClient(runtimeConfig.supabaseUrl as string, runtimeConfig.supabaseAnonKey as string)
  : (failSafeClient as ReturnType<typeof createClient>);
