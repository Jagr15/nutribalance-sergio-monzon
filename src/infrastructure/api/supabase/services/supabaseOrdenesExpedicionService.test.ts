import { describe, expect, it, vi } from 'vitest';

const {
  mockFrom,
  mockRpc,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../client', () => ({
  supabaseClient: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { supabaseOrdenesExpedicionService } from './supabaseOrdenesExpedicionService';

describe('supabaseOrdenesExpedicionService', () => {
  it('mapea expediciones desde la tabla', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ordenes_expedicion') {
        return {
          select: () => ({
            order: async () => ({
              data: [{
                id: 'id-1',
                legacy_uid: 'exp-1',
                numero_expedicion: 'EXP-2026-000001',
                stock_pt_id: 'pt-1',
                producto_id: 'prod-1',
                nombre_producto: 'Producto 1',
                lote_pt: 'L-1',
                cliente_id: 'cli-db-1',
                clientes: { legacy_uid: 'cli-001', nombre: 'Cliente Demo' },
                presentacion: 'GRANEL',
                cantidad: 25,
                estado: 'REGISTRADA',
                motivo: 'Venta',
                referencia: 'R-1',
                created_at: '2026-06-18T10:00:00Z',
                updated_at: '2026-06-18T10:00:00Z',
              }],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`tabla inesperada: ${table}`);
    });

    const rows = await supabaseOrdenesExpedicionService.getAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      legacy_uid: 'exp-1',
      cliente_nombre: 'Cliente Demo',
      presentacion: 'GRANEL',
    });
  });

  it('registra una expedición por RPC', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stock_pt') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: { id: 'pt-db-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'clientes') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: { id: 'cli-db-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    });

    mockRpc.mockResolvedValue({
      data: [{
        id: 'id-1',
        legacy_uid: 'exp-1',
        numero_expedicion: 'EXP-2026-000001',
        stock_pt_id: 'pt-db-1',
        producto_id: 'prod-1',
        nombre_producto: 'Producto 1',
        lote_pt: 'L-1',
        cliente_id: 'cli-db-1',
        clientes: { legacy_uid: 'cli-001', nombre: 'Cliente Demo' },
        presentacion: 'GRANEL',
        cantidad: 25,
        estado: 'REGISTRADA',
        motivo: 'Venta',
        referencia: 'R-1',
        created_at: '2026-06-18T10:00:00Z',
        updated_at: '2026-06-18T10:00:00Z',
      }],
      error: null,
    });

    const row = await supabaseOrdenesExpedicionService.create({
      stock_pt_id: 'pt-001',
      cliente_id: 'cli-001',
      presentacion: 'GRANEL',
      cantidad: 25,
      motivo: 'Venta',
      referencia: 'R-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('registrar_orden_expedicion', {
      p_stock_pt_id: 'pt-db-1',
      p_cliente_id: 'cli-db-1',
      p_presentacion: 'GRANEL',
      p_cantidad: 25,
      p_motivo: 'Venta',
      p_referencia: 'R-1',
    });
    expect(row.legacy_uid).toBe('exp-1');
  });

  it('propaga el mensaje real del RPC al fallar', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stock_pt') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: { id: 'pt-db-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'clientes') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: { id: 'cli-db-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: 'No hay saldo suficiente en el lote de PT.',
        details: 'constraint stock_pt_cantidad_total_chk',
        hint: 'Revisar stock disponible.',
      },
    });

    await expect(supabaseOrdenesExpedicionService.create({
      stock_pt_id: 'pt-001',
      cliente_id: 'cli-001',
      presentacion: 'GRANEL',
      cantidad: 25,
      motivo: 'Venta',
      referencia: 'R-1',
    })).rejects.toThrow('No hay saldo suficiente en el lote de PT.');
  });
});
