import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';

export type HistorialCargaEstado = 'pendiente' | 'validado' | 'importado' | 'errores';

export interface MovimientoHistoricoImportRow {
  legacy_uid?: string;
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  descripcion: string;
  monto: number;
  origen_operativo: string;
  categoria_id?: string | null;
  centro_costo_id?: string | null;
  estado?: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
}

export interface HistoricoImportResultado {
  estado: HistorialCargaEstado;
  total: number;
  importados: number;
  duplicados: number;
  errores: string[];
}

type HistoricoContableDbRow = {
  legacy_uid: string;
  fecha: string;
  tipo: MovimientoHistoricoImportRow['tipo'];
  descripcion: string;
  monto: number | string;
  origen_operativo: string;
  estado: MovimientoHistoricoImportRow['estado'];
  source_batch_uid: string;
  content_hash: string;
};

const STORAGE_KEY = 'nutribalance_historico_contable_v1';

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalize = (value: string) => cleanText(value).toLowerCase();
const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return `h${Math.abs(hash)}`;
};

const buildContentHash = (row: Pick<MovimientoHistoricoImportRow, 'fecha' | 'tipo' | 'descripcion' | 'monto' | 'origen_operativo'>) =>
  hashString([row.fecha, row.tipo, cleanText(row.descripcion), row.monto, cleanText(row.origen_operativo)].join('|'));

const buildLegacyUid = (row: Pick<MovimientoHistoricoImportRow, 'legacy_uid' | 'fecha' | 'tipo' | 'descripcion' | 'monto' | 'origen_operativo'>) =>
  row.legacy_uid?.trim() || `hist-${buildContentHash(row)}`;

const readMock = (): MovimientoHistoricoImportRow[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as MovimientoHistoricoImportRow[]) : [];
  } catch {
    return [];
  }
};

const writeMock = (rows: MovimientoHistoricoImportRow[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

const parseMonto = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const validateRow = (row: Partial<MovimientoHistoricoImportRow>, index: number) => {
  const errores: string[] = [];
  if (!row.fecha?.trim()) errores.push(`Fila ${index + 1}: la fecha es obligatoria.`);
  if (!row.tipo || !['INGRESO', 'EGRESO', 'TRANSFERENCIA'].includes(row.tipo)) errores.push(`Fila ${index + 1}: tipo inválido.`);
  if (!row.descripcion?.trim()) errores.push(`Fila ${index + 1}: la descripción es obligatoria.`);
  if (!row.origen_operativo?.trim()) errores.push(`Fila ${index + 1}: el origen operativo es obligatorio.`);
  const monto = parseMonto(row.monto);
  if (!Number.isFinite(monto) || monto <= 0) errores.push(`Fila ${index + 1}: el monto debe ser mayor a 0.`);
  return { errores, normalized: row as MovimientoHistoricoImportRow };
};

export const parseHistoricoCsv = (content: string): MovimientoHistoricoImportRow[] => {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((header) => normalize(header));
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index]?.trim() ?? '';
      return acc;
    }, {});
    const monto = parseMonto(row.monto);
    return {
      legacy_uid: row.legacy_uid || undefined,
      fecha: row.fecha,
      tipo: row.tipo as MovimientoHistoricoImportRow['tipo'],
      descripcion: row.descripcion,
      monto: Number.isFinite(monto) ? monto : 0,
      origen_operativo: row.origen_operativo,
      categoria_id: row.categoria_id || null,
      centro_costo_id: row.centro_costo_id || null,
      estado: (row.estado as MovimientoHistoricoImportRow['estado']) || 'CONFIRMADO',
    };
  });
};

export const historicoContableService = {
  getRows(): MovimientoHistoricoImportRow[] {
    if (runtimeConfig.mode === 'supabase') {
      throw new Error('getRows no debe usarse directamente en Supabase. Use refreshRows().');
    }
    return readMock();
  },

  async refreshRows(): Promise<MovimientoHistoricoImportRow[]> {
    if (runtimeConfig.mode === 'mock') return readMock();
    const { data, error } = await supabaseClient
      .from('historico_contable_importado')
      .select('legacy_uid,fecha,tipo,descripcion,monto,origen_operativo,estado,source_batch_uid,content_hash')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as HistoricoContableDbRow[]).map((row) => ({
      legacy_uid: row.legacy_uid,
      fecha: row.fecha,
      tipo: row.tipo,
      descripcion: row.descripcion,
      monto: Number(row.monto),
      origen_operativo: row.origen_operativo,
      estado: row.estado,
    }));
  },

  getState(): HistorialCargaEstado {
    if (typeof window === 'undefined') return 'pendiente';
    return (window.localStorage.getItem(`${STORAGE_KEY}:state`) as HistorialCargaEstado | null) ?? 'pendiente';
  },

  validate(rows: MovimientoHistoricoImportRow[]): HistoricoImportResultado {
    const errores: string[] = [];
    const seen = new Set<string>();
    let duplicados = 0;

    rows.forEach((row, index) => {
      const validation = validateRow(row, index);
      errores.push(...validation.errores);
      const legacy = buildLegacyUid(row);
      const contentHash = buildContentHash(row);
      const signature = `${legacy}:${contentHash}`;
      if (seen.has(signature)) {
        duplicados += 1;
        errores.push(`Fila ${index + 1}: movimiento duplicado.`);
      }
      seen.add(signature);
    });

    return {
      estado: errores.length > 0 ? 'errores' : 'validado',
      total: rows.length,
      importados: 0,
      duplicados,
      errores,
    };
  },

  async importRows(rows: MovimientoHistoricoImportRow[]): Promise<HistoricoImportResultado> {
    const validation = this.validate(rows);
    if (validation.errores.length > 0) {
      if (typeof window !== 'undefined') window.localStorage.setItem(`${STORAGE_KEY}:state`, 'errores');
      return validation;
    }

    const normalizedRows = rows.map((row) => {
      const legacy_uid = buildLegacyUid(row);
      return {
        legacy_uid,
        fecha: row.fecha,
        tipo: row.tipo,
        descripcion: cleanText(row.descripcion),
        monto: row.monto,
        origen_operativo: cleanText(row.origen_operativo),
        categoria_id: row.categoria_id ?? null,
        centro_costo_id: row.centro_costo_id ?? null,
        estado: row.estado ?? 'CONFIRMADO',
      } satisfies MovimientoHistoricoImportRow;
    });

    if (runtimeConfig.mode === 'mock') {
      const current = readMock();
      const map = new Map(current.map((row) => [buildLegacyUid(row), row]));
      normalizedRows.forEach((row) => map.set(buildLegacyUid(row), row));
      writeMock([...map.values()]);
      if (typeof window !== 'undefined') window.localStorage.setItem(`${STORAGE_KEY}:state`, 'importado');
      return { ...validation, estado: 'importado', importados: normalizedRows.length };
    }

    const sourceBatchUid = `batch-${hashString(normalizedRows.map((row) => [row.legacy_uid, row.fecha, row.tipo, row.descripcion, row.monto, row.origen_operativo].join('|')).join('||'))}`;
    const payload = normalizedRows.map((row) => {
      const content_hash = buildContentHash(row);
      const legacy_uid = buildLegacyUid(row);
      return {
        legacy_uid,
        fecha: row.fecha,
        tipo: row.tipo,
        descripcion: row.descripcion,
        monto: row.monto,
        origen_operativo: row.origen_operativo,
        estado: row.estado ?? 'CONFIRMADO',
        source_batch_uid: sourceBatchUid,
        content_hash,
      };
    });

    const { error } = await supabaseClient.from('historico_contable_importado').upsert(payload, { onConflict: 'legacy_uid' });
    if (error) throw error;
    if (typeof window !== 'undefined') window.localStorage.setItem(`${STORAGE_KEY}:state`, 'importado');
    return { ...validation, estado: 'importado', importados: normalizedRows.length };
  },
};
