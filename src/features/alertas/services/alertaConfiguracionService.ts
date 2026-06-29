import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import type { AlertaConfiguracion } from '../types/alerta';

type AlertConfigRow = AlertaConfiguracion;

export const alertaConfiguracionService = {
  async getAll(): Promise<AlertaConfiguracion[]> {
    const { data, error } = await supabaseClient
      .from('alerta_configuraciones')
      .select('id,modulo,entidad_tipo,entidad_id,nombre,umbral_minimo,umbral_critico,unidad,dias_anticipacion,severidad,esta_activa,created_at,updated_at')
      .order('modulo', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return (data ?? []) as AlertConfigRow[];
  },

  async save(payload: Partial<AlertaConfiguracion> & Pick<AlertaConfiguracion, 'modulo' | 'entidad_tipo' | 'nombre'>): Promise<AlertaConfiguracion> {
    const { data, error } = await supabaseClient
      .from('alerta_configuraciones')
      .upsert({
        id: payload.id,
        modulo: payload.modulo,
        entidad_tipo: payload.entidad_tipo,
        entidad_id: payload.entidad_id ?? null,
        nombre: payload.nombre,
        umbral_minimo: payload.umbral_minimo ?? null,
        umbral_critico: payload.umbral_critico ?? null,
        unidad: payload.unidad ?? null,
        dias_anticipacion: payload.dias_anticipacion ?? null,
        severidad: payload.severidad ?? 'amarillo',
        esta_activa: payload.esta_activa ?? true,
      }, { onConflict: 'modulo,entidad_tipo,entidad_id,nombre' })
      .select('id,modulo,entidad_tipo,entidad_id,nombre,umbral_minimo,umbral_critico,unidad,dias_anticipacion,severidad,esta_activa,created_at,updated_at')
      .single();

    if (error) throw error;
    return data as AlertaConfiguracion;
  },

  async toggleActive(id: string, esta_activa: boolean): Promise<void> {
    const { error } = await supabaseClient
      .from('alerta_configuraciones')
      .update({ esta_activa })
      .eq('id', id);
    if (error) throw error;
  },
};
