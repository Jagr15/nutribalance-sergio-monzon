export const TipoCliente = {
  PERSONA: "PERSONA",
  EMPRESA: "EMPRESA",
} as const;
export type TipoCliente = (typeof TipoCliente)[keyof typeof TipoCliente];

export interface Cliente {
  uid: string;
  nombre_razon_social: string; // Nombre del cliente o nombre de la granja
  ruc_dni: string; // Documento de identidad (DNI o RUC en Perú)
  tipo: TipoCliente;
  direccion: string;
  telefono: string;
  email?: string;
  esta_activo: boolean; // Para borrado lógico
  fecha_registro: Date;
  
  // Opcional: Para el historial rápido del cliente
  ultima_compra?: Date;
  saldo_pendiente?: number; // Si Sergio decide dar crédito en el futuro
}
