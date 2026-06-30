import type { ResetSystemResult } from '../../types';

export const mockSystemAdminService = {
  async resetTotalSoloUsuarios(): Promise<ResetSystemResult> {
    throw new Error('La acción solo está disponible en entorno Supabase.');
  },
};
