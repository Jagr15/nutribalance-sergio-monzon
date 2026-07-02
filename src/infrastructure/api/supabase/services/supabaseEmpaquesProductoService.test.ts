import { describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../client', () => ({
  supabaseClient: { from: mockFrom },
}));

import { supabaseEmpaquesProductoService } from './supabaseEmpaquesProductoService';

describe('supabaseEmpaquesProductoService', () => {
  it('crea un empaque valido', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'producto_empaques') throw new Error('tabla inesperada');
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            maybeSingle: async () => ({
              data: { id: '1', producto_id: 'p-1', tipo_empaque: 'BOLSA', capacidad_kg: 25, activo: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
              error: null,
            }),
          }),
        }),
        update: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    });

    const row = await supabaseEmpaquesProductoService.create({ producto_id: 'p-1', tipo_empaque: 'BOLSA', capacidad_kg: 25 });
    expect(row.capacidad_kg).toBe(25);
  });

  it('rechaza capacidad invalida', async () => {
    await expect(supabaseEmpaquesProductoService.create({ producto_id: 'p-1', tipo_empaque: 'BOLSA', capacidad_kg: 500 as never })).rejects.toThrow();
  });
});
