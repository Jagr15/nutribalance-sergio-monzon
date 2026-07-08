import { describe, expect, it, vi, beforeEach } from 'vitest';
import { comprobanteService, type Comprobante } from './comprobanteService';
import { filterComprobantes, paginateComprobantes } from '../utils/comprobantesPagination';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';

vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: {
    from: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: { mode: 'mock' },
}));

describe('comprobanteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea FACTURA_VENTA pendiente en modo mock', async () => {
    const payload: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'> = {
      tipo: 'FACTURA_VENTA',
      numero: 'FC-A-0001',
      fecha_emision: '2026-07-08',
      fecha_vencimiento: '2026-08-08',
      tercero: 'Cliente Test',
      estado: 'PENDIENTE',
      total: 1000,
      saldo: 1000,
      cliente_id: 'cli-123',
    };

    const res = await comprobanteService.create(payload);
    expect(res.id).toBeDefined();
    expect(res.tipo).toBe('FACTURA_VENTA');
    expect(res.total).toBe(1000);
    expect(res.saldo).toBe(1000);
    expect(res.estado).toBe('PENDIENTE');
  });

  it('crea FACTURA_COMPRA pendiente sin proveedor_id', async () => {
    const payload: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'> = {
      tipo: 'FACTURA_COMPRA',
      numero: 'FC-C-0002',
      fecha_emision: '2026-07-08',
      fecha_vencimiento: '2026-08-08',
      tercero: 'Proveedor Test',
      estado: 'PENDIENTE',
      total: 5000,
      saldo: 5000,
    };

    const res = await comprobanteService.create(payload);
    expect(res.tipo).toBe('FACTURA_COMPRA');
    expect(res.proveedor_id).toBeUndefined(); // Debe ser indefinido para no ser enviado a la base de datos
    expect(res.tercero).toBe('Proveedor Test');
  });

  it('crea RECIBO y Pago correctamente', async () => {
    const payload: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'> = {
      tipo: 'RECIBO',
      numero: 'REC-0001',
      fecha_emision: '2026-07-08',
      fecha_vencimiento: null,
      tercero: 'Cliente Pago',
      estado: 'PAGADO',
      total: 1500,
      saldo: 0,
    };

    const res = await comprobanteService.create(payload);
    expect(res.tipo).toBe('RECIBO');
    expect(res.estado).toBe('PAGADO');
    expect(res.saldo).toBe(0);
  });

  it('propaga errores detallados de Supabase', async () => {
    // Cambiamos runtimeConfig a supabase temporalmente
    const { runtimeConfig } = await import('../../../infrastructure/api/runtimeConfig');
    const originalMode = runtimeConfig.mode;
    runtimeConfig.mode = 'supabase';

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Fallo catastrófico',
        details: 'El valor supera el límite permitido',
        hint: 'Verifica los tipos de datos numéricos',
      },
    });

    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(supabaseClient.from).mockReturnValue({
      insert: mockInsert,
    } as any);

    const payload: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'> = {
      tipo: 'FACTURA_VENTA',
      numero: 'FC-A-9999',
      fecha_emision: '2026-07-08',
      tercero: 'Cliente Catastrofe',
      estado: 'PENDIENTE',
      total: 9999,
      saldo: 9999,
    };

    await expect(comprobanteService.create(payload)).rejects.toEqual(
      expect.objectContaining({
        message: 'Fallo catastrófico',
        details: 'El valor supera el límite permitido',
        hint: 'Verifica los tipos de datos numéricos',
      })
    );

    runtimeConfig.mode = originalMode;
  });

  it('resuelve cliente_id correctamente con UUID real o null si es legacy', async () => {
    const { runtimeConfig } = await import('../../../infrastructure/api/runtimeConfig');
    const originalMode = runtimeConfig.mode;
    runtimeConfig.mode = 'supabase';

    const mockInsertSpy = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'comp-123',
            tipo: 'FACTURA_VENTA',
            numero: 'FC-A-0001',
            fecha_emision: '2026-07-08',
            tercero: 'Cliente Test',
            estado: 'PENDIENTE',
            total: 1000,
            saldo: 1000,
            cliente_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            legacy_uid: 'comp-manual-123',
          },
          error: null,
        }),
      }),
    });

    // 1. Cliente con UUID real:
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'comprobantes') {
        return { insert: mockInsertSpy };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    });

    vi.mocked(supabaseClient.from).mockImplementation(mockFrom as any);

    const payloadUuid: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'> = {
      tipo: 'FACTURA_VENTA',
      numero: 'FC-A-0001',
      fecha_emision: '2026-07-08',
      tercero: 'Cliente Test',
      estado: 'PENDIENTE',
      total: 1000,
      saldo: 1000,
      cliente_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // UUID real
    };

    await comprobanteService.create(payloadUuid);

    // Debe mandarse el UUID real directamente
    expect(mockInsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cliente_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      })
    );

    // 2. Cliente con legacy ID no resoluble (debe convertirse en null):
    const payloadLegacy: Omit<Comprobante, 'id' | 'created_at' | 'updated_at'> = {
      tipo: 'FACTURA_VENTA',
      numero: 'FC-A-0001',
      fecha_emision: '2026-07-08',
      tercero: 'Cliente Test',
      estado: 'PENDIENTE',
      total: 1000,
      saldo: 1000,
      cliente_id: 'cli-541961', // legacy_uid
    };

    await comprobanteService.create(payloadLegacy);

    // Debe mandarse null porque no existe o no se puede resolver a un UUID
    expect(mockInsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cliente_id: null,
      })
    );

    // 3. Cliente con legacy ID resoluble (debe convertirse a su UUID real):
    const mockFromResolvable = vi.fn().mockImplementation((table: string) => {
      if (table === 'comprobantes') {
        return { insert: mockInsertSpy };
      }
      if (table === 'clientes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'b1eedc99-9c0b-4ef8-bb6d-6bb9bd380a22' },
                error: null,
              }),
            }),
          }),
        };
      }
    });
    vi.mocked(supabaseClient.from).mockImplementation(mockFromResolvable as any);

    await comprobanteService.create(payloadLegacy);

    // Debe mandarse el UUID resuelto
    expect(mockInsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cliente_id: 'b1eedc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      })
    );

    runtimeConfig.mode = originalMode;
  });
});

describe('comprobantesPagination', () => {
  const dummyList: Comprobante[] = Array.from({ length: 15 }, (_, i) => ({
    id: `comp-${i + 1}`,
    tipo: i % 2 === 0 ? 'FACTURA_VENTA' : 'FACTURA_COMPRA',
    numero: `FC-00${i + 1}`,
    fecha_emision: '2026-07-08',
    tercero: i % 3 === 0 ? 'Alfa' : i % 3 === 1 ? 'Beta' : 'Gamma',
    estado: i % 5 === 0 ? 'PENDIENTE' : 'PAGADO',
    total: 100 * (i + 1),
    saldo: i % 5 === 0 ? 100 * (i + 1) : 0,
  }));

  it('filtra correctamente por término de búsqueda', () => {
    const res = filterComprobantes(dummyList, 'alfa', '', '');
    expect(res.every(c => c.tercero === 'Alfa')).toBe(true);
    expect(res.length).toBe(5); // 0, 3, 6, 9, 12
  });

  it('filtra por tipo y estado', () => {
    const res = filterComprobantes(dummyList, '', 'FACTURA_VENTA', 'PENDIENTE');
    expect(res.every(c => c.tipo === 'FACTURA_VENTA' && c.estado === 'PENDIENTE')).toBe(true);
  });

  it('pagina los elementos de 10 en 10', () => {
    const p1 = paginateComprobantes(dummyList, 1, 10);
    expect(p1.length).toBe(10);
    expect(p1[0].id).toBe('comp-1');
    expect(p1[9].id).toBe('comp-10');

    const p2 = paginateComprobantes(dummyList, 2, 10);
    expect(p2.length).toBe(5);
    expect(p2[0].id).toBe('comp-11');
    expect(p2[4].id).toBe('comp-15');
  });

  it('respeta la página límite superior', () => {
    const pOverflow = paginateComprobantes(dummyList, 99, 10);
    expect(pOverflow.length).toBe(5);
  });
});
