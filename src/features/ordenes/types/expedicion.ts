export const EstadoExpedicion = {
  PENDIENTE: 'pendiente',
  PREPARANDO: 'preparando',
  LISTA: 'lista',
  DESPACHADA: 'despachada',
  CANCELADA: 'cancelada',
} as const;

export type EstadoExpedicion = (typeof EstadoExpedicion)[keyof typeof EstadoExpedicion];

export const PresentacionExpedicion = {
  GRANEL: 'GRANEL',
  BIG_BAG: 'BIG_BAG',
  BOLSA: 'BOLSA',
} as const;

export type PresentacionExpedicion = (typeof PresentacionExpedicion)[keyof typeof PresentacionExpedicion];

export type PresentacionExpedicionKey =
  | 'GRANEL_KG'
  | 'TONELADA'
  | 'BOLSA_15'
  | 'BOLSA_20'
  | 'BOLSA_25'
  | 'BOLSA_40'
  | 'BIG_BAG_500'
  | 'BIG_BAG_1000';

export interface OrdenExpedicion {
  id: string;
  legacy_uid: string;
  numero_expedicion: string;
  stock_pt_id: string;
  producto_id: string;
  nombre_producto: string;
  lote_pt: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  presentacion_key?: PresentacionExpedicionKey | null;
  presentacion: PresentacionExpedicion;
  cantidad: number;
  cantidad_original: number;
  unidad_original?: 'kg' | 'tonelada' | string | null;
  unidad_cantidad: 'kg' | 'tonelada';
  cantidad_kg: number;
  precio_unitario_venta?: number | null;
  total_venta?: number | null;
  moneda?: string | null;
  modo_calculo?: 'kg_requeridos' | 'empaques' | string | null;
  empaque_id?: string | null;
  tipo_empaque?: string | null;
  capacidad_empaque_kg?: number | null;
  cantidad_empaques?: number | null;
  sobrante_kg?: number | null;
  estado: EstadoExpedicion;
  motivo: string | null;
  referencia: string | null;
  fecha_programada?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrarOrdenExpedicionPayload {
  stock_pt_id: string;
  cliente_id: string;
  presentacion_key: PresentacionExpedicionKey;
  presentacion: PresentacionExpedicion;
  cantidad: number;
  cantidad_original?: number;
  unidad_cantidad: 'kg' | 'tonelada';
  precio_unitario_venta?: number | null;
  total_venta?: number | null;
  moneda?: string | null;
  modo_calculo?: 'kg_requeridos' | 'empaques';
  tipo_empaque?: 'BOLSA' | 'BIG_BAG' | null;
  capacidad_empaque_kg?: number | null;
  cantidad_empaques?: number | null;
  motivo?: string | null;
  referencia?: string | null;
  fecha_programada?: string | null;
}

export type ActualizarOrdenExpedicionPayload = Partial<RegistrarOrdenExpedicionPayload>;
