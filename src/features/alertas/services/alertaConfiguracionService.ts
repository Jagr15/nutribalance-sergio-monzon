import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import type { AlertaConfiguracion } from '../types/alerta';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';

const isMockMode = () => runtimeConfig.mode === 'mock';

type AlertConfigRow = AlertaConfiguracion;
let mockConfigs: AlertaConfiguracion[] = [];

const getMockConfigs = (): AlertaConfiguracion[] => {
  const STORAGE_KEY = 'nutribalance_alerta_configuraciones';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      mockConfigs = JSON.parse(raw);
      return mockConfigs;
    }
  } catch {
    // ignore
  }

  if (mockConfigs.length === 0) {
    mockConfigs = [
      {
        id: 'cfg-1',
        modulo: 'stock',
        entidad_tipo: 'insumo',
        entidad_id: 'stk-mp-maiz',
        nombre: 'Umbral Maíz',
        umbral_minimo: 5000,
        umbral_critico: 2000,
        unidad: 'KG',
        dias_anticipacion: null,
        severidad: 'amarillo',
        esta_activa: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];
    saveMockConfigs(mockConfigs);
  }
  return mockConfigs;
};

const saveMockConfigs = (configs: AlertaConfiguracion[]) => {
  localStorage.setItem('nutribalance_alerta_configuraciones', JSON.stringify(configs));
};

export const alertaConfiguracionService = {
  async getAll(): Promise<AlertaConfiguracion[]> {
    if (isMockMode()) {
      return getMockConfigs();
    }

    const { data, error } = await supabaseClient
      .from('alerta_configuraciones')
      .select('id,modulo,entidad_tipo,entidad_id,nombre,umbral_minimo,umbral_critico,unidad,dias_anticipacion,severidad,esta_activa,created_at,updated_at')
      .order('modulo', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...row,
      umbral_minimo: row.umbral_minimo != null ? Number(row.umbral_minimo) : null,
      umbral_critico: row.umbral_critico != null ? Number(row.umbral_critico) : null,
    })) as AlertConfigRow[];
  },

  async save(payload: Partial<AlertaConfiguracion> & Pick<AlertaConfiguracion, 'modulo' | 'entidad_tipo' | 'nombre'>): Promise<AlertaConfiguracion> {
    if (isMockMode()) {
      const list = getMockConfigs();
      const existingIdx = list.findIndex(c => c.id === payload.id || (c.modulo === payload.modulo && c.entidad_tipo === payload.entidad_tipo && c.nombre === payload.nombre));
      
      const newConfig: AlertaConfiguracion = {
        id: payload.id || `cfg-${Math.floor(Math.random() * 1000000)}`,
        modulo: payload.modulo,
        entidad_tipo: payload.entidad_tipo,
        entidad_id: payload.entidad_id ?? null,
        nombre: payload.nombre,
        umbral_minimo: payload.umbral_minimo != null ? Number(payload.umbral_minimo) : null,
        umbral_critico: payload.umbral_critico != null ? Number(payload.umbral_critico) : null,
        unidad: payload.unidad ?? null,
        dias_anticipacion: payload.dias_anticipacion ?? null,
        severidad: payload.severidad ?? 'amarillo',
        esta_activa: payload.esta_activa ?? true,
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIdx > -1) {
        list[existingIdx] = newConfig;
      } else {
        list.push(newConfig);
      }
      saveMockConfigs(list);
      return newConfig;
    }

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
    return {
      ...data,
      umbral_minimo: data.umbral_minimo != null ? Number(data.umbral_minimo) : null,
      umbral_critico: data.umbral_critico != null ? Number(data.umbral_critico) : null,
    } as AlertaConfiguracion;
  },

  async toggleActive(id: string, esta_activa: boolean): Promise<void> {
    if (isMockMode()) {
      const list = getMockConfigs();
      const item = list.find(c => c.id === id);
      if (item) {
        item.esta_activa = esta_activa;
        saveMockConfigs(list);
      }
      return;
    }

    const { error } = await supabaseClient
      .from('alerta_configuraciones')
      .update({ esta_activa })
      .eq('id', id);
    if (error) throw error;
  },
};
