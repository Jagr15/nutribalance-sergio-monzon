import type {
  MovimientoMPAuditoria,
  TrazabilidadEvento,
  TrazabilidadOPItem,
  TrazabilidadPorOP,
  TrazabilidadPTItem,
  TrazabilidadEventoItem,
} from '../../../../features/trazabilidad/types';
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

interface MovimientoMPAuditoriaRow {
  fecha: string;
  tipo_movimiento: MovimientoMPAuditoria['tipo_movimiento'];
  insumo: string;
  lote_mp: string;
  cantidad: number;
  unidad: string;
  op_relacionada: string | null;
  op_lote: string | null;
  origen: string;
  observaciones: string | null;
}

interface TrazabilidadPorOPRow {
  op_id: string;
  orden_legacy_uid: string | null;
  numero_orden: string;
  producto: string;
  formula: string | null;
  version_formula: number | null;
  estado_op: string;
  cantidad_objetivo: number;
  cantidad_real: number | null;
  merma_manual: number | null;
  destino_silo: string | null;
  usuario_responsable: string | null;
  fecha_creacion: string;
  actualizada_en: string;
  mp_planificada: Array<Record<string, unknown>> | null;
  lotes_mp_usados: string[] | null;
  mp_movimientos: Array<Record<string, unknown>> | null;
  pt_generado: Array<Record<string, unknown>> | null;
  salidas_pt: Array<Record<string, unknown>> | null;
  eventos: Array<Record<string, unknown>> | null;
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

  async getMovimientosMPAuditoria(): Promise<MovimientoMPAuditoria[]> {
    const { data, error } = await supabaseClient
      .from('vw_movimientos_mp_auditoria')
      .select('fecha,tipo_movimiento,insumo,lote_mp,cantidad,unidad,op_relacionada,op_lote,origen,observaciones')
      .order('fecha', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const movimiento = row as unknown as MovimientoMPAuditoriaRow;
      return {
        fecha: movimiento.fecha,
        tipo_movimiento: movimiento.tipo_movimiento,
        insumo: movimiento.insumo,
        lote_mp: movimiento.lote_mp,
        cantidad: Number(movimiento.cantidad),
        unidad: movimiento.unidad,
        op_relacionada: movimiento.op_relacionada,
        op_lote: movimiento.op_lote,
        origen: movimiento.origen,
        observaciones: movimiento.observaciones,
      };
    });
  },

  async getTrazabilidadPorOP(): Promise<TrazabilidadPorOP[]> {
    const { data, error } = await supabaseClient
      .from('vw_trazabilidad_por_op')
      .select('op_id,orden_legacy_uid,numero_orden,producto,formula,version_formula,estado_op,cantidad_objetivo,cantidad_real,merma_manual,destino_silo,usuario_responsable,fecha_creacion,actualizada_en,mp_planificada,lotes_mp_usados,mp_movimientos,pt_generado,salidas_pt,eventos')
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const op = row as unknown as TrazabilidadPorOPRow;
      return {
        op_id: op.op_id,
        orden_legacy_uid: op.orden_legacy_uid,
        numero_orden: op.numero_orden,
        producto: op.producto,
        formula: op.formula,
        version_formula: op.version_formula,
        estado_op: op.estado_op,
        cantidad_objetivo: Number(op.cantidad_objetivo),
        cantidad_real: op.cantidad_real === null ? null : Number(op.cantidad_real),
        merma_manual: op.merma_manual === null ? null : Number(op.merma_manual),
        destino_silo: op.destino_silo,
        usuario_responsable: op.usuario_responsable,
        fecha_creacion: op.fecha_creacion,
        actualizada_en: op.actualizada_en,
        mp_planificada: (op.mp_planificada ?? []).map((item) => ({
          insumo: String(item.insumo ?? 'Sin dato'),
          lote_mp: String(item.lote_mp ?? 'Sin dato'),
          cantidad: Number(item.cantidad ?? 0),
          unidad: String(item.unidad ?? 'KG'),
          costo_unitario: item.costo_unitario === undefined || item.costo_unitario === null ? null : Number(item.costo_unitario),
          costo_total: item.costo_total === undefined || item.costo_total === null ? null : Number(item.costo_total),
        })) as TrazabilidadOPItem[],
        lotes_mp_usados: op.lotes_mp_usados ?? [],
        mp_movimientos: (op.mp_movimientos ?? []).map((item) => ({
          fecha: String(item.fecha ?? ''),
          tipo_movimiento: String(item.tipo ?? 'SALIDA') as MovimientoMPAuditoria['tipo_movimiento'],
          insumo: String(item.insumo ?? 'Sin dato'),
          lote_mp: String(item.lote_mp ?? 'Sin dato'),
          cantidad: Number(item.cantidad ?? 0),
          unidad: String(item.unidad ?? 'KG'),
          op_relacionada: null,
          op_lote: op.numero_orden,
          origen: String(item.origen ?? 'PRODUCCION'),
          observaciones: item.observaciones === null || item.observaciones === undefined ? null : String(item.observaciones),
        })),
        pt_generado: (op.pt_generado ?? []).map((item) => ({
          stock_pt_id: String(item.stock_pt_id ?? ''),
          lote_pt: String(item.lote_pt ?? ''),
          cantidad: Number(item.cantidad ?? 0),
          unidad: String(item.unidad ?? 'KG'),
          silo: item.silo === undefined || item.silo === null ? null : String(item.silo),
          fecha: String(item.fecha ?? ''),
        })) as TrazabilidadPTItem[],
        salidas_pt: (op.salidas_pt ?? []).map((item) => ({
          tipo: String(item.tipo ?? 'SALIDA'),
          cantidad: Number(item.cantidad ?? 0),
          motivo: item.motivo === undefined || item.motivo === null ? null : String(item.motivo),
          referencia: item.referencia === undefined || item.referencia === null ? null : String(item.referencia),
          fecha: String(item.fecha ?? ''),
          cliente_id: item.cliente_id === undefined || item.cliente_id === null ? null : String(item.cliente_id),
          cliente_nombre: item.cliente_nombre === undefined || item.cliente_nombre === null ? null : String(item.cliente_nombre),
          stock_pt_id: item.stock_pt_id === undefined || item.stock_pt_id === null ? null : String(item.stock_pt_id),
          lote_pt: item.lote_pt === undefined || item.lote_pt === null ? null : String(item.lote_pt),
        })),
        eventos: (op.eventos ?? []).map((item) => ({
          tipo: String(item.tipo ?? 'AJUSTE'),
          referencia: item.referencia === undefined || item.referencia === null ? null : String(item.referencia),
          fecha: String(item.fecha ?? ''),
          payload: (item.payload as Record<string, unknown>) ?? {},
        })) as TrazabilidadEventoItem[],
      };
    });
  },
};
