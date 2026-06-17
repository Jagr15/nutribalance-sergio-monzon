export type TipoEventoTrazabilidad =
  | 'INGRESO_MP'
  | 'RESERVA_MP'
  | 'CONSUMO_MP'
  | 'PRODUCCION_INICIO'
  | 'PRODUCCION_FIN'
  | 'INGRESO_PT'
  | 'DESPACHO_PT'
  | 'AJUSTE';

export interface TrazabilidadEvento {
  uid: string;
  id_orden?: string;
  id_lote_mp?: string;
  id_stock_pt?: string;
  tipo: TipoEventoTrazabilidad;
  referencia?: string;
  payload: Record<string, unknown>;
  fecha_evento: Date;
  id_usuario?: string;
}

export interface MovimientoMPAuditoria {
  fecha: string;
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  insumo: string;
  lote_mp: string;
  cantidad: number;
  unidad: string;
  op_relacionada: string | null;
  op_lote: string | null;
  origen: string;
  observaciones: string | null;
}

export interface TrazabilidadOPItem {
  insumo: string;
  lote_mp: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number | null;
  costo_total: number | null;
}

export interface TrazabilidadPTItem {
  stock_pt_id: string;
  lote_pt: string;
  cantidad: number;
  unidad: string;
  silo: string | null;
  fecha: string;
}

export interface TrazabilidadEventoItem {
  tipo: string;
  referencia: string | null;
  fecha: string;
  payload: Record<string, unknown>;
}

export interface TrazabilidadPorOP {
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
  mp_planificada: TrazabilidadOPItem[];
  lotes_mp_usados: string[];
  mp_movimientos: MovimientoMPAuditoria[];
  pt_generado: TrazabilidadPTItem[];
  salidas_pt: Array<{
    tipo: string;
    cantidad: number;
    motivo: string | null;
    referencia: string | null;
    fecha: string;
  }>;
  eventos: TrazabilidadEventoItem[];
}
