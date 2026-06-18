import type { EmitirFacturaInput } from '../dto/EmitirFacturaInput';
import type { ArcaConfig } from '../../infrastructure/config/arcaConfig';
import { validarFacturaB, type ValidacionFacturaBResult } from '../utils/facturaB';

export type ValidacionFacturaResult = ValidacionFacturaBResult;

export const validarFactura = (
  input: EmitirFacturaInput,
  config: ArcaConfig,
): ValidacionFacturaResult => {
  return validarFacturaB(input, config);
};
