import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { EmitirFacturaResult } from '../dto/EmitirFacturaResult';
import type { ArcaProvider } from '../ports/ArcaProvider';
import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import type { ArcaFiscalPersistencePort } from '../ports/ArcaFiscalPersistencePort';
import type { ArcaFiscalAuditPort } from '../ports/ArcaFiscalAuditPort';
import { validarFactura } from './ValidarFactura';

export interface EmitirFacturaDeps {
  provider: ArcaProvider;
  config: ArcaConfig;
  persistence?: ArcaFiscalPersistencePort;
  audit?: ArcaFiscalAuditPort;
}

export const emitirFactura = async (
  input: EmitirFacturaInput,
  deps: EmitirFacturaDeps,
): Promise<EmitirFacturaResult> => {
  const config = deps.config;
  const validation = validarFactura(input, config);

  if (!validation.ok && validation.estadoFiscal !== 'PENDIENTE_CREDENCIALES') {
    if (deps.audit) {
      await deps.audit.registrarRechazoValidacion({
        estado: validation.estadoFiscal,
        providerMode: config.mode,
        mensaje: validation.errors[0] ?? 'La emision fue rechazada por validacion.',
        payload: {
          modalidad: input.modalidad,
          errors: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    return {
      ok: false,
      facturaId: `${input.modalidad}-INVALIDA`,
      estadoFiscal: validation.estadoFiscal,
      warnings: validation.warnings,
      errors: validation.errors,
      provider: config.mode,
    };
  }

  const result = await deps.provider.emitirFactura(input);

  if (!result.ok) {
    if (validation.estadoFiscal === 'PENDIENTE_CREDENCIALES' && deps.audit) {
      await deps.audit.registrarIntentoBloqueado({
        estado: result.estadoFiscal,
        providerMode: result.provider,
        mensaje: result.errors[0] ?? 'Intento de emision bloqueado.',
        payload: {
          modalidad: input.modalidad,
          errors: result.errors,
          warnings: result.warnings,
        },
      });
    }

    return result;
  }

  let facturaPersistidaId: string | undefined;
  let comprobantePersistidoId: string | undefined;

  if (deps.persistence && result.factura && result.comprobante) {
    const facturaPersistida = await deps.persistence.guardarFactura({
      factura: result.factura,
      providerMode: result.provider,
      estadoFiscal: result.estadoFiscal,
    });

    facturaPersistidaId = facturaPersistida.id;

    const comprobantePersistido = await deps.persistence.guardarComprobante({
      facturaId: facturaPersistida.id,
      comprobante: result.comprobante,
      providerMode: result.provider,
    });

    comprobantePersistidoId = comprobantePersistido.id;
  }

  if (deps.audit) {
    await deps.audit.registrarEmisionSimulada({
      facturaId: facturaPersistidaId,
      comprobanteId: comprobantePersistidoId,
      estado: result.estadoFiscal,
      providerMode: result.provider,
      mensaje: 'Factura fiscal simulada persistida.',
      payload: {
        facturaId: result.facturaId,
        numeroComprobante: result.factura?.numeroComprobante ?? result.comprobante?.numero ?? null,
        warnings: result.warnings,
      },
    });
  }

  return result;
};
