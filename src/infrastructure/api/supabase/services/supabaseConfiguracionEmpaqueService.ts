import type { ActualizarConfiguracionEmpaquePayload, ConfiguracionEmpaque, CrearConfiguracionEmpaquePayload } from '../../../../features/productos/types/configuracionEmpaque';
import { CapacidadesBigBag, CapacidadesBolsa } from '../../../../features/productos/types/configuracionEmpaque';
import { supabaseClient } from '../client';

const allowedCapacity = (tipo: string, capacidad: number): boolean =>
  (tipo === 'BOLSA' && CapacidadesBolsa.includes(capacidad as 15 | 20 | 25 | 40)) ||
  (tipo === 'BIG_BAG' && CapacidadesBigBag.includes(capacidad as 500 | 1000));

const mapRow = (row: { id: string; tipo_empaque: string; capacidad_kg: number | string; esta_activo: boolean | null; created_at: string; updated_at: string }): ConfiguracionEmpaque => ({
  id: row.id,
  producto_id: null,
  tipo_empaque: row.tipo_empaque as ConfiguracionEmpaque['tipo_empaque'],
  capacidad_kg: Number(row.capacidad_kg) as ConfiguracionEmpaque['capacidad_kg'],
  esta_activo: Boolean(row.esta_activo),
  activo: Boolean(row.esta_activo),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const supabaseConfiguracionEmpaqueService = {
  async getAll(): Promise<ConfiguracionEmpaque[]> {
    const { data, error } = await supabaseClient
      .from('configuracion_empaques')
      .select('id,tipo_empaque,capacidad_kg,esta_activo,created_at,updated_at')
      .order('tipo_empaque', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
  async listByProducto(): Promise<ConfiguracionEmpaque[]> {
    return this.getAll();
  },
  async create(payload: CrearConfiguracionEmpaquePayload): Promise<ConfiguracionEmpaque> {
    if (!allowedCapacity(payload.tipo_empaque, payload.capacidad_kg)) throw new Error('La capacidad no es válida para el tipo de empaque.');
    const { data, error } = await supabaseClient.from('configuracion_empaques')
      .insert({ tipo_empaque: payload.tipo_empaque, capacidad_kg: payload.capacidad_kg, esta_activo: true })
      .select('id,tipo_empaque,capacidad_kg,esta_activo,created_at,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se pudo crear la configuración.');
    return mapRow(data);
  },
  async update(id: string, payload: ActualizarConfiguracionEmpaquePayload): Promise<ConfiguracionEmpaque> {
    const { data, error } = await supabaseClient.from('configuracion_empaques').update({ ...payload }).eq('id', id).select('id,tipo_empaque,capacidad_kg,esta_activo,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar la configuración.');
    return mapRow(data);
  },
  async toggleActive(id: string, esta_activo: boolean): Promise<ConfiguracionEmpaque> {
    const { data, error } = await supabaseClient.from('configuracion_empaques').update({ esta_activo }).eq('id', id).select('id,tipo_empaque,capacidad_kg,esta_activo,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar el estado.');
    return mapRow(data);
  },
};
