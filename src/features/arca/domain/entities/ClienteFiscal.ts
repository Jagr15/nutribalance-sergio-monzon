import type { CondicionIva } from '../value-objects/CondicionIva';

export type TipoDocumentoFiscal = 'CUIT' | 'CUIL' | 'DNI' | 'OTRO';

export interface ClienteFiscal {
  id: string;
  nombre: string;
  tipoDocumento: TipoDocumentoFiscal;
  numeroDocumento: string;
  condicionIva: CondicionIva;
  email?: string;
  domicilioFiscal?: string;
  provincia?: string;
  codigoPostal?: string;
}
