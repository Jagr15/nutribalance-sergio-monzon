import type { StockProductoTerminado } from '../../../../features/productos/types';
import { supabaseClient } from '../client';

interface StockPTRow {
  legacy_uid: string | null;
  id_orden_legacy: string | null;
  numero_orden: string | null;
  nombre_producto: string;
  cantidad_total: number;
  lote: string;
  unidad_medida: string;
  estado: string;
  id_silo_legacy: string | null;
  nombre_silo: string | null;
  detalle_insumos: unknown;
  fecha_ingreso: string;
  usuario: string | null;
  updated_at: string;
}

const toStockPT = (row: StockPTRow): StockProductoTerminado => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  id_orden: row.id_orden_legacy ?? '',
  numero_orden: row.numero_orden ?? '',
  nombre_producto: row.nombre_producto,
  cantidad_total: Number(row.cantidad_total),
  lote: row.lote,
  unidad_medida: row.unidad_medida as StockProductoTerminado['unidad_medida'],
  estado: row.estado as StockProductoTerminado['estado'],
  id_silo: row.id_silo_legacy ?? '',
  nombre_silo: row.nombre_silo ?? '',
  detalle_insumos: (Array.isArray(row.detalle_insumos) ? row.detalle_insumos[0] : row.detalle_insumos) as StockProductoTerminado['detalle_insumos'],
  fecha_ingreso: row.fecha_ingreso,
  usuario: row.usuario ?? 'Sin usuario',
  updateAt: row.updated_at,
});

export const supabaseStockPTService = {
  async getAll(): Promise<StockProductoTerminado[]> {
    const { data, error } = await supabaseClient
      .from('stock_pt')
      .select('legacy_uid,id_orden_legacy,numero_orden,nombre_producto,cantidad_total,lote,unidad_medida,estado,id_silo_legacy,nombre_silo,detalle_insumos,fecha_ingreso,usuario,updated_at')
      .is('deleted_at', null)
      .order('fecha_ingreso', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toStockPT(row as unknown as StockPTRow));
  },
};
