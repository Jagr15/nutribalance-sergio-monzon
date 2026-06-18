import { createClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../runtimeConfig';

const failSafeClient = new Proxy(
  {},
  {
    get() {
      const message = runtimeConfig.status === 'invalid'
        ? `[supabase] Configuración inválida: ${runtimeConfig.errors.join(' ')}`
        : '[supabase] Cliente no disponible. Activa mocks o configura variables de Supabase.';
      throw new Error(message);
    },
  }
);

export const supabaseClient = runtimeConfig.mode === 'supabase'
  ? createClient(runtimeConfig.supabaseUrl as string, runtimeConfig.supabaseAnonKey as string)
  : (failSafeClient as ReturnType<typeof createClient>);
