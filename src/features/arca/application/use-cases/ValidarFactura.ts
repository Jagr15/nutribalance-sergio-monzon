import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';
import type { ModalidadFactura } from '../../domain/value-objects/TipoFactura';

export interface ValidacionFacturaResult {
  ok: boolean;
  estadoFiscal: EstadoFiscal;
  warnings: string[];
  errors: string[];
  modalidad: ModalidadFactura;
}

const getEnabledKey = (modalidad: ModalidadFactura): keyof ArcaConfig['enabledModalities'] => modalidad;

export const validarFactura = (
  input: EmitirFacturaInput,
  config: ArcaConfig,
): ValidacionFacturaResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!input.cliente) {
    errors.push('El cliente fiscal es obligatorio.');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('Debe existir al menos un item.');
  }

  for (const item of input.items ?? []) {
    if (!item.concepto?.trim()) {
      errors.push('Cada item debe tener un concepto.');
      break;
    }
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      errors.push('La cantidad debe ser mayor a 0.');
      break;
    }
    if (!Number.isFinite(item.precioUnitario) || item.precioUnitario < 0) {
      errors.push('El precio unitario debe ser mayor o igual a 0.');
      break;
    }
  }

  if ((input.moneda ?? 'ARS') !== 'ARS') {
    errors.push('Solo se admite moneda ARS.');
  }

  const enabledKey = getEnabledKey(input.modalidad);
  const enabled = config.enabledModalities[enabledKey];

  if (!enabled) {
    return {
      ok: false,
      estadoFiscal: 'PENDIENTE_CREDENCIALES',
      warnings,
      errors: errors.length > 0 ? errors : ['La modalidad fiscal solicitada está pendiente de credenciales/certificados.'],
      modalidad: input.modalidad,
    };
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

  if (input.modalidad === 'FACTURA_B' && config.mode === 'SIMULACION') {
    warnings.push('Factura B emitida en modo simulación.');
  }

  return {
    ok: true,
    estadoFiscal: 'VALIDANDO',
    warnings,
    errors: [],
    modalidad: input.modalidad,
  };
};
