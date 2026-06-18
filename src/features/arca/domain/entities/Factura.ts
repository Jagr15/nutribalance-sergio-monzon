import type { ClienteFiscal } from './ClienteFiscal';
import type { Comprobante } from './Comprobante';
import type { EstadoFiscal } from '../value-objects/EstadoFiscal';
import type { TipoFactura } from '../value-objects/TipoFactura';

export interface FacturaItemInput {
  concepto: string;
  cantidad: number;
  unidadMedida: string;
  precioUnitario: number;
  alicuotaIva?: number;
}

export interface FacturaItem extends FacturaItemInput {
  subtotal: number;
  iva: number;
  total: number;
}

export interface FacturaTotales {
  subtotal: number;
  iva: number;
  total: number;
}

export interface Factura {
  id: string;
  modalidad: TipoFactura;
  tipoComprobante: 'A' | 'B' | 'MIXTA';
  clienteFiscal: ClienteFiscal;
  items: FacturaItem[];
  moneda: 'ARS';
  totales: FacturaTotales;
  estadoFiscal: EstadoFiscal;
  numeroComprobante?: string;
  puntoVenta?: string;
  cae?: string;
  caeVencimiento?: string;
  comprobante?: Comprobante;
  observaciones?: string;
  createdAt: string;
  source?: {
    entidad: 'orden' | 'producto' | 'cliente' | 'finanza' | 'demo' | 'manual';
    entidadId: string;
  };
}
