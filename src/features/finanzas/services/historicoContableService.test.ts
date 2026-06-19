import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureMock } = vi.hoisted(() => ({
  ensureMock: vi.fn(),
}));

vi.mock('./contabilidadOperativaService', () => ({
  contabilidadOperativaService: { ensureMovimiento: ensureMock },
}));
vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: { mode: 'mock' },
}));
import { historicoContableService, parseHistoricoCsv } from './historicoContableService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
});

describe('historicoContableService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('valida filas sin campos requeridos', () => {
    const result = historicoContableService.validate([
      { fecha: '', tipo: 'INGRESO', descripcion: '', monto: 0, origen_operativo: '' } as never,
    ]);
    expect(result.estado).toBe('errores');
    expect(result.errores.length).toBeGreaterThan(0);
  });

  it('detecta duplicados por firma derivada', () => {
    const result = historicoContableService.validate([
      { fecha: '2026-01-01', tipo: 'INGRESO', descripcion: 'Venta', monto: 100, origen_operativo: 'VENTA_PT' },
      { fecha: '2026-01-01', tipo: 'INGRESO', descripcion: 'Venta', monto: 100, origen_operativo: 'VENTA_PT' },
    ]);
    expect(result.duplicados).toBe(1);
    expect(result.estado).toBe('errores');
  });

  it('parsea un CSV simple', () => {
    const rows = parseHistoricoCsv('fecha,tipo,descripcion,monto,origen_operativo,legacy_uid\n2026-01-01,INGRESO,Venta,100,VENTA_PT,h1');
    expect(rows).toHaveLength(1);
    expect(rows[0].legacy_uid).toBe('h1');
  });
});
