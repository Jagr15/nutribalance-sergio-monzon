import type { ArcaConsultaRepositoryPort } from '../ports/ArcaConsultaRepositoryPort';
import type {
  ArcaConsultaListaResult,
  ArcaComprobanteConsulta,
  ConsultarComprobantesArcaFiltros,
} from '../dto/ArcaConsultaHistorial';
import { SupabaseArcaConsultaRepository } from '../../infrastructure/repositories/SupabaseArcaConsultaRepository';

export interface ConsultarComprobantesArcaDeps {
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

export const consultarComprobantesArca = async (
  filtros: ConsultarComprobantesArcaFiltros = {},
  deps: ConsultarComprobantesArcaDeps = {},
): Promise<ArcaConsultaListaResult<ArcaComprobanteConsulta>> => {
  const repository = deps.repository ?? new SupabaseArcaConsultaRepository();

  try {
    const data = await repository.consultarComprobantes(filtros);
    return buildOk(data);
  } catch (error) {
    return buildError<ArcaComprobanteConsulta>(toErrorMessage(error, 'No se pudieron consultar los comprobantes ARCA.'));
  }
};
