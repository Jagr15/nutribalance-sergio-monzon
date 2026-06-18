import type { ArcaFiscalAuditPort, RegistrarAuditBaseInput } from '../../application/ports/ArcaFiscalAuditPort';
import type { ArcaFiscalEventRepositoryPort, ArcaEventoFiscalPersistido } from '../../application/ports/ArcaFiscalEventRepositoryPort';

const buildPayload = (input: RegistrarAuditBaseInput) => ({
  facturaId: input.facturaId ?? null,
  comprobanteId: input.comprobanteId ?? null,
  ...(input.payload ?? {}),
});

export class ArcaFiscalAuditAdapter implements ArcaFiscalAuditPort {
  private readonly eventRepository: ArcaFiscalEventRepositoryPort;

  constructor(eventRepository: ArcaFiscalEventRepositoryPort) {
    this.eventRepository = eventRepository;
  }

  registrarEmisionSimulada(input: RegistrarAuditBaseInput): Promise<ArcaEventoFiscalPersistido> {
    return this.eventRepository.registrarEvento({
      ...input,
      accion: 'EMISION_SIMULADA',
      payload: buildPayload(input),
      mensaje: input.mensaje ?? 'Emision fiscal simulada persistida.',
    });
  }

  registrarIntentoBloqueado(input: RegistrarAuditBaseInput): Promise<ArcaEventoFiscalPersistido> {
    return this.eventRepository.registrarEvento({
      ...input,
      accion: 'INTENTO_BLOQUEADO',
      payload: buildPayload(input),
      mensaje: input.mensaje ?? 'Intento de emision bloqueado.',
    });
  }

  registrarRechazoValidacion(input: RegistrarAuditBaseInput): Promise<ArcaEventoFiscalPersistido> {
    return this.eventRepository.registrarEvento({
      ...input,
      accion: 'VALIDACION_RECHAZADA',
      payload: buildPayload(input),
      mensaje: input.mensaje ?? 'La emision fue rechazada por validacion.',
    });
  }
}
