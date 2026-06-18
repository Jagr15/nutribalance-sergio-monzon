import type { ArcaFiscalEventRepositoryPort, ArcaEventoFiscalPersistido } from '../../application/ports/ArcaFiscalEventRepositoryPort';
import type { ArcaMode } from '../config/arcaConfig';
import type { EstadoFiscal } from '../../domain/value-objects/EstadoFiscal';
import { supabaseClient } from '../../../../infrastructure/api/supabase/client';

interface ArcaEventoFiscalRow {
  id: string;
  created_at: string;
}

export class SupabaseArcaEventoFiscalRepository implements ArcaFiscalEventRepositoryPort {
  async registrarEvento(input: {
    facturaId?: string;
    comprobanteId?: string;
    accion: string;
    estado: EstadoFiscal;
    providerMode: ArcaMode;
    mensaje?: string;
    payload?: Record<string, unknown>;
  }): Promise<ArcaEventoFiscalPersistido> {
    const { data, error } = await supabaseClient
      .from('arca_eventos_fiscales')
      .insert({
        factura_id: input.facturaId ?? null,
        comprobante_id: input.comprobanteId ?? null,
        accion: input.accion,
        estado: input.estado,
        provider_mode: input.providerMode,
        mensaje: input.mensaje ?? null,
        payload: input.payload ?? null,
      })
      .select('id,created_at')
      .single<ArcaEventoFiscalRow>();

    if (error) throw error;

    return {
      id: data.id,
      createdAt: data.created_at,
    };
  }
}
