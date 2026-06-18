import { ArcaError } from './ArcaError';

export class CredencialesFaltantesError extends ArcaError {
  constructor(message = 'ARCA real no habilitado: faltan credenciales o certificados.') {
    super(message, 'ARCA_CREDENTIALS_MISSING');
    this.name = 'CredencialesFaltantesError';
  }
}
