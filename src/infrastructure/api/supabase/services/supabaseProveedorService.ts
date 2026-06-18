import type { Proveedor } from '../../../../features/proveedores/types';
import { supabaseClient } from '../client';

interface ProveedorRow {
  legacy_uid: string | null;
  nombre_empresa: string;
  producto_que_provee: string | null;
  contacto_nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  documento: string | null;
  esta_activo: boolean;
}

const mapRowToProveedor = (row: ProveedorRow): Proveedor => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre_empresa: row.nombre_empresa,
  producto_que_provee: row.producto_que_provee ?? undefined,
  contacto_nombre: row.contacto_nombre,
  telefono: row.telefono,
  email: row.email,
  direccion: row.direccion,
  documento: row.documento ?? undefined,
  esta_activo: row.esta_activo,
});

export const supabaseProveedorService = {
  async getAll(): Promise<Proveedor[]> {
    const { data, error } = await supabaseClient
      .from('proveedores')
      .select('legacy_uid,nombre_empresa,producto_que_provee,contacto_nombre,telefono,email,direccion,documento,esta_activo')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRowToProveedor);
  },

  async getById(uid: string): Promise<Proveedor | undefined> {
    const { data, error } = await supabaseClient
      .from('proveedores')
      .select('legacy_uid,nombre_empresa,producto_que_provee,contacto_nombre,telefono,email,direccion,documento,esta_activo')
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .maybeSingle<ProveedorRow>();

    if (error) throw error;
    return data ? mapRowToProveedor(data) : undefined;
  },

  async create(payload: Omit<Proveedor, 'uid'>): Promise<Proveedor> {
    const legacyUid = `p-${Math.floor(Math.random() * 1000000)}`;
    const { data, error } = await supabaseClient
      .from('proveedores')
      .insert({
        legacy_uid: legacyUid,
        nombre_empresa: payload.nombre_empresa,
        producto_que_provee: payload.producto_que_provee ?? null,
        contacto_nombre: payload.contacto_nombre,
        telefono: payload.telefono,
        email: payload.email,
        direccion: payload.direccion,
        documento: payload.documento ?? null,
        esta_activo: payload.esta_activo,
      })
      .select('legacy_uid,nombre_empresa,producto_que_provee,contacto_nombre,telefono,email,direccion,documento,esta_activo')
      .single<ProveedorRow>();

    if (error) throw error;
    return mapRowToProveedor(data);
  },

  async update(uid: string, payload: Partial<Proveedor>): Promise<Proveedor> {
    const { data, error } = await supabaseClient
      .from('proveedores')
      .update({
        nombre_empresa: payload.nombre_empresa,
        producto_que_provee: payload.producto_que_provee,
        contacto_nombre: payload.contacto_nombre,
        telefono: payload.telefono,
        email: payload.email,
        direccion: payload.direccion,
        documento: payload.documento,
        esta_activo: payload.esta_activo,
      })
      .eq('legacy_uid', uid)
      .select('legacy_uid,nombre_empresa,producto_que_provee,contacto_nombre,telefono,email,direccion,documento,esta_activo')
      .single<ProveedorRow>();

    if (error) throw error;
    return mapRowToProveedor(data);
  },

  async delete(uid: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('proveedores')
      .update({ deleted_at: new Date().toISOString(), esta_activo: false })
      .eq('legacy_uid', uid);

    if (error) throw error;
    return true;
  },
};
