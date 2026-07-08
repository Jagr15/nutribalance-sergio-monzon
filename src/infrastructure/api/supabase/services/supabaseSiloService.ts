import type { Silo } from '../../../../features/silos/types';
import { supabaseClient } from '../client';
import {
  hasStockLotesMpSiloIdColumn,
  isMissingStockLotesMpSiloIdError,
} from './stockLotesMpSiloSupport';

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
  const supportsMpSiloId = await hasStockLotesMpSiloIdColumn();
  const mpSelect = supportsMpSiloId
    ? 'ubicacion,silo_id,cantidad_actual,cantidad_comprometida,insumo_id,insumos(unidad_medida)'
    : 'ubicacion,cantidad_actual,cantidad_comprometida,insumo_id,insumos(unidad_medida)';

  const mpQuery = supabaseClient
    .from('stock_lotes_mp')
    .select(mpSelect)
    .is('deleted_at', null);

  const [mpResult, ptResult, silosResult] = await Promise.all([
    mpQuery,
    supabaseClient
      .from('stock_pt')
      .select('silo_id,id_silo_legacy,nombre_silo,cantidad_total')
      .is('deleted_at', null),
    supabaseClient
      .from('silos')
      .select('id,legacy_uid,nombre,descripcion,tipo_uso,esta_activo,deleted_at')
      .is('deleted_at', null),
  ]);

  let mpRows = (mpResult.data ?? []) as any[];

  if (mpResult.error) {
    if (!supportsMpSiloId || !isMissingStockLotesMpSiloIdError(mpResult.error)) throw mpResult.error;
    const legacyMpResult = await supabaseClient
      .from('stock_lotes_mp')
      .select('ubicacion,cantidad_actual,cantidad_comprometida,insumo_id,insumos(unidad_medida)')
      .is('deleted_at', null);
    if (legacyMpResult.error) throw legacyMpResult.error;
    mpRows = (legacyMpResult.data ?? []) as any[];
  }
  if (ptResult.error) throw ptResult.error;
  if (silosResult.error) throw silosResult.error;

  const mpStockByDbId = new Map<string, number>();
  const mpStockByName = new Map<string, number>();
  const ptStockByUid = new Map<string, number>();
  const ptStockByName = new Map<string, number>();
  const ptStockByDbId = new Map<string, number>();

  mpRows.forEach((row) => {
    const mp = row as any;
    const location = mp.ubicacion?.trim();
    if (!location) return;

    // Las cantidades en stock_lotes_mp ya se guardan normalizadas en kilogramos (KG),
    // por lo que no es necesario volver a multiplicarlas por 1000 si el insumo está en toneladas.
    const availableKg = Math.max(0, toNumber(mp.cantidad_actual) - toNumber(mp.cantidad_comprometida));

    if (typeof mp.silo_id === 'string' && mp.silo_id.trim()) {
      mpStockByDbId.set(mp.silo_id, (mpStockByDbId.get(mp.silo_id) ?? 0) + availableKg);
      return;
    }

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
      stockKg = mpStockByDbId.get(silo.id) ?? mpStockByName.get(normalizeText(silo.nombre)) ?? 0;
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
    const { data: silo, error: siloErr } = await supabaseClient
      .from('silos')
      .select('id, nombre')
      .eq('legacy_uid', uid)
      .maybeSingle<{ id: string, nombre: string }>();

    if (siloErr) throw siloErr;
    if (!silo) throw new Error('Silo no encontrado');

    const supportsMpSiloId = await hasStockLotesMpSiloIdColumn();
    const lotCountBySiloPromise = supportsMpSiloId
      ? supabaseClient
          .from('stock_lotes_mp')
          .select('id', { count: 'exact', head: true })
          .eq('silo_id', silo.id)
          .is('deleted_at', null)
      : Promise.resolve({ count: 0, error: null } as const);
    const lotCountLegacyPromise = supabaseClient
      .from('stock_lotes_mp')
      .select('id', { count: 'exact', head: true })
      .eq('ubicacion', silo.nombre)
      .is('deleted_at', null);

    // Check if silo is used in production orders
    const orderCountPromise = supabaseClient
      .from('ordenes_produccion')
      .select('id', { count: 'exact', head: true })
      .eq('silo_id', silo.id);

    // Check if silo is used in finished product stock
    const ptCountPromise = supabaseClient
      .from('stock_pt')
      .select('id', { count: 'exact', head: true })
      .eq('silo_id', silo.id);

    const [
      { count: lotCountBySilo, error: lotBySiloErr },
      { count: lotCountLegacy, error: lotLegacyErr },
      { count: orderCount, error: orderErr },
      { count: ptCount, error: ptErr },
    ] = await Promise.all([lotCountBySiloPromise, lotCountLegacyPromise, orderCountPromise, ptCountPromise]);

    if (lotBySiloErr) throw lotBySiloErr;
    if (lotLegacyErr) throw lotLegacyErr;
    if (orderErr) throw orderErr;
    if (ptErr) throw ptErr;

    if ((lotCountBySilo ?? 0) > 0 || (lotCountLegacy ?? 0) > 0 || (orderCount ?? 0) > 0 || (ptCount ?? 0) > 0) {
      throw new Error('No se puede eliminar el silo porque está asociado a lotes de stock u órdenes de producción.');
    }

    const { error } = await supabaseClient
      .from('silos')
      .update({ deleted_at: new Date().toISOString(), esta_activo: false })
      .eq('id', silo.id);

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
