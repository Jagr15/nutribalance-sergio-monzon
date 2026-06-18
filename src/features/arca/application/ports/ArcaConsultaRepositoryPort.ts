import type {
  ArcaComprobanteConsulta,
  ArcaEventoFiscalConsulta,
  ArcaFacturaConsulta,
  ConsultarComprobantesArcaFiltros,
  ConsultarEventosFiscalesArcaFiltros,
  ConsultarFacturasArcaFiltros,
} from '../dto/ArcaConsultaHistorial';

export interface ArcaConsultaRepositoryPort {
  consultarFacturas: (filtros: ConsultarFacturasArcaFiltros) => Promise<ArcaFacturaConsulta[]>;
  consultarFacturaPorId: (facturaId: string) => Promise<ArcaFacturaConsulta | null>;
  consultarComprobantes: (filtros: ConsultarComprobantesArcaFiltros) => Promise<ArcaComprobanteConsulta[]>;
  consultarEventosFiscales: (filtros: ConsultarEventosFiscalesArcaFiltros) => Promise<ArcaEventoFiscalConsulta[]>;
}
