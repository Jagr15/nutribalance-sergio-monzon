import type {
  MovimientoStockPT,
  RegistrarSalidaStockPTData,
  StockProductoTerminado,
  StockProductoTerminadoResumen,
} from '../../../../features/productos/types';
import { supabaseClient } from '../client';

interface StockPTRow {
  legacy_uid: string | null;
  id_orden_legacy: string | null;
  numero_orden: string | null;
  id_formula_legacy: string | null;
  version_formula: number | null;
  nombre_producto: string;
  cantidad_total: number;
  cantidad_inicial: number | null;
  costo_unitario_estimado: number | null;
  lote: string;
  unidad_medida: string;
  estado: string;
  id_silo_legacy: string | null;
  nombre_silo: string | null;
  detalle_insumos: unknown;
  fecha_ingreso: string;
  usuario: string | null;
  updated_at: string;
  ordenes_produccion: {
    legacy_uid: string | null;
    id_formula_legacy: string | null;
    version_formula: number | null;
    nombre_producto: string | null;
  } | null;
}

interface StockPTResumenRow {
  producto_id: string | null;
  nombre_producto: string;
  unidad: string;
  stock_actual: number;
  valor_monetario: number;
  estado: string;
  cantidad_lotes: number;
  ultima_actualizacion: string;
  numero_orden: string | null;
  id_formula: string | null;
  version_formula: number | null;
}

interface StockPTMovimientoRow {
  id: string;
  stock_pt_id: string | null;
  producto_id: string | null;
  nombre_producto: string;
  lote: string;
  numero_orden: string | null;
  silo: string | null;
  tipo: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number | null;
  valor_total: number | null;
  motivo: string | null;
  referencia: string | null;
  created_at: string;
}

const toStockPT = (row: StockPTRow): StockProductoTerminado => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  id_orden: row.id_orden_legacy ?? '',
  numero_orden: row.numero_orden ?? '',
  id_formula: row.id_formula_legacy ?? row.ordenes_produccion?.id_formula_legacy ?? null,
  version_formula: row.version_formula ?? row.ordenes_produccion?.version_formula ?? null,
  nombre_producto: row.nombre_producto,
  cantidad_total: Number(row.cantidad_total),
  cantidad_inicial: row.cantidad_inicial ?? null,
  costo_unitario_estimado: row.costo_unitario_estimado ?? null,
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
      .select('legacy_uid,id_orden_legacy,numero_orden,nombre_producto,cantidad_total,cantidad_inicial,costo_unitario_estimado,lote,unidad_medida,estado,id_silo_legacy,nombre_silo,detalle_insumos,fecha_ingreso,usuario,updated_at,ordenes_produccion(legacy_uid,id_formula_legacy,version_formula,nombre_producto)')
      .is('deleted_at', null)
      .order('fecha_ingreso', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toStockPT(row as unknown as StockPTRow));
  },

  async getResumen(): Promise<StockProductoTerminadoResumen[]> {
    const { data, error } = await supabaseClient
      .from('stock_pt_resumen')
      .select('producto_id,nombre_producto,unidad,stock_actual,valor_monetario,estado,cantidad_lotes,ultima_actualizacion,numero_orden,id_formula,version_formula')
      .order('nombre_producto', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const resumen = row as unknown as StockPTResumenRow;
      return {
        producto_id: resumen.producto_id,
        nombre_producto: resumen.nombre_producto,
        unidad: resumen.unidad as StockProductoTerminadoResumen['unidad'],
        stock_actual: Number(resumen.stock_actual),
        valor_monetario: Number(resumen.valor_monetario),
        estado: resumen.estado as StockProductoTerminadoResumen['estado'],
        cantidad_lotes: Number(resumen.cantidad_lotes),
        ultima_actualizacion: resumen.ultima_actualizacion,
        numero_orden: resumen.numero_orden,
        id_formula: resumen.id_formula,
        version_formula: resumen.version_formula,
      };
    });
  },

  async getMovimientos(): Promise<MovimientoStockPT[]> {
    const { data, error } = await supabaseClient
      .from('stock_pt_movimientos')
      .select('id,stock_pt_id,producto_id,nombre_producto,lote,numero_orden,silo,tipo,cantidad,unidad,costo_unitario,valor_total,motivo,referencia,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const movimiento = row as unknown as StockPTMovimientoRow;
      return {
        id: movimiento.id,
        stock_pt_id: movimiento.stock_pt_id,
        producto_id: movimiento.producto_id,
        nombre_producto: movimiento.nombre_producto,
        lote: movimiento.lote,
        numero_orden: movimiento.numero_orden,
        silo: movimiento.silo,
        tipo: movimiento.tipo as MovimientoStockPT['tipo'],
        cantidad: Number(movimiento.cantidad),
        unidad: movimiento.unidad as MovimientoStockPT['unidad'],
        costo_unitario: movimiento.costo_unitario,
        valor_total: movimiento.valor_total,
        motivo: movimiento.motivo,
        referencia: movimiento.referencia,
        created_at: movimiento.created_at,
      };
    });
  },

  async registrarSalida(payload: RegistrarSalidaStockPTData): Promise<StockProductoTerminado> {
    const { data, error } = await supabaseClient.rpc('registrar_salida_stock_pt', {
      p_stock_pt_id: payload.stock_pt_id,
      p_cantidad: payload.cantidad,
      p_motivo: payload.motivo,
      p_referencia: payload.referencia ?? null,
    });

    if (error) throw error;
    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) throw new Error('No se pudo registrar la salida de PT.');
    return toStockPT(updated as unknown as StockPTRow);
  },
};
