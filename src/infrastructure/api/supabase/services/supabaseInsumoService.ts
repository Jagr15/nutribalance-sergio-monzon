import type { Insumo, StockMateriaPrima } from '../../../../features/insumos/types';
import { supabaseClient } from '../client';

interface InsumoRow {
  legacy_uid: string | null;
  nombre: string;
  unidad_medida: string;
  umbral_alerta: number;
  ref_costo_unitario: number | null;
  categoria: string;
}

const mapInsumo = (row: InsumoRow): Insumo => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre: row.nombre,
  unidad_medida: row.unidad_medida as Insumo['unidad_medida'],
  umbral_alerta: Number(row.umbral_alerta),
  ref_costo_unitario: row.ref_costo_unitario ?? undefined,
  categoria: row.categoria as Insumo['categoria'],
});

export const supabaseInsumoService = {
  async getAllInsumos(): Promise<Insumo[]> {
    const { data, error } = await supabaseClient
      .from('insumos')
      .select('legacy_uid,nombre,unidad_medida,umbral_alerta,ref_costo_unitario,categoria')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapInsumo);
  },

  async createInsumo(payload: Omit<Insumo, 'uid'>): Promise<Insumo> {
    const legacyUid = `i-${Math.floor(Math.random() * 1000000)}`;
    const { data, error } = await supabaseClient
      .from('insumos')
      .insert({
        legacy_uid: legacyUid,
        nombre: payload.nombre,
        unidad_medida: payload.unidad_medida,
        umbral_alerta: payload.umbral_alerta,
        ref_costo_unitario: payload.ref_costo_unitario ?? null,
        categoria: payload.categoria,
      })
      .select('legacy_uid,nombre,unidad_medida,umbral_alerta,ref_costo_unitario,categoria')
      .single<InsumoRow>();

    if (error) throw error;
    return mapInsumo(data);
  },

  async updateInsumo(uid: string, payload: Partial<Insumo>): Promise<Insumo> {
    const { data, error } = await supabaseClient
      .from('insumos')
      .update({
        nombre: payload.nombre,
        unidad_medida: payload.unidad_medida,
        umbral_alerta: payload.umbral_alerta,
        ref_costo_unitario: payload.ref_costo_unitario,
        categoria: payload.categoria,
      })
      .eq('legacy_uid', uid)
      .select('legacy_uid,nombre,unidad_medida,umbral_alerta,ref_costo_unitario,categoria')
      .single<InsumoRow>();

    if (error) throw error;
    return mapInsumo(data);
  },

  async deleteInsumo(uid: string): Promise<void> {
    const { error } = await supabaseClient
      .from('insumos')
      .update({ deleted_at: new Date().toISOString(), esta_activo: false })
      .eq('legacy_uid', uid);

    if (error) throw error;
  },

  // Sprint 1 usa servicio dedicado stockMP; aquí mantenemos interfaz legacy para compatibilidad.
  async findAllStock(): Promise<StockMateriaPrima[]> {
    return [];
  },

  async createStock(data: StockMateriaPrima): Promise<StockMateriaPrima> {
    return data;
  },

  async updateStock(_uid: string, data: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> {
    return data as StockMateriaPrima;
  },

  async deleteStock(uid: string): Promise<void> {
    void uid;
  },
};
