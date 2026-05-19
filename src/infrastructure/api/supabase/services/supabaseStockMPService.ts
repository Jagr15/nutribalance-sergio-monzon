import type { StockMateriaPrima } from '../../../../features/insumos/types';
import { TipoUnidad } from '../../../../shared/types/global.interface';
import type { StockMPCreateData } from '../../types';
import { supabaseClient } from '../client';

interface StockLoteRow {
  legacy_uid: string | null;
  lote: string;
  remito_nro: string;
  ubicacion: string;
  cantidad_actual: number;
  cantidad_inicial: number;
  cantidad_comprometida: number;
  costo_unitario: number;
  costo_total: number;
  fecha_ingreso: string;
  created_at: string;
  updated_at: string;
  insumos: { legacy_uid: string | null } | null;
  proveedores: { legacy_uid: string | null } | null;
  usuarios: { legacy_uid: string | null } | null;
}

const mapStock = (row: StockLoteRow): StockMateriaPrima => ({
  uid: row.legacy_uid ?? crypto.randomUUID(),
  id_insumo: row.insumos?.legacy_uid ?? '',
  id_proveedor: row.proveedores?.legacy_uid ?? '',
  lote: row.lote,
  cantidad_actual: Number(row.cantidad_actual),
  cantidad_inicial: Number(row.cantidad_inicial),
  cantidad_comprometida: Number(row.cantidad_comprometida),
  costo_unitario: Number(row.costo_unitario),
  costo_total: Number(row.costo_total),
  fecha_ingreso: new Date(row.fecha_ingreso),
  remito_nro: row.remito_nro,
  ubicacion: row.ubicacion,
  id_usuario: row.usuarios?.legacy_uid ?? 'usr-admin-01',
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export const supabaseStockMPService = {
  async getAllLotes(): Promise<StockMateriaPrima[]> {
    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .select(
        'legacy_uid,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid),proveedores(legacy_uid),usuarios(legacy_uid)'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => mapStock(row as unknown as StockLoteRow));
  },

  async create(payload: StockMPCreateData): Promise<StockMateriaPrima> {
    const unidad = payload.unidad_entrada;
    const factor = unidad === TipoUnidad.TON ? 1000 : 1;
    const cantidadKg = payload.cantidad * factor;
    const costoUnitario = payload.costo_total / cantidadKg;

    const { data: insumo, error: insumoError } = await supabaseClient
      .from('insumos')
      .select('id')
      .eq('legacy_uid', payload.id_insumo)
      .single<{ id: string }>();
    if (insumoError) throw insumoError;

    const { data: proveedor, error: proveedorError } = await supabaseClient
      .from('proveedores')
      .select('id')
      .eq('legacy_uid', payload.id_proveedor)
      .single<{ id: string }>();
    if (proveedorError) throw proveedorError;

    const { data: usuario, error: usuarioError } = await supabaseClient
      .from('usuarios')
      .select('id')
      .eq('legacy_uid', payload.id_usuario)
      .maybeSingle<{ id: string }>();
    if (usuarioError) throw usuarioError;

    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .insert({
        legacy_uid: `stk-${Math.random().toString(36).slice(2, 11)}`,
        insumo_id: insumo.id,
        proveedor_id: proveedor.id,
        lote: payload.lote.toUpperCase(),
        remito_nro: payload.remito_nro,
        ubicacion: payload.ubicacion,
        cantidad_inicial: cantidadKg,
        cantidad_actual: cantidadKg,
        cantidad_comprometida: 0,
        costo_unitario: costoUnitario,
        costo_total: payload.costo_total,
        fecha_ingreso: payload.fecha_ingreso.toISOString(),
        id_usuario: usuario?.id ?? null,
      })
      .select(
        'legacy_uid,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid),proveedores(legacy_uid),usuarios(legacy_uid)'
      )
      .single();

    if (error) throw error;
    return mapStock(data as unknown as StockLoteRow);
  },

  async update(uid: string, payload: Partial<StockMateriaPrima>): Promise<StockMateriaPrima> {
    const updateInput: Record<string, unknown> = {
      lote: payload.lote,
      remito_nro: payload.remito_nro,
      ubicacion: payload.ubicacion,
      cantidad_inicial: payload.cantidad_inicial,
      cantidad_actual: payload.cantidad_actual,
      cantidad_comprometida: payload.cantidad_comprometida,
      costo_unitario: payload.costo_unitario,
      costo_total: payload.costo_total,
      fecha_ingreso: payload.fecha_ingreso?.toISOString(),
    };

    const { data, error } = await supabaseClient
      .from('stock_lotes_mp')
      .update(updateInput)
      .eq('legacy_uid', uid)
      .select(
        'legacy_uid,lote,remito_nro,ubicacion,cantidad_actual,cantidad_inicial,cantidad_comprometida,costo_unitario,costo_total,fecha_ingreso,created_at,updated_at,insumos(legacy_uid),proveedores(legacy_uid),usuarios(legacy_uid)'
      )
      .single();

    if (error) throw error;
    return mapStock(data as unknown as StockLoteRow);
  },

  async delete(uid: string): Promise<void> {
    const { error } = await supabaseClient
      .from('stock_lotes_mp')
      .update({ deleted_at: new Date().toISOString() })
      .eq('legacy_uid', uid);

    if (error) throw error;
  },
};
