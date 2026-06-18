import type { ArcaMode } from '../../infrastructure/config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';
import type { TipoFactura } from '../../domain/value-objects/TipoFactura';

export interface ArcaFacturaConsulta {
  id: string;
  modalidad: TipoFactura;
  tipoComprobante: 'A' | 'B' | 'MIXTA';
  clienteNombre: string;
  clienteDocumento: string;
  clienteCondicionIva: string;
  moneda: 'ARS';
  subtotal: number;
  impuestos: number;
  total: number;
  estadoFiscal: EstadoFiscal;
  numeroComprobante?: string | null;
  puntoVenta?: string | null;
  cae?: string | null;
  caeVencimiento?: string | null;
  providerMode: ArcaMode;
  sourceEntidad?: string | null;
  sourceEntidadId?: string | null;
  createdAt: string;
}

export interface ArcaComprobanteConsulta {
  id: string;
  facturaId: string;
  modalidad: TipoFactura;
  numero: string;
  puntoVenta?: string | null;
  cae?: string | null;
  caeVencimiento?: string | null;
  estado: EstadoFiscal;
  providerMode: ArcaMode;
  responseRaw?: unknown;
  createdAt: string;
}

export interface ArcaEventoFiscalConsulta {
  id: string;
  facturaId?: string | null;
  comprobanteId?: string | null;
  accion: string;
  estado: EstadoFiscal;
  providerMode: ArcaMode;
  mensaje?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ConsultarFacturasArcaFiltros {
  modalidad?: TipoFactura;
  estadoFiscal?: EstadoFiscal;
  providerMode?: ArcaMode;
  clienteDocumento?: string;
  sourceEntidad?: string;
  desde?: string | Date;
  hasta?: string | Date;
}

export interface ConsultarFacturaArcaPorIdInput {
  facturaId: string;
}

export interface ConsultarComprobantesArcaFiltros {
  facturaId?: string;
  numero?: string;
  estado?: EstadoFiscal;
  providerMode?: ArcaMode;
}

export interface ConsultarEventosFiscalesArcaFiltros {
  facturaId?: string;
  comprobanteId?: string;
  accion?: string;
  estado?: EstadoFiscal;
  providerMode?: ArcaMode;
  desde?: string | Date;
  hasta?: string | Date;
}

export interface ArcaConsultaListaResult<T> {
  ok: boolean;
  data: T[];
  warnings: string[];
  errors: string[];
}

export interface ArcaConsultaItemResult<T> {
  ok: boolean;
  data: T | null;
  warnings: string[];
  errors: string[];
}
