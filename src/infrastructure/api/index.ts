import { mockAdapter } from './adapters/mockAdapter';
import { supabaseAdapter } from './adapters/supabaseAdapter';
import { runtimeConfig } from './runtimeConfig';
import type { ApiServices } from './types';

export const ApiService: ApiServices = runtimeConfig.mode === 'supabase' ? supabaseAdapter : mockAdapter;
