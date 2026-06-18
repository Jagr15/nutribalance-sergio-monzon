import { dashboardOperativoService } from '../../dashboard/services/dashboardOperativoService';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { finanzasService } from '../../finanzas/services/finanzasService';
import type { AlertaOperativa, EstadoAlerta } from '../types/alerta';

type PersistedAlertState = 'PENDIENTE' | 'EN_SEGUIMIENTO' | 'ATENDIDA' | 'DESCARTADA';
type AlertMeta = { prioridad: string; origen: string };
type AlertStateRow = {
  alerta_key: string;
  estado: PersistedAlertState | string;
  comentario?: string | null;
  usuario_id?: string | null;
  origen?: string | null;
  prioridad?: string | null;
  ultima_actualizacion?: string | null;
};

const STORAGE_KEY = 'nutribalance_alertas_estado';
const latestAlertMeta = new Map<string, AlertMeta>();

const UI_TO_DB_STATE: Record<EstadoAlerta, PersistedAlertState> = {
  pendiente: 'PENDIENTE',
  'en seguimiento': 'EN_SEGUIMIENTO',
  atendida: 'ATENDIDA',
  descartada: 'DESCARTADA',
};

const DB_TO_UI_STATE: Record<PersistedAlertState, EstadoAlerta> = {
  PENDIENTE: 'pendiente',
  EN_SEGUIMIENTO: 'en seguimiento',
  ATENDIDA: 'atendida',
  DESCARTADA: 'descartada',
};

const readMockStatusMap = (): Record<string, EstadoAlerta> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EstadoAlerta>;
  } catch {
    return {};
  }
};

const saveMockStatusMap = (map: Record<string, EstadoAlerta>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const relativeTimeEs = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.floor(diffMs / 60000));
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
};

const toUiState = (state?: string | null): EstadoAlerta => {
  const normalized = String(state ?? 'PENDIENTE').trim().toUpperCase() as PersistedAlertState;
  return DB_TO_UI_STATE[normalized] ?? 'pendiente';
};

const getAlertStateMeta = async (): Promise<Map<string, AlertStateRow>> => {
  const { data, error } = await supabaseClient
    .from('alertas_estado')
    .select('alerta_key,estado,comentario,usuario_id,origen,prioridad,ultima_actualizacion')
    .order('ultima_actualizacion', { ascending: false });

  if (error) throw error;

  const map = new Map<string, AlertStateRow>();
  (data ?? []).forEach((row) => {
    const alert = row as AlertStateRow;
    if (!map.has(alert.alerta_key)) {
      map.set(alert.alerta_key, alert);
    }
  });
  return map;
};

const persistMockState = async (id: string, estado: EstadoAlerta) => {
  const map = readMockStatusMap();
  map[id] = estado;
  saveMockStatusMap(map);
};

const persistSupabaseState = async (
  id: string,
  estado: EstadoAlerta,
  comentario?: string,
) => {
  const meta = latestAlertMeta.get(id);
  const payload = {
    alerta_key: id,
    estado: UI_TO_DB_STATE[estado],
    comentario: comentario?.trim() || null,
    usuario_id: null,
    origen: meta?.origen ?? null,
    prioridad: meta?.prioridad ?? null,
    ultima_actualizacion: new Date().toISOString(),
  };

  const { error } = await supabaseClient
    .from('alertas_estado')
    .upsert(payload, { onConflict: 'alerta_key' });

  if (error) throw error;
};

export const getAlertasOperativas = async (): Promise<AlertaOperativa[]> => {
  const [rows, treasury] = await Promise.all([
    dashboardOperativoService.getAlertasOperativas(),
    finanzasService.getTreasuryInsights().catch(() => ({ alertasTesoreria: [] })),
  ]);
  const mergedRows = [
    ...rows,
    ...treasury.alertasTesoreria,
  ];

  mergedRows.forEach((row) => {
    latestAlertMeta.set(row.alerta_id, {
      prioridad: row.prioridad,
      origen: row.area,
    });
  });

  if (runtimeConfig.mode === 'mock') {
    const overrides = readMockStatusMap();
    return mergedRows.map((row) => ({
      id: row.alerta_id,
      titulo: row.titulo,
      descripcion: row.tipo,
      prioridad: row.prioridad,
      area: row.area,
      estado: overrides[row.alerta_id] || 'pendiente',
      fechaRelativa: relativeTimeEs(row.fecha_evento),
      datoAsociado: row.dato_asociado as AlertaOperativa['datoAsociado'],
      accionRecomendada: 'Revisar origen operativo y ejecutar corrección en el módulo correspondiente.',
      impactoOperativo: 'Puede afectar continuidad productiva, costos o cumplimiento de trazabilidad.',
    }));
  }

  let persistedStates = new Map<string, AlertStateRow>();
  try {
    persistedStates = await getAlertStateMeta();
  } catch (error) {
    console.warn('[alertas] No se pudo leer alertas_estado; se usarán estados pendientes.', error);
  }

  return mergedRows.map((row) => {
    const persisted = persistedStates.get(row.alerta_id);
    const estado = toUiState(persisted?.estado);
    if (persisted?.prioridad && !latestAlertMeta.has(row.alerta_id)) {
      latestAlertMeta.set(row.alerta_id, {
        prioridad: persisted.prioridad,
        origen: persisted.origen ?? row.area,
      });
    }

    return {
      id: row.alerta_id,
      titulo: row.titulo,
      descripcion: row.tipo,
      prioridad: row.prioridad,
      area: row.area,
      estado,
      fechaRelativa: relativeTimeEs(row.fecha_evento),
      datoAsociado: row.dato_asociado as AlertaOperativa['datoAsociado'],
      accionRecomendada: 'Revisar origen operativo y ejecutar corrección en el módulo correspondiente.',
      impactoOperativo: 'Puede afectar continuidad productiva, costos o cumplimiento de trazabilidad.',
    };
  });
};

export const setEstadoAlerta = async (id: string, estado: EstadoAlerta, comentario?: string) => {
  if (runtimeConfig.mode === 'mock') {
    await persistMockState(id, estado);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alertas-updated'));
    }
    return;
  }

  await persistSupabaseState(id, estado, comentario);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alertas-updated'));
  }
};
