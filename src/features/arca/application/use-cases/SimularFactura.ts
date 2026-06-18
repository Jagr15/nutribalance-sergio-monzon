import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { ClockPort } from '../ports/ClockPort';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort';
import type { Factura } from '../../domain/entities/Factura';
import type { Comprobante } from '../../domain/entities/Comprobante';
import { validarFactura } from './ValidarFactura';
import { calcularFacturaBSimulada, formatSimulatedComprobanteNumero } from '../utils/facturaB';

const defaultClock: ClockPort = {
  now: () => new Date(),
};

const defaultIdGenerator: IdGeneratorPort = {
  nextId: (prefix = 'arca') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
};

export const simularFactura = (
  input: EmitirFacturaInput,
  config: ArcaConfig,
  clock: ClockPort = defaultClock,
  idGenerator: IdGeneratorPort = defaultIdGenerator,
  comprobanteSequence = 1,
): Factura => {
  const validation = validarFactura(input, config);
  const now = clock.now().toISOString();
  const facturaId = idGenerator.nextId('factura');
  const comprobanteNumero = formatSimulatedComprobanteNumero(comprobanteSequence);
  const facturaCalculada = calcularFacturaBSimulada(input, config);

  const comprobante: Comprobante = {
    id: idGenerator.nextId('comprobante'),
    facturaId,
    modalidad: input.modalidad,
    numero: comprobanteNumero,
    puntoVenta: '0001',
    estado: validation.ok ? 'ACEPTADA' : validation.estadoFiscal,
    providerMode: config.mode,
    responseRaw: {
      simulated: true,
      mode: config.mode,
      validity: validation,
    },
    createdAt: now,
  };

  return {
    id: facturaId,
    modalidad: input.modalidad,
    tipoComprobante:
      input.modalidad === 'FACTURA_B' ? 'B' : input.modalidad === 'FACTURA_A' ? 'A' : 'MIXTA',
    clienteFiscal: input.cliente,
    items: facturaCalculada.items,
    moneda: 'ARS',
    totales: facturaCalculada.totales,
    estadoFiscal: input.modalidad === 'FACTURA_B' && validation.ok ? 'ACEPTADA' : validation.estadoFiscal,
    numeroComprobante: comprobanteNumero,
    puntoVenta: '0001',
    observaciones: input.observaciones,
    comprobante,
    createdAt: now,
    source: input.source,
  };
};
