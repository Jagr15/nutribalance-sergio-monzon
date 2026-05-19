import type { Silo } from '../../../../features/silos/types';
import { supabaseClient } from '../client';

interface SiloRow {
  legacy_uid: string | null;
  nombre: string;
  descripcion: string;
}

const mapSilo = (row: SiloRow): Silo => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre: row.nombre,
  descripcion: row.descripcion,
});

export const supabaseSiloService = {
  async getAll(): Promise<Silo[]> {
    const { data, error } = await supabaseClient
      .from('silos')
      .select('legacy_uid,nombre,descripcion')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSilo);
  },

  async getById(uid: string): Promise<Silo | undefined> {
    const { data, error } = await supabaseClient
      .from('silos')
      .select('legacy_uid,nombre,descripcion')
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .maybeSingle<SiloRow>();

    if (error) throw error;
    return data ? mapSilo(data) : undefined;
  },

  async create(payload: Omit<Silo, 'uid'>): Promise<Silo> {
    const legacyUid = `silo-${Math.random().toString(36).slice(2, 11)}`;
    const { data, error } = await supabaseClient
      .from('silos')
      .insert({
        legacy_uid: legacyUid,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
      })
      .select('legacy_uid,nombre,descripcion')
      .single<SiloRow>();

    if (error) throw error;
    return mapSilo(data);
  },

  async update(uid: string, payload: Partial<Silo>): Promise<Silo> {
    const { data, error } = await supabaseClient
      .from('silos')
      .update({ nombre: payload.nombre, descripcion: payload.descripcion })
      .eq('legacy_uid', uid)
      .select('legacy_uid,nombre,descripcion')
      .single<SiloRow>();

    if (error) throw error;
    return mapSilo(data);
  },

  async delete(uid: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('silos')
      .update({ deleted_at: new Date().toISOString(), esta_activo: false })
      .eq('legacy_uid', uid);

    if (error) throw error;
    return true;
  },
};
