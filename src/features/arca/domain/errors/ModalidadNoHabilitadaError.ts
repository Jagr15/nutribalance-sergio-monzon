import { ArcaError } from './ArcaError';

export class ModalidadNoHabilitadaError extends ArcaError {
  constructor(message = 'La modalidad fiscal solicitada no está habilitada en esta fase.') {
    super(message, 'ARCA_MODALITY_NOT_ENABLED');
    this.name = 'ModalidadNoHabilitadaError';
  }
}
