import type { ClienteFiscal } from '../../domain/entities/ClienteFiscal';
import { TIPOS_DOCUMENTO_FISCAL } from '../../domain/entities/ClienteFiscal';
import type { FacturaItem, FacturaItemInput, FacturaTotales } from '../../domain/entities/Factura';
import { CONDICIONES_IVA } from '../../domain/value-objects/CondicionIva';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';
import type { ModalidadFactura } from '../../domain/value-objects/TipoFactura';
import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isValidIvaRate = (value: unknown): value is number => isFiniteNumber(value) && value >= 0 && value <= 1;

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const formatSimulatedComprobanteNumero = (sequence: number): string => `SIM-B-${String(sequence).padStart(5, '0')}`;

const getEnabledKey = (modalidad: ModalidadFactura): keyof ArcaConfig['enabledModalities'] => modalidad;

const validateClienteFiscal = (cliente: ClienteFiscal | undefined, errors: string[]): void => {
  if (!cliente) {
    errors.push('El cliente fiscal es obligatorio.');
    return;
  }

  if (!isNonEmptyString(cliente.nombre)) {
    errors.push('El nombre del cliente es obligatorio.');
  }

  if (!isNonEmptyString(cliente.numeroDocumento)) {
    errors.push('El documento fiscal del cliente es obligatorio.');
  }

  if (!TIPOS_DOCUMENTO_FISCAL.includes(cliente.tipoDocumento)) {
    errors.push('El tipo de documento fiscal del cliente es inválido.');
  }

  if (!CONDICIONES_IVA.includes(cliente.condicionIva)) {
    errors.push('La condición IVA del cliente es obligatoria.');
  }
};

const validateItem = (item: FacturaItemInput, index: number, errors: string[]): void => {
  const itemLabel = `El item ${index + 1}`;

  if (!isNonEmptyString(item.concepto)) {
    errors.push(`${itemLabel} debe tener un concepto.`);
  }

  if (!isFiniteNumber(item.cantidad) || item.cantidad <= 0) {
    errors.push(`${itemLabel} debe tener una cantidad mayor a 0.`);
  }

  if (!isFiniteNumber(item.precioUnitario) || item.precioUnitario < 0) {
    errors.push(`${itemLabel} debe tener un precio unitario mayor o igual a 0.`);
  }

  if (typeof item.alicuotaIva !== 'undefined' && !isValidIvaRate(item.alicuotaIva)) {
    errors.push(`${itemLabel} debe tener una alícuota IVA entre 0 y 1.`);
  }
};

export interface ValidacionFacturaBResult {
  ok: boolean;
  estadoFiscal: EstadoFiscal;
  warnings: string[];
  errors: string[];
  modalidad: ModalidadFactura;
}

export const validarFacturaB = (
  input: EmitirFacturaInput,
  config: ArcaConfig,
): ValidacionFacturaBResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const enabledKey = getEnabledKey(input.modalidad);
  const enabled = config.enabledModalities[enabledKey];

  if (!enabled) {
    return {
      ok: false,
      estadoFiscal: 'PENDIENTE_CREDENCIALES',
      warnings,
      errors: [
        input.modalidad === 'FACTURA_A'
          ? 'Factura A pendiente de credenciales/certificados.'
          : input.modalidad === 'FACTURA_MIXTA'
            ? 'Factura Mixta pendiente de credenciales/certificados.'
            : 'La modalidad fiscal solicitada está pendiente de credenciales/certificados.',
      ],
      modalidad: input.modalidad,
    };
  }

  validateClienteFiscal(input.cliente, errors);

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('Debe existir al menos un item facturable.');
  } else {
    input.items.forEach((item, index) => validateItem(item, index, errors));
  }

  if ((input.moneda ?? 'ARS') !== 'ARS') {
    errors.push('Solo se admite moneda ARS.');
  }

  if (errors.length === 0) {
    const { totales } = calcularFacturaBSimulada(input, config);
    if (totales.total < 0) {
      errors.push('El total debe ser mayor o igual a 0.');
    }
  }

  if (errors.length === 0) {
    const hasDefaultIva = input.items.some((item) => typeof item.alicuotaIva !== 'number');
    if (hasDefaultIva) {
      warnings.push('Se aplicó la alícuota IVA por defecto en los items sin definición explícita.');
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      estadoFiscal: 'RECHAZADA',
      warnings,
      errors,
      modalidad: input.modalidad,
    };
  }

  return {
    ok: true,
    estadoFiscal: 'VALIDANDO',
    warnings,
    errors: [],
    modalidad: input.modalidad,
  };
};

const buildFacturaItem = (item: FacturaItemInput, defaultIvaRate: number): FacturaItem => {
  const alicuotaIva = typeof item.alicuotaIva === 'number' ? item.alicuotaIva : defaultIvaRate;
  const subtotal = roundMoney(item.cantidad * item.precioUnitario);
  const iva = roundMoney(subtotal * alicuotaIva);

  return {
    ...item,
    alicuotaIva,
    subtotal,
    iva,
    total: roundMoney(subtotal + iva),
  };
};

export interface FacturaBSimulada {
  items: FacturaItem[];
  totales: FacturaTotales;
}

export const calcularFacturaBSimulada = (
  input: EmitirFacturaInput,
  config: ArcaConfig,
): FacturaBSimulada => {
  const itemsInput = Array.isArray(input.items) ? input.items : [];
  const items = itemsInput.map((item) => buildFacturaItem(item, config.simulation.defaultIvaRate));
  const subtotal = roundMoney(items.reduce((acc, item) => acc + item.subtotal, 0));
  const iva = roundMoney(items.reduce((acc, item) => acc + item.iva, 0));
  const total = roundMoney(subtotal + iva);

  return {
    items,
    totales: {
      subtotal,
      iva,
      total,
    },
  };
};
