import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAlertasOperativasMock } = vi.hoisted(() => ({ getAlertasOperativasMock: vi.fn() }));
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

describe('alertasService real', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('transforma alertas de vista a alertas UI', async () => {
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

    const out = await getAlertasOperativas();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('x1');
    expect(out[0].estado).toBe('pendiente');
  });

  it('respeta estado persistido', async () => {
    getAlertasOperativasMock.mockResolvedValue([
      {
        alerta_id: 'x1',
        tipo: 'Stock bajo',
        prioridad: 'media',
        area: 'stock',
        titulo: 'x',
        dato_asociado: {},
        fecha_evento: new Date().toISOString(),
      },
    ]);

    setEstadoAlerta('x1', 'atendida');
    const out = await getAlertasOperativas();
    expect(out[0].estado).toBe('atendida');
  });
});
