import type { Comprobante } from '../../domain/entities/Comprobante';
import type { Factura } from '../../domain/entities/Factura';
import type { ArcaMode } from '../../infrastructure/config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';

export interface ArcaFacturaPersistida {
  id: string;
  createdAt: string;
}

export interface ArcaComprobantePersistido {
  id: string;
  facturaId: string;
  createdAt: string;
}

export interface GuardarFacturaFiscalInput {
  factura: Factura;
  providerMode: ArcaMode;
  estadoFiscal: EstadoFiscal;
}

export interface GuardarComprobanteFiscalInput {
  facturaId: string;
  comprobante: Comprobante;
  providerMode: ArcaMode;
}

export interface ArcaFiscalPersistencePort {
  guardarFactura: (input: GuardarFacturaFiscalInput) => Promise<ArcaFacturaPersistida>;
  guardarComprobante: (input: GuardarComprobanteFiscalInput) => Promise<ArcaComprobantePersistido>;
}
