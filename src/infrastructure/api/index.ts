import { mockAdapter } from './adapters/mockAdapter';
import { supabaseAdapter } from './adapters/supabaseAdapter';
import type { ApiServices } from './types';

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

const shouldUseSupabase = !useMocks && hasSupabaseConfig;

if (!useMocks && !hasSupabaseConfig) {
  console.warn('[api] VITE_USE_MOCKS=false pero faltan variables de Supabase. Se usan mocks.');
}

export const ApiService: ApiServices = shouldUseSupabase ? supabaseAdapter : mockAdapter;
