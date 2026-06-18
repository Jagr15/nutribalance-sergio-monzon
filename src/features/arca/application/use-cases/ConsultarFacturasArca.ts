import type { ArcaConsultaRepositoryPort } from '../ports/ArcaConsultaRepositoryPort';
import type {
  ArcaConsultaListaResult,
  ArcaFacturaConsulta,
  ConsultarFacturasArcaFiltros,
} from '../dto/ArcaConsultaHistorial';
import { SupabaseArcaConsultaRepository } from '../../infrastructure/repositories/SupabaseArcaConsultaRepository';

export interface ConsultarFacturasArcaDeps {
  repository?: ArcaConsultaRepositoryPort;
}

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const buildOk = <T>(data: T[]): ArcaConsultaListaResult<T> => ({
  ok: true,
  data,
  warnings: [],
  errors: [],
});

const buildError = <T>(message: string): ArcaConsultaListaResult<T> => ({
  ok: false,
  data: [],
  warnings: [],
  errors: [message],
});

export const consultarFacturasArca = async (
  filtros: ConsultarFacturasArcaFiltros = {},
  deps: ConsultarFacturasArcaDeps = {},
): Promise<ArcaConsultaListaResult<ArcaFacturaConsulta>> => {
  const repository = deps.repository ?? new SupabaseArcaConsultaRepository();

  try {
    const data = await repository.consultarFacturas(filtros);
    return buildOk(data);
  } catch (error) {
    return buildError<ArcaFacturaConsulta>(toErrorMessage(error, 'No se pudieron consultar las facturas ARCA.'));
  }
};
