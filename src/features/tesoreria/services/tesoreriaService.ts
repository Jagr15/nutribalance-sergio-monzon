import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import type { EstadoChequeTesoreria, TipoChequeTesoreria, ChequeTesoreriaRow } from '../../finanzas/types';
import { contabilidadOperativaService } from '../../finanzas/services/contabilidadOperativaService';

export interface ChequeTesoreriaFormValues {
  numero: string;
  tipo: TipoChequeTesoreria | '';
  tercero: string;
  importe: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_acreditacion?: string;
  estado: EstadoChequeTesoreria | '';
  cliente_id?: string | null;
  cliente_nombre?: string | null;
}

type ChequeTesoreriaDbRow = ChequeTesoreriaRow & {
  updated_at?: string | null;
  legacy_uid?: string | null;
};

const STORAGE_KEY = 'nutribalance_tesoreria_cheques_v1';
const ESTADOS_VALIDOS = new Set<EstadoChequeTesoreria>(['PENDIENTE', 'DEPOSITADO', 'COBRADO', 'RECHAZADO', 'VENCIDO']);

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');

const formatDbError = (action: string, error: unknown) => {
  if (error && typeof error === 'object') {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [
      `No se pudo ${action}.`,
      typeof maybe.message === 'string' ? maybe.message : null,
      typeof maybe.details === 'string' ? maybe.details : null,
      typeof maybe.hint === 'string' ? maybe.hint : null,
      typeof maybe.code === 'string' ? `código ${maybe.code}` : null,
    ].filter(Boolean).join(' ');
  }
  return `No se pudo ${action}.`;
};

const readMockCheques = (): ChequeTesoreriaDbRow[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ChequeTesoreriaDbRow[]) : [];
  } catch {
    return [];
  }
};

const writeMockCheques = (rows: ChequeTesoreriaDbRow[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

const normalizeCheque = (row: ChequeTesoreriaDbRow): ChequeTesoreriaRow => ({
  id: row.id,
  numero: row.numero,
  tipo: row.tipo,
  tercero: row.tercero,
  importe: Number(row.importe ?? 0),
  fecha_emision: row.fecha_emision,
  fecha_vencimiento: row.fecha_vencimiento,
  fecha_acreditacion: row.fecha_acreditacion ?? null,
  estado: row.estado,
  cliente_id: row.cliente_id ?? null,
  cliente_nombre: row.cliente_nombre ?? null,
});

const validatePayload = (payload: ChequeTesoreriaFormValues) => {
  const numero = cleanText(payload.numero ?? '');
  const tercero = cleanText(payload.tercero ?? '');
  const tipo = payload.tipo;
  const estado = payload.estado;

  if (!numero) throw new Error('El número del cheque es obligatorio.');
  if (tipo !== 'EMITIDO' && tipo !== 'RECIBIDO') throw new Error('El tipo del cheque es obligatorio.');
  if (!tercero) throw new Error('El tercero del cheque es obligatorio.');
  if (!Number.isFinite(payload.importe) || payload.importe <= 0) throw new Error('El importe del cheque debe ser mayor a 0.');
  if (!payload.fecha_emision?.trim()) throw new Error('La fecha de emisión es obligatoria.');
  if (!payload.fecha_vencimiento?.trim()) throw new Error('La fecha de vencimiento es obligatoria.');
  if (!ESTADOS_VALIDOS.has(estado as EstadoChequeTesoreria)) throw new Error('El estado del cheque es obligatorio.');

  return {
    numero,
    tipo,
    tercero,
    importe: payload.importe,
    fecha_emision: payload.fecha_emision,
    fecha_vencimiento: payload.fecha_vencimiento,
    fecha_acreditacion: payload.fecha_acreditacion?.trim() || null,
    estado: estado as EstadoChequeTesoreria,
    cliente_id: payload.cliente_id ?? null,
    cliente_nombre: payload.cliente_nombre ?? null,
  };
};

export const tesoreriaService = {
  async getCheques(params: {
    tipo?: TipoChequeTesoreria;
    estado?: EstadoChequeTesoreria;
    query?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ChequeTesoreriaRow[]> {
    if (runtimeConfig.mode === 'mock') {
      const query = cleanText(params.query ?? '').toLowerCase();
      return readMockCheques()
        .filter((row) => (params.tipo ? row.tipo === params.tipo : true))
        .filter((row) => (params.estado ? row.estado === params.estado : true))
        .filter((row) => {
          if (!query) return true;
          return row.numero.toLowerCase().includes(query) || row.tercero.toLowerCase().includes(query);
        })
        .filter((row) => (params.fechaDesde ? row.fecha_vencimiento >= params.fechaDesde : true))
        .filter((row) => (params.fechaHasta ? row.fecha_vencimiento <= params.fechaHasta : true))
        .slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50))
        .map(normalizeCheque);
    }

    let query = supabaseClient
      .from('tesoreria_cheques')
      .select('id,numero,tipo,tercero,importe,fecha_emision,fecha_vencimiento,fecha_acreditacion,estado,cliente_id,cliente_nombre')
      .order('fecha_vencimiento', { ascending: true });

    if (params.tipo) query = query.eq('tipo', params.tipo);
    if (params.estado) query = query.eq('estado', params.estado);
    if (params.query) query = query.or(`numero.ilike.%${params.query}%,tercero.ilike.%${params.query}%`);
    if (params.fechaDesde) query = query.gte('fecha_vencimiento', params.fechaDesde);
    if (params.fechaHasta) query = query.lte('fecha_vencimiento', params.fechaHasta);
    if (typeof params.limit === 'number') query = query.limit(params.limit);
    if (typeof params.offset === 'number') query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => normalizeCheque(row as ChequeTesoreriaDbRow));
  },

  async createCheque(payload: ChequeTesoreriaFormValues): Promise<ChequeTesoreriaRow> {
    const normalized = validatePayload(payload);
    if (runtimeConfig.mode === 'mock') {
      const next: ChequeTesoreriaDbRow = { ...normalized, id: `chq-${Date.now()}` };
      writeMockCheques([next, ...readMockCheques()]);
      return normalizeCheque(next);
    }
    const { data, error } = await supabaseClient.from('tesoreria_cheques').insert({
      numero: normalized.numero,
      tipo: normalized.tipo,
      tercero: normalized.tercero,
      importe: normalized.importe,
      fecha_emision: normalized.fecha_emision,
      fecha_vencimiento: normalized.fecha_vencimiento,
      fecha_acreditacion: normalized.fecha_acreditacion ?? null,
      estado: normalized.estado,
      cliente_id: normalized.cliente_id,
      cliente_nombre: normalized.cliente_nombre,
    }).select('id,numero,tipo,tercero,importe,fecha_emision,fecha_vencimiento,fecha_acreditacion,estado,cliente_id,cliente_nombre').single<ChequeTesoreriaDbRow>();
    if (error) throw new Error(formatDbError('guardar el cheque', error));
    return normalizeCheque(data);
  },

  async updateCheque(id: string, payload: ChequeTesoreriaFormValues): Promise<ChequeTesoreriaRow> {
    const normalized = validatePayload(payload);
    if (runtimeConfig.mode === 'mock') {
      const nextRows = readMockCheques().map((row) => (row.id === id ? { ...row, ...normalized } : row));
      writeMockCheques(nextRows);
      const updated = nextRows.find((row) => row.id === id);
      if (!updated) throw new Error(`Cheque ${id} no encontrado`);
      return normalizeCheque(updated);
    }
    const { data, error } = await supabaseClient.from('tesoreria_cheques').update({
      numero: normalized.numero,
      tipo: normalized.tipo,
      tercero: normalized.tercero,
      importe: normalized.importe,
      fecha_emision: normalized.fecha_emision,
      fecha_vencimiento: normalized.fecha_vencimiento,
      fecha_acreditacion: normalized.fecha_acreditacion ?? null,
      estado: normalized.estado,
      cliente_id: normalized.cliente_id,
      cliente_nombre: normalized.cliente_nombre,
    }).eq('id', id).select('id,numero,tipo,tercero,importe,fecha_emision,fecha_vencimiento,fecha_acreditacion,estado,cliente_id,cliente_nombre').single<ChequeTesoreriaDbRow>();
    if (error) throw new Error(formatDbError('actualizar el cheque', error));
    return normalizeCheque(data);
  },

  async updateChequeEstado(id: string, estado: EstadoChequeTesoreria): Promise<ChequeTesoreriaRow> {
    if (!ESTADOS_VALIDOS.has(estado)) throw new Error('El estado del cheque es obligatorio.');
    if (runtimeConfig.mode === 'mock') {
      const nextRows = readMockCheques().map((row) => (row.id === id ? { ...row, estado } : row));
      writeMockCheques(nextRows);
      const updated = nextRows.find((row) => row.id === id);
      if (!updated) throw new Error(`Cheque ${id} no encontrado`);
      if (estado === 'COBRADO' && updated.tipo === 'RECIBIDO') {
        await contabilidadOperativaService.registrarCobranzaComprobante({
          comprobante_legacy_uid: `chq-${updated.id}`,
          fecha: new Date().toISOString(),
          tercero: updated.tercero,
          monto: updated.importe,
          cliente: updated.cliente_nombre ?? null,
          referencia: `Cobranza por cheque ${updated.numero}`,
        });
      }
      if ((estado === 'DEPOSITADO' || estado === 'COBRADO') && updated.tipo === 'EMITIDO') {
        await contabilidadOperativaService.registrarPagoComprobante({
          comprobante_legacy_uid: `chq-${updated.id}`,
          fecha: new Date().toISOString(),
          tercero: updated.tercero,
          monto: updated.importe,
          referencia: `Pago por cheque ${updated.numero}`,
        });
      }
      return normalizeCheque(updated);
    }
    const { data: current, error: currentError } = await supabaseClient
      .from('tesoreria_cheques')
      .select('id,numero,tipo,tercero,importe,fecha_emision,fecha_vencimiento,fecha_acreditacion,estado,cliente_id,cliente_nombre')
      .eq('id', id)
      .maybeSingle<ChequeTesoreriaDbRow>();
    if (currentError) throw currentError;
    const { data, error } = await supabaseClient.from('tesoreria_cheques').update({ estado }).eq('id', id).select('id,numero,tipo,tercero,importe,fecha_emision,fecha_vencimiento,fecha_acreditacion,estado,cliente_id,cliente_nombre').single<ChequeTesoreriaDbRow>();
    if (error) throw new Error(formatDbError('actualizar el estado del cheque', error));
    if (current && estado === 'COBRADO' && current.tipo === 'RECIBIDO') {
      await contabilidadOperativaService.registrarCobranzaComprobante({
        comprobante_legacy_uid: `chq-${current.id}`,
        fecha: new Date().toISOString(),
        tercero: current.tercero,
        monto: Number(current.importe ?? 0),
        cliente: current.cliente_nombre ?? null,
        referencia: `Cobranza por cheque ${current.numero}`,
      });
    }
    if (current && (estado === 'DEPOSITADO' || estado === 'COBRADO') && current.tipo === 'EMITIDO') {
      await contabilidadOperativaService.registrarPagoComprobante({
        comprobante_legacy_uid: `chq-${current.id}`,
        fecha: new Date().toISOString(),
        tercero: current.tercero,
        monto: Number(current.importe ?? 0),
        referencia: `Pago por cheque ${current.numero}`,
      });
    }
    return normalizeCheque(data);
  },
};
