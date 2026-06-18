import { ARCA_CONFIG, type ArcaConfig } from '../config/arcaConfig';
import type { ArcaProvider } from '../../application/ports/ArcaProvider';
import type { EmitirFacturaInput } from '../../application/dto/EmitirFacturaInput';
import type { EmitirFacturaResult } from '../../application/dto/EmitirFacturaResult';

export class ArcaRealProvider implements ArcaProvider {
  constructor(config: ArcaConfig = ARCA_CONFIG) {
    void config;
  }

  async emitirFactura(input: EmitirFacturaInput): Promise<EmitirFacturaResult> {
    return {
      ok: false,
      facturaId: `${input.modalidad}-PENDIENTE_CREDENCIALES`,
      estadoFiscal: 'PENDIENTE_CREDENCIALES',
      warnings: [],
      errors: [`ARCA real no habilitado para ${input.modalidad}.`],
      provider: 'REAL',
    };
  }
}
