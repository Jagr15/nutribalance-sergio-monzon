import type { Cliente } from '../../../clientes/types/cliente';
import type { TipoFactura } from '../../domain/value-objects/TipoFactura';

export interface EmitirFacturaBManualItemInput {
  concepto: string;
  cantidad: number;
  unidadMedida?: string;
  precioUnitario: number;
  alicuotaIva?: number;
}

export interface EmitirFacturaBManualInput {
  cliente: Cliente;
  items: EmitirFacturaBManualItemInput[];
  source?: {
    entidad: 'demo' | 'finanza' | 'manual';
    entidadId?: string;
  };
  observaciones?: string;
  modalidad?: TipoFactura;
}

export interface EmitirFacturaBManualResult {
  ok: boolean;
  facturaId?: string;
  comprobanteNumero?: string;
  total?: number;
  warnings: string[];
  errors: string[];
}
