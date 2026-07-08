import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../client', () => ({
  supabaseClient: { from: mockFrom },
}));

import { supabaseStockMPService } from './supabaseStockMPService';
import { resetStockLotesMpSiloIdCache } from './stockLotesMpSiloSupport';

const missingSiloIdError = {
  message: 'column stock_lotes_mp.silo_id does not exist',
};

describe('supabaseStockMPService', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    resetStockLotesMpSiloIdCache();
  });

  it('lee lotes de MP aun si la base vieja no tiene stock_lotes_mp.silo_id', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'stock_lotes_mp') throw new Error(`tabla inesperada: ${table}`);

      return {
        select: (columns: string) => {
          if (columns === 'silo_id') {
            return {
              limit: async () => ({ data: null, error: missingSiloIdError }),
            };
          }

          return {
            is: () => ({
              order: async () => ({
                data: [
                  {
                    legacy_uid: 'stk-mp-1',
                    insumo_id: 'db-ins-1',
                    lote: 'L-001',
                    remito_nro: 'REM-1',
                    ubicacion: 'Silo Norte',
                    cantidad_actual: 1200,
                    cantidad_inicial: 1200,
                    cantidad_comprometida: 200,
                    costo_unitario: 2.5,
                    costo_total: 3000,
                    fecha_ingreso: '2026-07-08T10:00:00Z',
                    created_at: '2026-07-08T10:00:00Z',
                    updated_at: '2026-07-08T10:00:00Z',
                    insumos: { legacy_uid: 'ins-1', nombre: 'Maiz' },
                    proveedores: { legacy_uid: 'prov-1' },
                    usuarios: { legacy_uid: 'usr-1' },
                  },
                ],
                error: null,
              }),
            }),
          };
        },
      };
    });

    const rows = await supabaseStockMPService.getAllLotes();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      uid: 'stk-mp-1',
      ubicacion: 'Silo Norte',
      silo_id: undefined,
      cantidad_actual: 1200,
      cantidad_comprometida: 200,
    });
  });
});
