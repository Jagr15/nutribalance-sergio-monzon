import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: { mode: 'supabase' },
}));
vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: { from: mockFrom },
}));

import { historicoContableService, parseHistoricoCsv } from './historicoContableService';

describe('historicoContableService supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) })),
      upsert: vi.fn(async () => ({ error: null })),
    });
  });

  it('importa el mismo CSV dos veces sin cambiar el legacy_uid derivado', async () => {
    const rows = parseHistoricoCsv('fecha,tipo,descripcion,monto,origen_operativo\n2026-01-01,INGRESO,Venta,100,VENTA_PT');
    const upsert = vi.fn(async () => ({ error: null }));
    mockFrom.mockReturnValue({ upsert });

    await historicoContableService.importRows(rows);
    await historicoContableService.importRows(rows);

    expect(upsert).toHaveBeenCalledTimes(2);
    const firstCall = upsert.mock.calls[0] as unknown as [Array<Record<string, unknown>>];
    const secondCall = upsert.mock.calls[1] as unknown as [Array<Record<string, unknown>>];
    expect(firstCall[0][0]).toMatchObject({
      legacy_uid: expect.stringMatching(/^hist-/),
      content_hash: expect.any(String),
      source_batch_uid: expect.any(String),
    });
    expect(secondCall[0][0].legacy_uid).toBe(firstCall[0][0].legacy_uid);
    expect(secondCall[0][0].content_hash).toBe(firstCall[0][0].content_hash);
  });
});
