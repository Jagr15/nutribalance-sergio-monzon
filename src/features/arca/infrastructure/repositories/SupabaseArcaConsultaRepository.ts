import { supabaseClient } from '../../../../infrastructure/api/supabase/client';
import type {
  ArcaComprobanteConsulta,
  ArcaEventoFiscalConsulta,
  ArcaFacturaConsulta,
  ConsultarComprobantesArcaFiltros,
  ConsultarEventosFiscalesArcaFiltros,
  ConsultarFacturasArcaFiltros,
} from '../../application/dto/ArcaConsultaHistorial';
import type { ArcaConsultaRepositoryPort } from '../../application/ports/ArcaConsultaRepositoryPort';
import type { ArcaMode } from '../config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';
import type { TipoFactura } from '../../domain/value-objects/TipoFactura';

interface ArcaFacturaRow {
  id: string;
  modalidad: TipoFactura;
  tipo_comprobante: 'A' | 'B' | 'MIXTA';
  cliente_nombre: string;
  cliente_documento: string;
  cliente_condicion_iva: string;
  moneda: 'ARS';
  subtotal: number;
  impuestos: number;
  total: number;
  estado_fiscal: EstadoFiscal;
  numero_comprobante: string | null;
  punto_venta: string | null;
  cae: string | null;
  cae_vencimiento: string | null;
  provider_mode: ArcaMode;
  source_entidad: string | null;
  source_entidad_id: string | null;
  created_at: string;
}

interface ArcaComprobanteRow {
  id: string;
  factura_id: string;
  modalidad: TipoFactura;
  numero: string;
  punto_venta: string | null;
  cae: string | null;
  cae_vencimiento: string | null;
  estado: EstadoFiscal;
  provider_mode: ArcaMode;
  response_raw: unknown;
  created_at: string;
}

interface ArcaEventoFiscalRow {
  id: string;
  factura_id: string | null;
  comprobante_id: string | null;
  accion: string;
  estado: EstadoFiscal;
  provider_mode: ArcaMode;
  mensaje: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const normalizeDate = (value: string | Date): string | null => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const mapFacturaRow = (row: ArcaFacturaRow): ArcaFacturaConsulta => ({
  id: row.id,
  modalidad: row.modalidad,
  tipoComprobante: row.tipo_comprobante,
  clienteNombre: row.cliente_nombre,
  clienteDocumento: row.cliente_documento,
  clienteCondicionIva: row.cliente_condicion_iva,
  moneda: row.moneda,
  subtotal: Number(row.subtotal),
  impuestos: Number(row.impuestos),
  total: Number(row.total),
  estadoFiscal: row.estado_fiscal,
  numeroComprobante: row.numero_comprobante,
  puntoVenta: row.punto_venta,
  cae: row.cae,
  caeVencimiento: row.cae_vencimiento,
  providerMode: row.provider_mode,
  sourceEntidad: row.source_entidad,
  sourceEntidadId: row.source_entidad_id,
  createdAt: row.created_at,
});

const mapComprobanteRow = (row: ArcaComprobanteRow): ArcaComprobanteConsulta => ({
  id: row.id,
  facturaId: row.factura_id,
  modalidad: row.modalidad,
  numero: row.numero,
  puntoVenta: row.punto_venta,
  cae: row.cae,
  caeVencimiento: row.cae_vencimiento,
  estado: row.estado,
  providerMode: row.provider_mode,
  responseRaw: row.response_raw,
  createdAt: row.created_at,
});

const mapEventoRow = (row: ArcaEventoFiscalRow): ArcaEventoFiscalConsulta => ({
  id: row.id,
  facturaId: row.factura_id,
  comprobanteId: row.comprobante_id,
  accion: row.accion,
  estado: row.estado,
  providerMode: row.provider_mode,
  mensaje: row.mensaje,
  payload: row.payload,
  createdAt: row.created_at,
});

export class SupabaseArcaConsultaRepository implements ArcaConsultaRepositoryPort {
  async consultarFacturas(filtros: ConsultarFacturasArcaFiltros): Promise<ArcaFacturaConsulta[]> {
    let query = supabaseClient
      .from('arca_facturas')
      .select('id,modalidad,tipo_comprobante,cliente_nombre,cliente_documento,cliente_condicion_iva,moneda,subtotal,impuestos,total,estado_fiscal,numero_comprobante,punto_venta,cae,cae_vencimiento,provider_mode,source_entidad,source_entidad_id,created_at');

    if (filtros.modalidad) query = query.eq('modalidad', filtros.modalidad);
    if (filtros.estadoFiscal) query = query.eq('estado_fiscal', filtros.estadoFiscal);
    if (filtros.providerMode) query = query.eq('provider_mode', filtros.providerMode);
    if (filtros.clienteDocumento) query = query.eq('cliente_documento', filtros.clienteDocumento.trim());
    if (filtros.sourceEntidad) query = query.eq('source_entidad', filtros.sourceEntidad.trim());

    const desde = filtros.desde ? normalizeDate(filtros.desde) : null;
    const hasta = filtros.hasta ? normalizeDate(filtros.hasta) : null;

    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapFacturaRow(row as ArcaFacturaRow));
  }

  async consultarFacturaPorId(facturaId: string): Promise<ArcaFacturaConsulta | null> {
    const { data, error } = await supabaseClient
      .from('arca_facturas')
      .select('id,modalidad,tipo_comprobante,cliente_nombre,cliente_documento,cliente_condicion_iva,moneda,subtotal,impuestos,total,estado_fiscal,numero_comprobante,punto_venta,cae,cae_vencimiento,provider_mode,source_entidad,source_entidad_id,created_at')
      .eq('id', facturaId)
      .maybeSingle<ArcaFacturaRow>();

    if (error) throw error;
    return data ? mapFacturaRow(data) : null;
  }

  async consultarComprobantes(filtros: ConsultarComprobantesArcaFiltros): Promise<ArcaComprobanteConsulta[]> {
    let query = supabaseClient
      .from('arca_comprobantes')
      .select('id,factura_id,modalidad,numero,punto_venta,cae,cae_vencimiento,estado,provider_mode,response_raw,created_at');

    if (filtros.facturaId) query = query.eq('factura_id', filtros.facturaId.trim());
    if (filtros.numero) query = query.eq('numero', filtros.numero.trim());
    if (filtros.estado) query = query.eq('estado', filtros.estado);
    if (filtros.providerMode) query = query.eq('provider_mode', filtros.providerMode);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapComprobanteRow(row as ArcaComprobanteRow));
  }

  async consultarEventosFiscales(filtros: ConsultarEventosFiscalesArcaFiltros): Promise<ArcaEventoFiscalConsulta[]> {
    let query = supabaseClient
      .from('arca_eventos_fiscales')
      .select('id,factura_id,comprobante_id,accion,estado,provider_mode,mensaje,payload,created_at');

    if (filtros.facturaId) query = query.eq('factura_id', filtros.facturaId.trim());
    if (filtros.comprobanteId) query = query.eq('comprobante_id', filtros.comprobanteId.trim());
    if (filtros.accion) query = query.eq('accion', filtros.accion.trim());
    if (filtros.estado) query = query.eq('estado', filtros.estado);
    if (filtros.providerMode) query = query.eq('provider_mode', filtros.providerMode);

    const desde = filtros.desde ? normalizeDate(filtros.desde) : null;
    const hasta = filtros.hasta ? normalizeDate(filtros.hasta) : null;

    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapEventoRow(row as ArcaEventoFiscalRow));
  }
}
