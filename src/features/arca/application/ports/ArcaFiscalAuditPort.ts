import type { ArcaEventoFiscalPersistido } from './ArcaFiscalEventRepositoryPort';
import type { ArcaMode } from '../../infrastructure/config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';

export interface RegistrarAuditBaseInput {
  facturaId?: string;
  comprobanteId?: string;
  estado: EstadoFiscal;
  providerMode: ArcaMode;
  mensaje?: string;
  payload?: Record<string, unknown>;
}

export interface ArcaFiscalAuditPort {
  registrarEmisionSimulada: (input: RegistrarAuditBaseInput) => Promise<ArcaEventoFiscalPersistido>;
  registrarIntentoBloqueado: (input: RegistrarAuditBaseInput) => Promise<ArcaEventoFiscalPersistido>;
  registrarRechazoValidacion: (input: RegistrarAuditBaseInput) => Promise<ArcaEventoFiscalPersistido>;
}
