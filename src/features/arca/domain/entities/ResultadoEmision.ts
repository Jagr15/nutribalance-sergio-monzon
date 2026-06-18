import type { Comprobante } from './Comprobante';
import type { Factura } from './Factura';
import type { EstadoFiscal } from '../value-objects/EstadoFiscal';

export interface ResultadoEmision {
  ok: boolean;
  facturaId: string;
  estadoFiscal: EstadoFiscal;
  comprobante?: Comprobante;
  factura?: Factura;
  warnings: string[];
  errors: string[];
  provider: 'SIMULACION' | 'REAL';
}
