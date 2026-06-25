import type { ActualizarEmpaqueProductoPayload, CrearEmpaqueProductoPayload, EmpaqueProducto } from '../../../../features/productos/types';
import { CapacidadesBigBag, CapacidadesBolsa } from '../../../../features/productos/types';
import { supabaseClient } from '../client';

const allowedCapacity = (tipo: string, capacidad: number): boolean =>
  (tipo === 'BOLSA' && CapacidadesBolsa.includes(capacidad as 15 | 20 | 25 | 40)) ||
  (tipo === 'BIG_BAG' && CapacidadesBigBag.includes(capacidad as 500 | 1000));

const mapRow = (row: { id: string; producto_id: string; tipo_empaque: string; capacidad_kg: number | string; activo: boolean | null; created_at: string; updated_at: string }): EmpaqueProducto => ({
  id: row.id,
  producto_id: row.producto_id,
  tipo_empaque: row.tipo_empaque as EmpaqueProducto['tipo_empaque'],
  capacidad_kg: Number(row.capacidad_kg) as EmpaqueProducto['capacidad_kg'],
  activo: Boolean(row.activo),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const supabaseEmpaquesProductoService = {
  async listByProducto(productoId: string): Promise<EmpaqueProducto[]> {
    const { data, error } = await supabaseClient
      .from('producto_empaques')
      .select('id,producto_id,tipo_empaque,capacidad_kg,activo,created_at,updated_at')
      .eq('producto_id', productoId)
      .order('tipo_empaque', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
  async create(payload: CrearEmpaqueProductoPayload): Promise<EmpaqueProducto> {
    if (!allowedCapacity(payload.tipo_empaque, payload.capacidad_kg)) {
      throw new Error('La capacidad no es válida para el tipo de empaque.');
    }
    const { data, error } = await supabaseClient
      .from('producto_empaques')
      .insert({ ...payload, activo: true })
      .select('id,producto_id,tipo_empaque,capacidad_kg,activo,created_at,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se pudo crear el empaque.');
    return mapRow(data);
  },
  async update(id: string, payload: ActualizarEmpaqueProductoPayload): Promise<EmpaqueProducto> {
    const { data: current } = await supabaseClient.from('producto_empaques').select('tipo_empaque,capacidad_kg').eq('id', id).maybeSingle<{ tipo_empaque: string; capacidad_kg: number }>();
    if (!current) throw new Error('No se encontró el empaque.');
    const tipo = payload.tipo_empaque ?? current.tipo_empaque;
    const capacidad = payload.capacidad_kg ?? current.capacidad_kg;
    if (!allowedCapacity(tipo, capacidad)) throw new Error('La capacidad no es válida para el tipo de empaque.');
    const { data, error } = await supabaseClient.from('producto_empaques').update({ ...payload }).eq('id', id).select('id,producto_id,tipo_empaque,capacidad_kg,activo,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar el empaque.');
    return mapRow(data);
  },
  async toggleActive(id: string, activo: boolean): Promise<EmpaqueProducto> {
    const { data, error } = await supabaseClient.from('producto_empaques').update({ activo }).eq('id', id).select('id,producto_id,tipo_empaque,capacidad_kg,activo,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar el estado del empaque.');
    return mapRow(data);
  },
};
