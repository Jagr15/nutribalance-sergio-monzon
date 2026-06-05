import type { TrazabilidadEvento } from '../../../../features/trazabilidad/types';
import { supabaseClient } from '../client';

interface TrazabilidadRow {
  legacy_uid: string | null;
  tipo: TrazabilidadEvento['tipo'];
  referencia: string | null;
  payload: Record<string, unknown>;
  fecha_evento: string;
  ordenes_produccion: { legacy_uid: string | null } | null;
  stock_lotes_mp: { legacy_uid: string | null } | null;
  stock_pt: { legacy_uid: string | null } | null;
  usuarios: { legacy_uid: string | null } | null;
}

const toEvento = (row: TrazabilidadRow): TrazabilidadEvento => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  id_orden: row.ordenes_produccion?.legacy_uid ?? undefined,
  id_lote_mp: row.stock_lotes_mp?.legacy_uid ?? undefined,
  id_stock_pt: row.stock_pt?.legacy_uid ?? undefined,
  tipo: row.tipo,
  referencia: row.referencia ?? undefined,
  payload: row.payload ?? {},
  fecha_evento: new Date(row.fecha_evento),
  id_usuario: row.usuarios?.legacy_uid ?? undefined,
});

export const supabaseTrazabilidadService = {
  async getAll(): Promise<TrazabilidadEvento[]> {
    const { data, error } = await supabaseClient
      .from('trazabilidad_eventos')
      .select('legacy_uid,tipo,referencia,payload,fecha_evento,ordenes_produccion(legacy_uid),stock_lotes_mp(legacy_uid),stock_pt(legacy_uid),usuarios(legacy_uid)')
      .order('fecha_evento', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toEvento(row as unknown as TrazabilidadRow));
  },
};
