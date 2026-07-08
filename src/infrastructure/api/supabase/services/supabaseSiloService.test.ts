import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../client', () => ({
  supabaseClient: { from: mockFrom },
}));

import { supabaseSiloService } from './supabaseSiloService';
import { resetStockLotesMpSiloIdCache } from './stockLotesMpSiloSupport';

const missingSiloIdError = {
  message: 'column stock_lotes_mp.silo_id does not exist',
};

describe('supabaseSiloService', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    resetStockLotesMpSiloIdCache();
  });

  it('calcula stock MP por nombre de silo cuando el lote es legacy y no existe silo_id', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stock_lotes_mp') {
        return {
          select: (columns: string) => {
            if (columns === 'silo_id') {
              return {
                limit: async () => ({ data: null, error: missingSiloIdError }),
              };
            }

            return {
              is: async () => ({
                data: [
                  {
                    ubicacion: 'Silo Norte',
                    cantidad_actual: 1500,
                    cantidad_comprometida: 300,
                  },
                ],
                error: null,
              }),
            };
          },
        };
      }

      if (table === 'stock_pt') {
        return {
          select: () => ({
            is: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === 'silos') {
        return {
          select: () => ({
            is: async () => ({
              data: [
                {
                  id: 'db-silo-1',
                  legacy_uid: 'silo-1',
                  nombre: 'Silo Norte',
                  descripcion: 'MP',
                  tipo_uso: 'MATERIA_PRIMA',
                  esta_activo: true,
                  deleted_at: null,
                },
              ],
              error: null,
            }),
            order: async () => ({
              data: [
                {
                  id: 'db-silo-1',
                  legacy_uid: 'silo-1',
                  nombre: 'Silo Norte',
                  descripcion: 'MP',
                  tipo_uso: 'MATERIA_PRIMA',
                  esta_activo: true,
                  deleted_at: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`tabla inesperada: ${table}`);
    });

    const rows = await supabaseSiloService.getAll();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      uid: 'silo-1',
      nombre: 'Silo Norte',
      stock_actual_ton: 1.2,
    });
  });

  it('prioriza silo_id para stock MP cuando el lote ya esta relacionado por id', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stock_lotes_mp') {
        return {
          select: (columns: string) => {
            if (columns === 'silo_id') {
              return {
                limit: async () => ({ data: [], error: null }),
              };
            }

            return {
              is: async () => ({
                data: [
                  {
                    silo_id: 'db-silo-1',
                    ubicacion: 'Nombre Legacy Distinto',
                    cantidad_actual: 900,
                    cantidad_comprometida: 100,
                  },
                ],
                error: null,
              }),
            };
          },
        };
      }

      if (table === 'stock_pt') {
        return {
          select: () => ({
            is: async () => ({ data: [], error: null }),
          }),
        };
      }

      if (table === 'silos') {
        return {
          select: () => ({
            is: async () => ({
              data: [
                {
                  id: 'db-silo-1',
                  legacy_uid: 'silo-1',
                  nombre: 'Silo Norte',
                  descripcion: 'MP',
                  tipo_uso: 'MATERIA_PRIMA',
                  esta_activo: true,
                  deleted_at: null,
                },
              ],
              error: null,
            }),
            order: async () => ({
              data: [
                {
                  id: 'db-silo-1',
                  legacy_uid: 'silo-1',
                  nombre: 'Silo Norte',
                  descripcion: 'MP',
                  tipo_uso: 'MATERIA_PRIMA',
                  esta_activo: true,
                  deleted_at: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`tabla inesperada: ${table}`);
    });

    const rows = await supabaseSiloService.getAll();

    expect(rows).toHaveLength(1);
    expect(rows[0].stock_actual_ton).toBe(0.8);
  });
});
