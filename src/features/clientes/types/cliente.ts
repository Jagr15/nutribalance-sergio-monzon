export const EstadoCliente = {
  ACTIVO: 'Activo',
  EN_RIESGO: 'En riesgo',
  SUSPENDIDO: 'Suspendido',
} as const;

export type EstadoCliente = (typeof EstadoCliente)[keyof typeof EstadoCliente];

export interface Cliente {
  uid: string;
  id?: string;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  segmento?: string;
  ubicacion?: string;
  contacto?: string;
  productoPrincipal?: string;
  condicionComercial?: string;
  estado: EstadoCliente;
  observaciones?: string;
  ultimaCompra?: string;
  saldoPendienteArs: number;
  estaActivo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClienteEstadoCuentaItem {
  id: string;
  fecha: string;
  producto: string;
  cantidad: number | null;
  unidad?: string | null;
  importe: number;
  saldo: number;
  referencia?: string | null;
  estado: string;
  comprobanteNumero?: string | null;
}

export type ClienteCreatePayload = Omit<Cliente, 'uid' | 'createdAt' | 'updatedAt'>;
export type ClienteUpdatePayload = Partial<Omit<Cliente, 'uid'>>;

export interface ClientePagoPayload {
  clienteId: string; // legacy_uid del cliente
  monto: number;
  fechaPago: string;
  metodoPago: 'efectivo' | 'transferencia' | 'cheque' | 'otro';
  referencia?: string;
  observaciones?: string;
  comprobanteId?: string; // legacy_uid de la factura específica
  cheque?: {
    numero: string;
    banco: string;
    fechaEmision: string;
    fechaVencimiento: string;
  };
}
