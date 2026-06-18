import type { EmitirFacturaBManualInput, EmitirFacturaBManualResult } from '../dto/EmitirFacturaBManualInput';
import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { ArcaProvider } from '../ports/ArcaProvider';
import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import type { ArcaFiscalPersistencePort } from '../ports/ArcaFiscalPersistencePort';
import type { ArcaFiscalAuditPort } from '../ports/ArcaFiscalAuditPort';
import type { ClockPort } from '../ports/ClockPort';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort';
import { ARCA_CONFIG } from '../../infrastructure/config/arcaConfig';
import { createArcaProvider } from '../../infrastructure/providers/ArcaProviderFactory';
import { emitirFactura } from './EmitirFactura';
import { mapClienteToClienteFiscal } from '../../infrastructure/mappers/clienteFiscalMapper';
import type { FacturaItemInput } from '../../domain/entities/Factura';

export interface EmitirFacturaBManualDeps {
  provider?: ArcaProvider;
  config?: ArcaConfig;
  persistence?: ArcaFiscalPersistencePort;
  audit?: ArcaFiscalAuditPort;
  clock?: ClockPort;
  idGenerator?: IdGeneratorPort;
}

const mapSource = (
  source: EmitirFacturaBManualInput['source'],
): EmitirFacturaInput['source'] => {
  if (!source) return { entidad: 'manual', entidadId: 'manual' };
  return {
    entidad: source.entidad,
    entidadId: source.entidadId?.trim() || source.entidad,
  };
};

const mapItems = (items: EmitirFacturaBManualInput['items']): FacturaItemInput[] => items.map((item) => ({
  concepto: item.concepto.trim(),
  cantidad: item.cantidad,
  unidadMedida: item.unidadMedida?.trim() || 'UN',
  precioUnitario: item.precioUnitario,
  alicuotaIva: item.alicuotaIva,
}));

export const emitirFacturaBManual = async (
  input: EmitirFacturaBManualInput,
  deps: EmitirFacturaBManualDeps = {},
): Promise<EmitirFacturaBManualResult> => {
  const config = deps.config ?? ARCA_CONFIG;
  const provider = deps.provider ?? createArcaProvider(config, { clock: deps.clock, idGenerator: deps.idGenerator });
  const clienteFiscalResult = mapClienteToClienteFiscal(input.cliente);
  const warnings = [...clienteFiscalResult.warnings];
  const observaciones = typeof input.observaciones === 'string' && input.observaciones.trim().length > 0
    ? input.observaciones.trim()
    : undefined;

  if (input.modalidad && input.modalidad !== 'FACTURA_B') {
    const errors = ['Solo se permite FACTURA_B para este flujo manual.'];
    if (deps.audit) {
      await deps.audit.registrarRechazoValidacion({
        estado: 'RECHAZADA',
        providerMode: config.mode,
        mensaje: errors[0],
        payload: {
          modalidad: input.modalidad,
          warnings,
        },
      });
    }
    return {
      ok: false,
      warnings,
      errors,
    };
  }

  const arcaInput: EmitirFacturaInput = {
    modalidad: 'FACTURA_B',
    cliente: clienteFiscalResult.clienteFiscal,
    items: mapItems(input.items),
    moneda: 'ARS',
    observaciones,
    source: mapSource(input.source),
  };

  const emission = await emitirFactura(arcaInput, {
    provider,
    config,
    persistence: deps.persistence,
    audit: deps.audit,
  });

  const mergedWarnings = [...warnings, ...emission.warnings];

  return {
    ok: emission.ok,
    facturaId: emission.facturaId,
    comprobanteNumero: emission.comprobante?.numero ?? emission.factura?.numeroComprobante,
    total: emission.factura?.totales.total,
    warnings: mergedWarnings,
    errors: emission.errors,
  };
};
