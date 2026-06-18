export const EstadoExpedicion = {
  PENDIENTE: 'PENDIENTE',
  REGISTRADA: 'REGISTRADA',
  ANULADA: 'ANULADA',
} as const;

export type EstadoExpedicion = (typeof EstadoExpedicion)[keyof typeof EstadoExpedicion];

export const PresentacionExpedicion = {
  GRANEL: 'GRANEL',
  BIG_BAG: 'BIG_BAG',
  BOLSA: 'BOLSA',
} as const;

export type PresentacionExpedicion = (typeof PresentacionExpedicion)[keyof typeof PresentacionExpedicion];

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
  presentacion: PresentacionExpedicion;
  cantidad: number;
  estado: EstadoExpedicion;
  motivo: string | null;
  referencia: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrarOrdenExpedicionPayload {
  stock_pt_id: string;
  cliente_id: string;
  presentacion: PresentacionExpedicion;
  cantidad: number;
  motivo?: string | null;
  referencia?: string | null;
}
