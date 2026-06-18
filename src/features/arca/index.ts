export type { ClienteFiscal, TipoDocumentoFiscal } from './domain/entities/ClienteFiscal';
export type { Comprobante } from './domain/entities/Comprobante';
export type { Factura, FacturaItem, FacturaItemInput, FacturaTotales } from './domain/entities/Factura';
export type { ResultadoEmision } from './domain/entities/ResultadoEmision';
export { ArcaError } from './domain/errors/ArcaError';
export { CredencialesFaltantesError } from './domain/errors/CredencialesFaltantesError';
export { ModalidadNoHabilitadaError } from './domain/errors/ModalidadNoHabilitadaError';
export type { CondicionIva } from './domain/value-objects/CondicionIva';
export type { EstadoFiscal } from './domain/value-objects/EstadoFiscal';
export type { ModalidadFactura, TipoFactura } from './domain/value-objects/TipoFactura';
export type { EmitirFacturaInput } from './application/dto/EmitirFacturaInput';
export type { EmitirFacturaBManualInput, EmitirFacturaBManualItemInput, EmitirFacturaBManualResult } from './application/dto/EmitirFacturaBManualInput';
export type {
  ArcaConsultaItemResult,
  ArcaConsultaListaResult,
  ArcaComprobanteConsulta,
  ArcaEventoFiscalConsulta,
  ArcaFacturaConsulta,
  ConsultarComprobantesArcaFiltros,
  ConsultarEventosFiscalesArcaFiltros,
  ConsultarFacturaArcaPorIdInput,
  ConsultarFacturasArcaFiltros,
} from './application/dto/ArcaConsultaHistorial';
export type { EmitirFacturaResult } from './application/dto/EmitirFacturaResult';
export type { ArcaProvider } from './application/ports/ArcaProvider';
export type { ClockPort } from './application/ports/ClockPort';
export type { IdGeneratorPort } from './application/ports/IdGeneratorPort';
export type { ArcaFiscalAuditPort } from './application/ports/ArcaFiscalAuditPort';
export type { ArcaFiscalEventRepositoryPort, ArcaEventoFiscalInput, ArcaEventoFiscalPersistido } from './application/ports/ArcaFiscalEventRepositoryPort';
export type { ArcaFiscalPersistencePort, ArcaFacturaPersistida, ArcaComprobantePersistido } from './application/ports/ArcaFiscalPersistencePort';
export type { ArcaConsultaRepositoryPort } from './application/ports/ArcaConsultaRepositoryPort';
export type { ClienteFiscalMappingResult, MapClienteFiscalOptions } from './infrastructure/mappers/clienteFiscalMapper';
export { emitirFactura } from './application/use-cases/EmitirFactura';
export { emitirFacturaBManual } from './application/use-cases/EmitirFacturaBManual';
export { consultarComprobantesArca } from './application/use-cases/ConsultarComprobantesArca';
export { consultarEventosFiscalesArca } from './application/use-cases/ConsultarEventosFiscalesArca';
export { consultarFacturaArcaPorId } from './application/use-cases/ConsultarFacturaArcaPorId';
export { consultarFacturasArca } from './application/use-cases/ConsultarFacturasArca';
export { simularFactura } from './application/use-cases/SimularFactura';
export { validarFactura } from './application/use-cases/ValidarFactura';
export { calcularFacturaBSimulada, formatSimulatedComprobanteNumero, roundMoney } from './application/utils/facturaB';
export { ARCA_CONFIG } from './infrastructure/config/arcaConfig';
export type { ArcaConfig, ArcaMode } from './infrastructure/config/arcaConfig';
export { ArcaSimulationProvider } from './infrastructure/providers/ArcaSimulationProvider';
export { ArcaRealProvider } from './infrastructure/providers/ArcaRealProvider';
export { createArcaProvider } from './infrastructure/providers/ArcaProviderFactory';
export { ArcaFiscalAuditAdapter } from './infrastructure/audit/ArcaFiscalAuditAdapter';
export { SupabaseArcaFiscalRepository } from './infrastructure/repositories/SupabaseArcaFiscalRepository';
export { SupabaseArcaEventoFiscalRepository } from './infrastructure/repositories/SupabaseArcaEventoFiscalRepository';
export { SupabaseArcaConsultaRepository } from './infrastructure/repositories/SupabaseArcaConsultaRepository';
export { inferirCondicionIvaCliente, inferirTipoDocumentoFiscal, mapClienteToClienteFiscal } from './infrastructure/mappers/clienteFiscalMapper';
