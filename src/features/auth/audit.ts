import { supabaseClient } from '../../infrastructure/api/supabase/client';
import { getSessionUser } from './session';
import type { AppModule } from './permissions';

export const auditAction = async (params: {
  modulo: AppModule;
  accion: string;
  entidad?: string;
  entidad_ref?: string;
  payload?: Record<string, unknown>;
}) => {
  const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
  const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (useMocks || !hasSupabaseConfig) return;

  try {
    const user = getSessionUser();
    await supabaseClient.from('auditoria_acciones').insert({
      legacy_uid: `aud-${Math.random().toString(36).slice(2, 10)}`,
      usuario_login: user.login,
      usuario_nombre: user.name,
      rol: user.role,
      modulo: params.modulo,
      accion: params.accion,
      entidad: params.entidad,
      entidad_ref: params.entidad_ref,
      payload: params.payload ?? {},
    });
  } catch (error) {
    console.error('No se pudo registrar auditoría:', error);
  }
};
