import type { ClienteFiscal } from '../../domain/entities/ClienteFiscal';
import type { FacturaItem } from '../../domain/entities/Factura';
import type { TipoFactura } from '../../domain/value-objects/TipoFactura';

export interface EmitirFacturaInput {
  modalidad: TipoFactura;
  cliente: ClienteFiscal;
  items: FacturaItem[];
  moneda?: 'ARS';
  observaciones?: string;
  source?: {
    entidad: 'orden' | 'producto' | 'cliente' | 'finanza';
    entidadId: string;
  };
}
