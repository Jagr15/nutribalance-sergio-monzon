import type { ArcaConsultaRepositoryPort } from '../ports/ArcaConsultaRepositoryPort';
import type {
  ArcaConsultaListaResult,
  ArcaEventoFiscalConsulta,
  ConsultarEventosFiscalesArcaFiltros,
} from '../dto/ArcaConsultaHistorial';
import { SupabaseArcaConsultaRepository } from '../../infrastructure/repositories/SupabaseArcaConsultaRepository';

export interface ConsultarEventosFiscalesArcaDeps {
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

export const consultarEventosFiscalesArca = async (
  filtros: ConsultarEventosFiscalesArcaFiltros = {},
  deps: ConsultarEventosFiscalesArcaDeps = {},
): Promise<ArcaConsultaListaResult<ArcaEventoFiscalConsulta>> => {
  const repository = deps.repository ?? new SupabaseArcaConsultaRepository();

  try {
    const data = await repository.consultarEventosFiscales(filtros);
    return buildOk(data);
  } catch (error) {
    return buildError<ArcaEventoFiscalConsulta>(toErrorMessage(error, 'No se pudieron consultar los eventos fiscales ARCA.'));
  }
};
