import type { EstadoFiscal } from '../value-objects/EstadoFiscal';
import type { TipoFactura } from '../value-objects/TipoFactura';

export interface Comprobante {
  id: string;
  facturaId: string;
  modalidad: TipoFactura;
  numero?: string;
  puntoVenta?: string;
  cae?: string;
  caeVencimiento?: string;
  estado: EstadoFiscal;
  providerMode: 'SIMULACION' | 'REAL';
  responseRaw?: unknown;
  createdAt: string;
}
