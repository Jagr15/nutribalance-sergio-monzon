import { ARCA_CONFIG, type ArcaConfig } from '../config/arcaConfig';
import type { ArcaProvider } from '../../application/ports/ArcaProvider';
import type { ClockPort } from '../../application/ports/ClockPort';
import type { IdGeneratorPort } from '../../application/ports/IdGeneratorPort';
import type { EmitirFacturaInput } from '../../application/dto/EmitirFacturaInput';
import type { EmitirFacturaResult } from '../../application/dto/EmitirFacturaResult';
import { simularFactura } from '../../application/use-cases/SimularFactura';
import { validarFactura } from '../../application/use-cases/ValidarFactura';

const defaultClock: ClockPort = {
  now: () => new Date(),
};

const defaultIdGenerator: IdGeneratorPort = {
  nextId: (prefix = 'arca-sim') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
};

const buildPendingResult = (input: EmitirFacturaInput, reason: string, provider: 'SIMULACION' | 'REAL'): EmitirFacturaResult => ({
  ok: false,
  facturaId: `${input.modalidad}-${Date.now().toString(36)}`,
  estadoFiscal: 'PENDIENTE_CREDENCIALES',
  warnings: [],
  errors: [reason],
  provider,
});

export class ArcaSimulationProvider implements ArcaProvider {
  private readonly config: ArcaConfig;
  private readonly clock: ClockPort;
  private readonly idGenerator: IdGeneratorPort;
  private comprobanteSequence = 0;

  constructor(
    config: ArcaConfig = ARCA_CONFIG,
    deps: {
      clock?: ClockPort;
      idGenerator?: IdGeneratorPort;
    } = {},
  ) {
    this.config = config;
    this.clock = deps.clock ?? defaultClock;
    this.idGenerator = deps.idGenerator ?? defaultIdGenerator;
  }

  async emitirFactura(input: EmitirFacturaInput): Promise<EmitirFacturaResult> {
    const validation = validarFactura(input, this.config);

    if (!validation.ok) {
      if (validation.estadoFiscal === 'PENDIENTE_CREDENCIALES') {
        return buildPendingResult(input, validation.errors[0] ?? 'Modalidad pendiente de credenciales.', 'SIMULACION');
      }

      return {
        ok: false,
        facturaId: this.idGenerator.nextId('arca-sim-fail'),
        estadoFiscal: validation.estadoFiscal,
        warnings: validation.warnings,
        errors: validation.errors,
        provider: 'SIMULACION',
      };
    }

    this.comprobanteSequence += 1;
    const factura = simularFactura(input, this.config, this.clock, this.idGenerator, this.comprobanteSequence);

    return {
      ok: true,
      facturaId: factura.id,
      estadoFiscal: factura.estadoFiscal,
      comprobante: factura.comprobante,
      factura,
      warnings: validation.warnings,
      errors: [],
      provider: 'SIMULACION',
    };
  }
}
