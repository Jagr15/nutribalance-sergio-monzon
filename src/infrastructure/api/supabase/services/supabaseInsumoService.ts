import type { Insumo, StockMateriaPrima } from '../../../../features/insumos/types';
import { supabaseClient } from '../client';

interface InsumoRow {
  legacy_uid: string | null;
  nombre: string;
  unidad_medida: string;
  umbral_alerta: number;
  costo: number | null;
  unidad_costo: string | null;
  ref_costo_unitario: number | null;
  costo_por_kg: number | null;
  costo_por_tonelada: number | null;
  proteina_bruta_pct: number | null;
  humedad_pct: number | null;
  fibra_pct: number | null;
  grasa_pct: number | null;
  cenizas_pct: number | null;
  unidad_base: string | null;
  observaciones: string | null;
  categoria: string;
}

const toNullableNumber = (value: number | null | undefined) => (value === undefined ? undefined : value);

const mapInsumo = (row: InsumoRow): Insumo => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  nombre: row.nombre,
  unidad_medida: row.unidad_medida as Insumo['unidad_medida'],
  umbral_alerta: Number(row.umbral_alerta),
  costo: row.costo ?? row.costo_por_kg ?? row.ref_costo_unitario ?? undefined,
  unidad_costo: (row.unidad_costo as Insumo['unidad_costo']) ?? 'KG',
  ref_costo_unitario: row.ref_costo_unitario ?? undefined,
  costo_por_kg: row.costo_por_kg ?? row.ref_costo_unitario ?? undefined,
  costo_por_tonelada: row.costo_por_tonelada ?? (((row.costo_por_kg ?? row.ref_costo_unitario ?? 0) * 1000) || undefined),
  proteina_bruta_pct: row.proteina_bruta_pct ?? undefined,
  humedad_pct: row.humedad_pct ?? undefined,
  fibra_pct: row.fibra_pct ?? undefined,
  grasa_pct: row.grasa_pct ?? undefined,
  cenizas_pct: row.cenizas_pct ?? undefined,
  unidad_base: (row.unidad_base as Insumo['unidad_base']) ?? undefined,
  observaciones: row.observaciones ?? undefined,
  categoria: row.categoria as Insumo['categoria'],
});

export const supabaseInsumoService = {
  async getAllInsumos(): Promise<Insumo[]> {
    const { data, error } = await supabaseClient
      .from('insumos')
      .select('legacy_uid,nombre,unidad_medida,umbral_alerta,costo,unidad_costo,ref_costo_unitario,costo_por_kg,costo_por_tonelada,proteina_bruta_pct,humedad_pct,fibra_pct,grasa_pct,cenizas_pct,unidad_base,observaciones,categoria')
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
  costo: payload.costo ?? payload.costo_por_kg ?? payload.ref_costo_unitario ?? null,
  unidad_costo: payload.unidad_costo ?? 'KG',
  ref_costo_unitario: payload.costo_por_kg ?? payload.ref_costo_unitario ?? null,
  costo_por_kg: payload.costo_por_kg ?? payload.ref_costo_unitario ?? null,
  costo_por_tonelada: payload.costo_por_tonelada ?? (((payload.costo_por_kg ?? payload.ref_costo_unitario ?? 0) * 1000) || null),
  proteina_bruta_pct: payload.proteina_bruta_pct ?? null,
  humedad_pct: payload.humedad_pct ?? null,
  fibra_pct: payload.fibra_pct ?? null,
  grasa_pct: payload.grasa_pct ?? null,
        cenizas_pct: payload.cenizas_pct ?? null,
        unidad_base: payload.unidad_base ?? null,
        observaciones: payload.observaciones ?? null,
        categoria: payload.categoria,
      })
      .select('legacy_uid,nombre,unidad_medida,umbral_alerta,costo,unidad_costo,ref_costo_unitario,costo_por_kg,costo_por_tonelada,proteina_bruta_pct,humedad_pct,fibra_pct,grasa_pct,cenizas_pct,unidad_base,observaciones,categoria')
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
        costo: payload.costo ?? payload.costo_por_kg ?? payload.ref_costo_unitario,
        unidad_costo: payload.unidad_costo,
        ref_costo_unitario: payload.costo_por_kg ?? payload.ref_costo_unitario,
        costo_por_kg: payload.costo_por_kg ?? payload.ref_costo_unitario,
        costo_por_tonelada: payload.costo_por_tonelada ?? (((payload.costo_por_kg ?? payload.ref_costo_unitario ?? 0) * 1000) || null),
        proteina_bruta_pct: toNullableNumber(payload.proteina_bruta_pct),
        humedad_pct: payload.humedad_pct,
        fibra_pct: payload.fibra_pct,
        grasa_pct: payload.grasa_pct,
        cenizas_pct: payload.cenizas_pct,
        unidad_base: payload.unidad_base,
        observaciones: payload.observaciones,
        categoria: payload.categoria,
      })
      .eq('legacy_uid', uid)
      .select('legacy_uid,nombre,unidad_medida,umbral_alerta,costo,unidad_costo,ref_costo_unitario,costo_por_kg,costo_por_tonelada,proteina_bruta_pct,humedad_pct,fibra_pct,grasa_pct,cenizas_pct,unidad_base,observaciones,categoria')
      .single<InsumoRow>();

    if (error) throw error;
    return mapInsumo(data);
  },

  async deleteInsumo(uid: string): Promise<void> {
    const { data: insumo, error: insumoErr } = await supabaseClient
      .from('insumos')
      .select('id')
      .eq('legacy_uid', uid)
      .maybeSingle<{ id: string }>();

    if (insumoErr) throw insumoErr;
    if (!insumo) {
      throw new Error('Insumo no encontrado');
    }

    // Check dependency in stock_lotes_mp (only active lots)
    const { count: lotCount, error: lotErr } = await supabaseClient
      .from('stock_lotes_mp')
      .select('id', { count: 'exact', head: true })
      .eq('insumo_id', insumo.id)
      .is('deleted_at', null);
    if (lotErr) throw lotErr;

    // Check dependency in formula_ingredientes
    const { count: ingredientCount, error: ingredientErr } = await supabaseClient
      .from('formula_ingredientes')
      .select('id', { count: 'exact', head: true })
      .eq('insumo_id', insumo.id);
    if (ingredientErr) throw ingredientErr;

    // Check dependency in orden_consumo_lotes
    const { count: consumoCount, error: consumoErr } = await supabaseClient
      .from('orden_consumo_lotes')
      .select('id', { count: 'exact', head: true })
      .eq('insumo_id', insumo.id);
    if (consumoErr) throw consumoErr;

    if ((lotCount ?? 0) > 0 || (ingredientCount ?? 0) > 0 || (consumoCount ?? 0) > 0) {
      throw new Error('No se puede eliminar el insumo porque está siendo utilizado en recetas, lotes de stock u órdenes de producción.');
    }

    const { error } = await supabaseClient
      .from('insumos')
      .update({ deleted_at: new Date().toISOString(), esta_activo: false })
      .eq('id', insumo.id);

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
