import { describe, expect, it, vi } from 'vitest';

const mockApiService = vi.hoisted(() => ({
  stockMP: {
    getAllLotes: vi.fn().mockResolvedValue([
      { cantidad_actual: 10, costo_unitario: 2 },
      { cantidad_actual: 5, costo_unitario: 4 },
    ]),
  },
  stockPT: {
    getResumen: vi.fn().mockResolvedValue([
      { valor_monetario: 30 },
      { valor_monetario: 70 },
    ]),
  },
  ordenes: { getAll: vi.fn() },
  formulas: { findAll: vi.fn() },
}));

vi.mock('../../../infrastructure/api', () => ({ ApiService: mockApiService }));
vi.mock('../../../infrastructure/api/supabase/client', () => ({ supabaseClient: { from: vi.fn() } }));

import { finanzasService } from './finanzasService';

describe('finanzasService inventory', () => {
  it('separa valor de stock MP y PT', async () => {
    const resumen = await finanzasService.getInventarioResumen();

    expect(resumen.valor_stock_mp).toBe(40);
    expect(resumen.valor_stock_pt).toBe(100);
    expect(resumen.valor_inventario_total).toBe(140);
  });
});
