import type { Silo } from '../../../../features/silos/types';
import { supabaseClient } from '../client';

interface SiloRow {
  id: string;
  legacy_uid: string | null;
  nombre: string;
  descripcion: string;
  tipo_uso: 'MATERIA_PRIMA' | 'PRODUCTO_TERMINADO' | null;
  esta_activo: boolean | null;
  deleted_at: string | null;
}



type StockPTRow = {
  silo_id: string | null;
  id_silo_legacy: string | null;
  nombre_silo: string | null;
  cantidad_total: number | string | null;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const toNumber = (value: unknown) => Number(value ?? 0);

const mapSilo = (row: SiloRow, stockActualTon = 0): Silo => ({
  uid: row.legacy_uid ?? row.id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  tipo_uso: row.tipo_uso ?? 'MATERIA_PRIMA',
  esta_activo: row.esta_activo ?? row.deleted_at === null,
  stock_actual_ton: Number(stockActualTon.toFixed(2)),
});

const buildStockActualBySilo = async () => {
  const [mpResult, ptResult, silosResult] = await Promise.all([
    supabaseClient
      .from('stock_lotes_mp')
      .select('ubicacion,cantidad_actual,cantidad_comprometida,insumo_id,insumos(unidad_medida)')
      .is('deleted_at', null),
    supabaseClient
      .from('stock_pt')
      .select('silo_id,id_silo_legacy,nombre_silo,cantidad_total')
      .is('deleted_at', null),
    supabaseClient
      .from('silos')
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .is('deleted_at', null),
  ]);

  if (mpResult.error) throw mpResult.error;
  if (ptResult.error) throw ptResult.error;
  if (silosResult.error) throw silosResult.error;

  const mpStockByName = new Map<string, number>();
  const ptStockByUid = new Map<string, number>();
  const ptStockByName = new Map<string, number>();
  const ptStockByDbId = new Map<string, number>();

  (mpResult.data ?? []).forEach((row) => {
    const mp = row as any;
    const location = mp.ubicacion?.trim();
    if (!location) return;

    const unit = mp.insumos?.unidad_medida || 'KG';
    const isTons = ['tonelada', 'toneladas', 'tn'].includes(unit.trim().toLowerCase());
    
    const available = Math.max(0, toNumber(mp.cantidad_actual) - toNumber(mp.cantidad_comprometida));
    const availableKg = isTons ? available * 1000 : available;

    mpStockByName.set(normalizeText(location), (mpStockByName.get(normalizeText(location)) ?? 0) + availableKg);
  });

  (ptResult.data ?? []).forEach((row) => {
    const pt = row as StockPTRow;
    const saldoKg = Math.max(0, toNumber(pt.cantidad_total));
    if (pt.silo_id) {
      ptStockByDbId.set(pt.silo_id, (ptStockByDbId.get(pt.silo_id) ?? 0) + saldoKg);
    }
    if (pt.id_silo_legacy) {
      ptStockByUid.set(pt.id_silo_legacy, (ptStockByUid.get(pt.id_silo_legacy) ?? 0) + saldoKg);
    }
    if (pt.nombre_silo?.trim()) {
      ptStockByName.set(normalizeText(pt.nombre_silo), (ptStockByName.get(normalizeText(pt.nombre_silo)) ?? 0) + saldoKg);
    }
  });

  const stockBySiloUid = new Map<string, number>();
  (silosResult.data ?? []).forEach((row) => {
    const silo = row as SiloRow;
    let stockKg = 0;
    if (silo.tipo_uso === 'MATERIA_PRIMA') {
      stockKg = mpStockByName.get(normalizeText(silo.nombre)) ?? 0;
    } else if (silo.tipo_uso === 'PRODUCTO_TERMINADO') {
      stockKg = (
        ptStockByDbId.get(silo.id) ??
        ptStockByUid.get(silo.legacy_uid ?? '') ??
        ptStockByName.get(normalizeText(silo.nombre)) ??
        0
      );
    }
    stockBySiloUid.set(silo.legacy_uid ?? silo.id, stockKg);
  });

  return stockBySiloUid;
};

export const supabaseSiloService = {
  async getAll(): Promise<Silo[]> {
    const stockBySiloUid = await buildStockActualBySilo();

    const { data, error } = await supabaseClient
      .from('silos')
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => {
      const silo = row as SiloRow;
      return mapSilo(silo, (stockBySiloUid.get(silo.legacy_uid ?? silo.id) ?? 0) / 1000);
    });
  },

  async getById(uid: string): Promise<Silo | undefined> {
    const stockBySiloUid = await buildStockActualBySilo();
    const { data, error } = await supabaseClient
      .from('silos')
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .eq('legacy_uid', uid)
      .maybeSingle<SiloRow>();

    if (error) throw error;
    return data ? mapSilo(data, (stockBySiloUid.get(data.legacy_uid ?? data.id) ?? 0) / 1000) : undefined;
  },

  async create(payload: Omit<Silo, 'uid'>): Promise<Silo> {
    const stockBySiloUid = await buildStockActualBySilo();
    const legacyUid = `silo-${Math.random().toString(36).slice(2, 11)}`;
    const { data, error } = await supabaseClient
      .from('silos')
      .insert({
        legacy_uid: legacyUid,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        tipo_uso: payload.tipo_uso,
        esta_activo: payload.esta_activo ?? true,
        deleted_at: null,
      })
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .single<SiloRow>();

    if (error) throw error;
    return mapSilo(data, (stockBySiloUid.get(data.legacy_uid ?? data.id) ?? 0) / 1000);
  },

  async update(uid: string, payload: Partial<Silo>): Promise<Silo> {
    const stockBySiloUid = await buildStockActualBySilo();
    const { data, error } = await supabaseClient
      .from('silos')
      .update({ nombre: payload.nombre, descripcion: payload.descripcion, tipo_uso: payload.tipo_uso })
      .eq('legacy_uid', uid)
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .single<SiloRow>();

    if (error) throw error;
    return mapSilo(data, (stockBySiloUid.get(data.legacy_uid ?? data.id) ?? 0) / 1000);
  },

  async delete(uid: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('silos')
      .update({ deleted_at: new Date().toISOString(), esta_activo: false })
      .eq('legacy_uid', uid);

    if (error) throw error;
    return true;
  },
  async toggleActive(uid: string, activo: boolean): Promise<Silo> {
    const stockBySiloUid = await buildStockActualBySilo();
    const { data, error } = await supabaseClient
      .from('silos')
      .update({ esta_activo: activo, deleted_at: activo ? null : new Date().toISOString() })
      .eq('legacy_uid', uid)
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .single<SiloRow>();

    if (error) throw error;
    return mapSilo(data, (stockBySiloUid.get(data.legacy_uid ?? data.id) ?? 0) / 1000);
  },
};
