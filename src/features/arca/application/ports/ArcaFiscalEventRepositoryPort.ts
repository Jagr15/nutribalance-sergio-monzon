import type { ArcaMode } from '../../infrastructure/config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';

export interface ArcaEventoFiscalInput {
  facturaId?: string;
  comprobanteId?: string;
  accion: string;
  estado: EstadoFiscal;
  providerMode: ArcaMode;
  mensaje?: string;
  payload?: Record<string, unknown>;
}

export interface ArcaEventoFiscalPersistido {
  id: string;
  createdAt: string;
}

export interface ArcaFiscalEventRepositoryPort {
  registrarEvento: (input: ArcaEventoFiscalInput) => Promise<ArcaEventoFiscalPersistido>;
}
