import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAlertasOperativasMock, fromMock } = vi.hoisted(() => ({
  getAlertasOperativasMock: vi.fn(),
  fromMock: vi.fn(),
}));

const runtimeState = vi.hoisted(() => ({
  mode: 'supabase' as 'supabase' | 'mock',
}));

let alertStateRows: Array<{ alerta_key: string; estado: string; prioridad?: string; origen?: string }> = [];
const upsertMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: {
    get mode() {
      return runtimeState.mode;
    },
  },
}));

vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: { from: fromMock },
}));

vi.mock('../../dashboard/services/dashboardOperativoService', () => ({
  dashboardOperativoService: { getAlertasOperativas: getAlertasOperativasMock },
}));

import { getAlertasOperativas, setEstadoAlerta } from './alertasService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    clear: () => storage.clear(),
  },
});
Object.defineProperty(globalThis, 'window', {
  value: { dispatchEvent: vi.fn() },
});

describe('alertasService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    runtimeState.mode = 'supabase';
    alertStateRows = [];
    fromMock.mockImplementation((table: string) => {
      if (table !== 'alertas_estado') throw new Error(`tabla inesperada: ${table}`);
      return {
        select: () => ({
          order: async () => ({ data: alertStateRows, error: null }),
        }),
        upsert: upsertMock,
      };
    });
  });

  it('fusiona alerta calculada con estado persistido', async () => {
    getAlertasOperativasMock.mockResolvedValue([
      {
        alerta_id: 'x1',
        tipo: 'Merma alta',
        prioridad: 'critica',
        area: 'produccion',
        titulo: 'Merma alta en OP-1',
        dato_asociado: { orden: 'OP-1' },
        fecha_evento: new Date().toISOString(),
      },
    ]);
    alertStateRows = [{ alerta_key: 'x1', estado: 'ATENDIDA', prioridad: 'critica', origen: 'produccion' }];

    const out = await getAlertasOperativas();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('x1');
    expect(out[0].estado).toBe('atendida');
  });

  it('usa pendiente si no existe estado persistido', async () => {
    getAlertasOperativasMock.mockResolvedValue([
      {
        alerta_id: 'x2',
        tipo: 'Stock bajo',
        prioridad: 'media',
        area: 'stock',
        titulo: 'x',
        dato_asociado: {},
        fecha_evento: new Date().toISOString(),
      },
    ]);

    const out = await getAlertasOperativas();
    expect(out[0].estado).toBe('pendiente');
  });

  it('actualiza el estado en Supabase sin duplicar por alerta_key', async () => {
    getAlertasOperativasMock.mockResolvedValue([
      {
        alerta_id: 'x3',
        tipo: 'Stock bajo',
        prioridad: 'media',
        area: 'stock',
        titulo: 'x',
        dato_asociado: {},
        fecha_evento: new Date().toISOString(),
      },
    ]);

    await getAlertasOperativas();
    await setEstadoAlerta('x3', 'en seguimiento');

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alerta_key: 'x3',
        estado: 'EN_SEGUIMIENTO',
      }),
      expect.objectContaining({ onConflict: 'alerta_key' }),
    );
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it('permite descartar una alerta en Supabase', async () => {
    getAlertasOperativasMock.mockResolvedValue([
      {
        alerta_id: 'x4',
        tipo: 'Merma alta',
        prioridad: 'critica',
        area: 'produccion',
        titulo: 'x',
        dato_asociado: {},
        fecha_evento: new Date().toISOString(),
      },
    ]);

    await getAlertasOperativas();
    await setEstadoAlerta('x4', 'descartada');

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alerta_key: 'x4',
        estado: 'DESCARTADA',
      }),
      expect.objectContaining({ onConflict: 'alerta_key' }),
    );
  });

  it('mantiene compatibilidad en modo mock', async () => {
    runtimeState.mode = 'mock';
    getAlertasOperativasMock.mockResolvedValue([
      {
        alerta_id: 'm1',
        tipo: 'Seguimiento',
        prioridad: 'informativa',
        area: 'produccion',
        titulo: 'm1',
        dato_asociado: {},
        fecha_evento: new Date().toISOString(),
      },
    ]);

    await setEstadoAlerta('m1', 'atendida');
    const out = await getAlertasOperativas();
    expect(out[0].estado).toBe('atendida');
  });
});
