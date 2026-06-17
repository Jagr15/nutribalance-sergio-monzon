export const EstadoCliente = {
  ACTIVO: 'Activo',
  EN_RIESGO: 'En riesgo',
  SUSPENDIDO: 'Suspendido',
} as const;

export type EstadoCliente = (typeof EstadoCliente)[keyof typeof EstadoCliente];

export interface Cliente {
  uid: string;
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

export type ClienteCreatePayload = Omit<Cliente, 'uid' | 'createdAt' | 'updatedAt'>;
export type ClienteUpdatePayload = Partial<Omit<Cliente, 'uid'>>;
