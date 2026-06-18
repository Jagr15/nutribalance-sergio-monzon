import type { ClienteFiscal } from '../../domain/entities/ClienteFiscal';
import type { FacturaItemInput } from '../../domain/entities/Factura';
import type { TipoFactura } from '../../domain/value-objects/TipoFactura';

export interface EmitirFacturaInput {
  modalidad: TipoFactura;
  cliente: ClienteFiscal;
  items: FacturaItemInput[];
  moneda?: 'ARS';
  observaciones?: string;
  source?: {
    entidad: 'orden' | 'producto' | 'cliente' | 'finanza' | 'demo' | 'manual';
    entidadId: string;
  };
}
