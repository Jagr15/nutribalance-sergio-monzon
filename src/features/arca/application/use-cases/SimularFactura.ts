import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { ClockPort } from '../ports/ClockPort';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort';
import type { Factura, FacturaItem } from '../../domain/entities/Factura';
import type { Comprobante } from '../../domain/entities/Comprobante';
import { validarFactura } from './ValidarFactura';

const defaultClock: ClockPort = {
  now: () => new Date(),
};

const defaultIdGenerator: IdGeneratorPort = {
  nextId: (prefix = 'arca') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const calculateItemSubtotal = (item: FacturaItem) => roundMoney(item.cantidad * item.precioUnitario);

const buildIvaRate = (item: FacturaItem, config: ArcaConfig) => {
  if (typeof item.alicuotaIva === 'number') return item.alicuotaIva;
  return config.simulation.defaultIvaRate;
};

export const simularFactura = (
  input: EmitirFacturaInput,
  config: ArcaConfig,
  clock: ClockPort = defaultClock,
  idGenerator: IdGeneratorPort = defaultIdGenerator,
): Factura => {
  const validation = validarFactura(input, config);
  const now = clock.now().toISOString();
  const facturaId = idGenerator.nextId('factura');
  const comprobanteNumero = `SIM-${input.modalidad.replace('FACTURA_', '')}-${now.slice(0, 10).replaceAll('-', '')}-${facturaId.slice(-6).toUpperCase()}`;

  const items = (input.items ?? []).map((item) => ({
    ...item,
    subtotal: calculateItemSubtotal(item),
    alicuotaIva: buildIvaRate(item, config),
  }));

  const subtotal = roundMoney(items.reduce((acc, item) => acc + item.subtotal, 0));
  const iva = roundMoney(
    items.reduce((acc, item) => acc + item.subtotal * (item.alicuotaIva ?? config.simulation.defaultIvaRate), 0),
  );
  const total = roundMoney(subtotal + iva);

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
    items,
    moneda: 'ARS',
    totales: {
      subtotal,
      iva,
      total,
    },
    estadoFiscal:
      input.modalidad === 'FACTURA_B' && validation.ok && config.simulation.autoAcceptB
        ? 'ACEPTADA'
        : validation.estadoFiscal,
    numeroComprobante: comprobanteNumero,
    puntoVenta: '0001',
    observaciones: input.observaciones,
    comprobante,
    createdAt: now,
    source: input.source,
  };
};
