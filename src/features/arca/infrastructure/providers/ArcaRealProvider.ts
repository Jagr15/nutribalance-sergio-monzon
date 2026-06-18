import { ARCA_CONFIG, type ArcaConfig } from '../config/arcaConfig';
import type { ArcaProvider } from '../../application/ports/ArcaProvider';
import type { EmitirFacturaInput } from '../../application/dto/EmitirFacturaInput';
import type { EmitirFacturaResult } from '../../application/dto/EmitirFacturaResult';
import { CredencialesFaltantesError } from '../../domain/errors/CredencialesFaltantesError';

export class ArcaRealProvider implements ArcaProvider {
  constructor(config: ArcaConfig = ARCA_CONFIG) {
    void config;
  }

  async emitirFactura(input: EmitirFacturaInput): Promise<EmitirFacturaResult> {
    throw new CredencialesFaltantesError(`ARCA real no habilitado para ${input.modalidad}.`);
  }
}
