import { dashboardOperativoService } from '../../dashboard/services/dashboardOperativoService';
import type { AlertaOperativa, EstadoAlerta } from '../types/alerta';

const STORAGE_KEY = 'nutribalance_alertas_estado';

const readStatusMap = (): Record<string, EstadoAlerta> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, EstadoAlerta>;
  } catch {
    return {};
  }
};

const saveStatusMap = (map: Record<string, EstadoAlerta>) => {
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

export const getAlertasOperativas = async (): Promise<AlertaOperativa[]> => {
  const overrides = readStatusMap();
  const rows = await dashboardOperativoService.getAlertasOperativas();

  return rows.map((row) => ({
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
};

export const setEstadoAlerta = (id: string, estado: EstadoAlerta) => {
  const map = readStatusMap();
  map[id] = estado;
  saveStatusMap(map);
  window.dispatchEvent(new CustomEvent('alertas-updated'));
};
