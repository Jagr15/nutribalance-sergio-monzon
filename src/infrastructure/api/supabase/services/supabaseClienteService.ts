import type { Cliente, ClienteCreatePayload, ClienteUpdatePayload, EstadoCliente } from '../../../../features/clientes/types/cliente';
import { supabaseClient } from '../client';

interface ClienteRow {
  legacy_uid: string | null;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  segmento: string | null;
  ubicacion: string | null;
  contacto: string | null;
  producto_principal: string | null;
  condicion_comercial: string | null;
  estado: string;
  observaciones: string | null;
  ultima_compra: string | null;
  saldo_pendiente_ars: number | null;
  esta_activo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

const normalizeEstado = (estado: string | null | undefined, estaActivo: boolean): EstadoCliente => {
  if (!estaActivo) return 'Suspendido';
  const normalized = (estado ?? '').trim().toLowerCase();
  if (normalized === 'en riesgo') return 'En riesgo';
  if (normalized === 'suspendido') return 'Suspendido';
  return 'Activo';
};

const mapRowToCliente = (row: ClienteRow): Cliente => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre: row.nombre,
  razonSocial: row.razon_social ?? undefined,
  cuit: row.cuit ?? undefined,
  email: row.email ?? undefined,
  telefono: row.telefono ?? undefined,
  direccion: row.direccion ?? undefined,
  localidad: row.localidad ?? undefined,
  provincia: row.provincia ?? undefined,
  segmento: row.segmento ?? undefined,
  ubicacion: row.ubicacion ?? undefined,
  contacto: row.contacto ?? undefined,
  productoPrincipal: row.producto_principal ?? undefined,
  condicionComercial: row.condicion_comercial ?? undefined,
  estado: normalizeEstado(row.estado, row.esta_activo),
  observaciones: row.observaciones ?? undefined,
  ultimaCompra: row.ultima_compra ?? undefined,
  saldoPendienteArs: Number(row.saldo_pendiente_ars ?? 0),
  estaActivo: row.esta_activo,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const buildInsertPayload = (payload: ClienteCreatePayload) => ({
  legacy_uid: `cli-${Math.floor(Math.random() * 1000000)}`,
  nombre: payload.nombre,
  razon_social: payload.razonSocial ?? payload.nombre,
  cuit: payload.cuit ?? null,
  email: payload.email ?? null,
  telefono: payload.telefono ?? null,
  direccion: payload.direccion ?? null,
  localidad: payload.localidad ?? null,
  provincia: payload.provincia ?? null,
  segmento: payload.segmento ?? null,
  ubicacion: payload.ubicacion ?? null,
  contacto: payload.contacto ?? null,
  producto_principal: payload.productoPrincipal ?? null,
  condicion_comercial: payload.condicionComercial ?? null,
  estado: payload.estado,
  observaciones: payload.observaciones ?? null,
  ultima_compra: payload.ultimaCompra ?? null,
  saldo_pendiente_ars: payload.saldoPendienteArs,
  esta_activo: payload.estaActivo,
});

const buildUpdatePayload = (payload: ClienteUpdatePayload) => ({
  ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
  ...(payload.razonSocial !== undefined ? { razon_social: payload.razonSocial } : {}),
  ...(payload.cuit !== undefined ? { cuit: payload.cuit } : {}),
  ...(payload.email !== undefined ? { email: payload.email } : {}),
  ...(payload.telefono !== undefined ? { telefono: payload.telefono } : {}),
  ...(payload.direccion !== undefined ? { direccion: payload.direccion } : {}),
  ...(payload.localidad !== undefined ? { localidad: payload.localidad } : {}),
  ...(payload.provincia !== undefined ? { provincia: payload.provincia } : {}),
  ...(payload.segmento !== undefined ? { segmento: payload.segmento } : {}),
  ...(payload.ubicacion !== undefined ? { ubicacion: payload.ubicacion } : {}),
  ...(payload.contacto !== undefined ? { contacto: payload.contacto } : {}),
  ...(payload.productoPrincipal !== undefined ? { producto_principal: payload.productoPrincipal } : {}),
  ...(payload.condicionComercial !== undefined ? { condicion_comercial: payload.condicionComercial } : {}),
  ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
  ...(payload.observaciones !== undefined ? { observaciones: payload.observaciones } : {}),
  ...(payload.ultimaCompra !== undefined ? { ultima_compra: payload.ultimaCompra } : {}),
  ...(payload.saldoPendienteArs !== undefined ? { saldo_pendiente_ars: payload.saldoPendienteArs } : {}),
  ...(payload.estaActivo !== undefined ? { esta_activo: payload.estaActivo } : {}),
});

const selectClause =
  'legacy_uid,nombre,razon_social,cuit,email,telefono,direccion,localidad,provincia,segmento,ubicacion,contacto,producto_principal,condicion_comercial,estado,observaciones,ultima_compra,saldo_pendiente_ars,esta_activo,created_at,updated_at';

export const supabaseClienteService = {
  async getAll(): Promise<Cliente[]> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select(selectClause)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRowToCliente);
  },

  async getById(uid: string): Promise<Cliente | undefined> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select(selectClause)
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .maybeSingle<ClienteRow>();

    if (error) throw error;
    return data ? mapRowToCliente(data) : undefined;
  },

  async create(payload: Omit<Cliente, 'uid' | 'createdAt' | 'updatedAt'>): Promise<Cliente> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .insert(buildInsertPayload(payload))
      .select(selectClause)
      .single<ClienteRow>();

    if (error) throw error;
    return mapRowToCliente(data);
  },

  async update(uid: string, payload: Partial<Omit<Cliente, 'uid'>>): Promise<Cliente> {
    const { data, error } = await supabaseClient
      .from('clientes')
      .update(buildUpdatePayload(payload))
      .eq('legacy_uid', uid)
      .is('deleted_at', null)
      .select(selectClause)
      .single<ClienteRow>();

    if (error) throw error;
    return mapRowToCliente(data);
  },

  async delete(uid: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('clientes')
      .update({ esta_activo: false, estado: 'Suspendido' })
      .eq('legacy_uid', uid)
      .is('deleted_at', null);

    if (error) throw error;
    return true;
  },
};
