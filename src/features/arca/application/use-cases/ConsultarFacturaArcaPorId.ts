import type { ArcaConsultaRepositoryPort } from '../ports/ArcaConsultaRepositoryPort';
import type {
  ArcaConsultaItemResult,
  ArcaFacturaConsulta,
  ConsultarFacturaArcaPorIdInput,
} from '../dto/ArcaConsultaHistorial';
import { SupabaseArcaConsultaRepository } from '../../infrastructure/repositories/SupabaseArcaConsultaRepository';

export interface ConsultarFacturaArcaPorIdDeps {
  repository?: ArcaConsultaRepositoryPort;
}

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  return fallback;
};

export const consultarFacturaArcaPorId = async (
  input: ConsultarFacturaArcaPorIdInput,
  deps: ConsultarFacturaArcaPorIdDeps = {},
): Promise<ArcaConsultaItemResult<ArcaFacturaConsulta>> => {
  const repository = deps.repository ?? new SupabaseArcaConsultaRepository();

  if (!input.facturaId.trim()) {
    return {
      ok: false,
      data: null,
      warnings: [],
      errors: ['El ID de factura es obligatorio.'],
    };
  }

  try {
    const data = await repository.consultarFacturaPorId(input.facturaId.trim());
    if (!data) {
      return {
        ok: false,
        data: null,
        warnings: [],
        errors: ['Factura fiscal no encontrada.'],
      };
    }

    return {
      ok: true,
      data,
      warnings: [],
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      warnings: [],
      errors: [toErrorMessage(error, 'No se pudo consultar la factura ARCA.')],
    };
  }
};
