import type { Comprobante } from '../../domain/entities/Comprobante';
import type { Factura } from '../../domain/entities/Factura';
import type { ArcaFiscalPersistencePort, ArcaComprobantePersistido, ArcaFacturaPersistida } from '../../application/ports/ArcaFiscalPersistencePort';
import type { ArcaMode } from '../config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';
import { supabaseClient } from '../../../../infrastructure/api/supabase/client';

interface ArcaFacturaRow {
  id: string;
  created_at: string;
}

interface ArcaComprobanteRow {
  id: string;
  factura_id: string;
  created_at: string;
}

const mapFacturaInsert = (factura: Factura, providerMode: ArcaMode, estadoFiscal: string) => ({
  modalidad: factura.modalidad,
  tipo_comprobante: factura.tipoComprobante,
  cliente_nombre: factura.clienteFiscal.nombre,
  cliente_documento: factura.clienteFiscal.numeroDocumento,
  cliente_condicion_iva: factura.clienteFiscal.condicionIva,
  moneda: factura.moneda,
  subtotal: factura.totales.subtotal,
  impuestos: factura.totales.iva,
  total: factura.totales.total,
  estado_fiscal: estadoFiscal,
  numero_comprobante: factura.numeroComprobante ?? null,
  punto_venta: factura.puntoVenta ?? null,
  cae: factura.cae ?? null,
  cae_vencimiento: factura.caeVencimiento ?? null,
  provider_mode: providerMode,
  source_entidad: factura.source?.entidad ?? null,
  source_entidad_id: factura.source?.entidadId ?? null,
});

const mapComprobanteInsert = (facturaId: string, comprobante: Comprobante, providerMode: ArcaMode) => ({
  factura_id: facturaId,
  modalidad: comprobante.modalidad,
  numero: comprobante.numero ?? '',
  punto_venta: comprobante.puntoVenta ?? null,
  cae: comprobante.cae ?? null,
  cae_vencimiento: comprobante.caeVencimiento ?? null,
  estado: comprobante.estado,
  provider_mode: providerMode,
  response_raw: comprobante.responseRaw ?? null,
});

export class SupabaseArcaFiscalRepository implements ArcaFiscalPersistencePort {
  async guardarFactura(input: {
    factura: Factura;
    providerMode: ArcaMode;
    estadoFiscal: EstadoFiscal;
  }): Promise<ArcaFacturaPersistida> {
    const { data, error } = await supabaseClient
      .from('arca_facturas')
      .insert(mapFacturaInsert(input.factura, input.providerMode, input.estadoFiscal))
      .select('id,created_at')
      .single<ArcaFacturaRow>();

    if (error) throw error;

    return {
      id: data.id,
      createdAt: data.created_at,
    };
  }

  async guardarComprobante(input: {
    facturaId: string;
    comprobante: Comprobante;
    providerMode: ArcaMode;
  }): Promise<ArcaComprobantePersistido> {
    const { data, error } = await supabaseClient
      .from('arca_comprobantes')
      .insert(mapComprobanteInsert(input.facturaId, input.comprobante, input.providerMode))
      .select('id,factura_id,created_at')
      .single<ArcaComprobanteRow>();

    if (error) throw error;

    return {
      id: data.id,
      facturaId: data.factura_id,
      createdAt: data.created_at,
    };
  }
}
