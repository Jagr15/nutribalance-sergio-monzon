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
