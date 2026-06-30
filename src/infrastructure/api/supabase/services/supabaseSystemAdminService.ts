import { supabaseClient } from '../../supabase/client';
import type { ResetSystemResult } from '../../types';

export const supabaseSystemAdminService = {
  async resetTotalSoloUsuarios(): Promise<ResetSystemResult> {
    const { data, error } = await supabaseClient.rpc('reset_total_solo_usuarios');
    if (error) throw error;

    const payload = (data as Partial<ResetSystemResult> | null) ?? {};
    return {
      ok: Boolean(payload.ok),
      tablas_limpiadas: Array.isArray(payload.tablas_limpiadas) ? payload.tablas_limpiadas : [],
      tablas_totales: typeof payload.tablas_totales === 'number' ? payload.tablas_totales : 0,
    };
  },
};
