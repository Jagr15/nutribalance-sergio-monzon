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
      condicion_pago: 'CTA_CTE',
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        legacy_uid: 'fcm-compra-stk-mp-1',
        tipo: 'EGRESO',
        origen_operativo: 'COMPRA_MP',
        descripcion: 'Compra MP L-001 - Maiz',
        monto: 1500,
        categoria_id: 'cat-1',
        estado: 'PENDIENTE',
        estado_financiero: 'PENDIENTE_PAGO',
        metadata: expect.objectContaining({
          condicion_pago: 'CTA_CTE',
          remito: 'R-100',
          stock_lote_legacy_uid: 'stk-mp-1',
        }),
      }),
      expect.any(Object),
    );
  });

  it('rechaza compras incompletas sin proveedor ni documento o condición de pago', async () => {
    await expect(
      contabilidadOperativaService.registrarCompraMateriaPrima({
        stock_lote_legacy_uid: 'stk-mp-2',
        fecha: '2026-06-18',
        lote: 'L-002',
        insumo: 'Soja',
        proveedor: '   ',
        monto: 1500,
      }),
    ).rejects.toThrow(/proveedor es obligatorio/i);

    await expect(
      contabilidadOperativaService.registrarCompraMateriaPrima({
        stock_lote_legacy_uid: 'stk-mp-3',
        fecha: '2026-06-18',
        lote: 'L-003',
        insumo: 'Soja',
        proveedor: 'Proveedor SA',
        monto: 1500,
      }),
    ).rejects.toThrow(/remito\/documento o condición de pago/i);
  });

  it('sincroniza movimiento de costos de forma idempotente con origen', async () => {
    await contabilidadOperativaService.sincronizarMovimientoCostos({
      origen_id: 'costo-001',
      fecha: '2026-06-18T00:00:00Z',
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: 'Cobranza cliente',
      monto: 2500,
      metadata: { comprobante: 'c-1' },
    });

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      legacy_uid: 'fcm-costos-costo-001',
      origen_modulo: 'costos',
      origen_id: 'costo-001',
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      monto: 2500,
      metadata: expect.objectContaining({ origen_modulo: 'costos', origen_id: 'costo-001' }),
    }), expect.any(Object));
  });
});
