import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { EmitirFacturaResult } from '../dto/EmitirFacturaResult';
import type { ArcaProvider } from '../ports/ArcaProvider';
import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import { validarFactura } from './ValidarFactura';

export interface EmitirFacturaDeps {
  provider: ArcaProvider;
  config: ArcaConfig;
}

export const emitirFactura = async (
  input: EmitirFacturaInput,
  deps: EmitirFacturaDeps,
): Promise<EmitirFacturaResult> => {
  const config = deps.config;
  const validation = validarFactura(input, config);

  if (!validation.ok && validation.estadoFiscal !== 'PENDIENTE_CREDENCIALES') {
    return {
      ok: false,
      facturaId: `${input.modalidad}-INVALIDA`,
      estadoFiscal: validation.estadoFiscal,
      warnings: validation.warnings,
      errors: validation.errors,
      provider: config.mode,
    };
  }

  return deps.provider.emitirFactura(input);
};
