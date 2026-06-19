import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, upsertMock } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: { mode: 'supabase' },
}));

vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: {
    from: mockFrom,
  },
}));

import { contabilidadOperativaService } from './contabilidadOperativaService';

describe('contabilidadOperativaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { id: 'cat-1' }, error: null })),
          })),
        })),
      })),
      upsert: upsertMock.mockResolvedValue({ error: null }),
    }));
  });

  it('valida que el monto sea mayor a 0', async () => {
    await expect(
      contabilidadOperativaService.ensureMovimiento({
        legacy_uid: 'fcm-1',
        fecha: '2026-06-18',
        tipo: 'INGRESO',
        origen_operativo: 'VENTA_PT',
        descripcion: 'Venta',
        monto: 0,
      }),
    ).rejects.toThrow(/debe ser mayor a 0/);
  });

  it('registra compra de materia prima con categoria y metadata', async () => {
    await contabilidadOperativaService.registrarCompraMateriaPrima({
      stock_lote_legacy_uid: 'stk-mp-1',
      fecha: '2026-06-18',
      lote: 'L-001',
      insumo: 'Maiz',
      proveedor: 'Proveedor SA',
      monto: 1500,
      remito: 'R-100',
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        legacy_uid: 'fcm-compra-stk-mp-1',
        tipo: 'EGRESO',
        origen_operativo: 'COMPRA_MP',
        descripcion: 'Compra MP L-001 - Maiz',
        monto: 1500,
        categoria_id: 'cat-1',
        metadata: expect.objectContaining({
          remito: 'R-100',
          stock_lote_legacy_uid: 'stk-mp-1',
        }),
      }),
      expect.any(Object),
    );
  });
});
