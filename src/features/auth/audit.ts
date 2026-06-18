import { supabaseClient } from '../../infrastructure/api/supabase/client';
import { runtimeConfig } from '../../infrastructure/api/runtimeConfig';
import { getSessionUser } from './session';
import type { AppModule } from './permissions';

export const auditAction = async (params: {
  modulo: AppModule;
  accion: string;
  entidad?: string;
  entidad_ref?: string;
  payload?: Record<string, unknown>;
}) => {
  if (runtimeConfig.mode !== 'supabase') return;

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
