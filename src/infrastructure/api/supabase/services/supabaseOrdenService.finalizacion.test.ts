import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../client', () => ({
  supabaseClient: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { supabaseOrdenService } from './supabaseOrdenService';
import type { OrdenProduccion } from '../../../../features/ordenes/types/orden';

const ordenBaseRow = {
  id: '11111111-1111-1111-1111-111111111111',
  legacy_uid: 'OP-2026-999',
  lote: 'OP-2026-999',
  id_formula_legacy: 'F-001',
  nombre_producto: 'Alimento Test',
  version_formula: 1,
  cantidad_objetivo: 1000,
  cantidad_real: null,
  merma_manual: null,
  id_silo_legacy: null,
  destino_silo: null,
  estado: 'EN PROCESO',
  fecha_creacion: '2026-05-26T00:00:00Z',
  usuario_responsable: 'Sergio',
  costo_total_insumos: 1234,
};

const detalleRows = [
  {
    orden_id: ordenBaseRow.id,
    id_lote_legacy: 'stk-1',
    id_insumo_legacy: 'i-1',
    nombre_insumo: 'Maiz',
    cantidad_usada: 100,
    tipo_unidad: 'KG',
    costo_unitario: 1,
    costo_total: 100,
  },
];

type OrdenesBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

const buildOrdenesBuilder = (row: unknown): OrdenesBuilder => {
  const builder = {} as OrdenesBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: row, error: null }));
  return builder;
};

type ConsumoBuilder = {
  select: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

const buildConsumoBuilder = (rows: unknown[]): ConsumoBuilder => {
  const builder = {} as ConsumoBuilder;
  builder.select = vi.fn(() => builder);
  builder.in = vi.fn(async () => ({ data: rows, error: null }));
  return builder;
};

const finalizePayload: Partial<OrdenProduccion> & { lote_salida: string } = {
  estado: 'FINALIZADO',
  cantidad_real: 980,
  merma_manual: 20,
  destino_silo: 'Silo Norte',
  lote_salida: 'PT-LOTE-001',
};

describe('supabaseOrdenService - finalizacion RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ordenes_produccion') return buildOrdenesBuilder(ordenBaseRow);
      if (table === 'orden_consumo_lotes') return buildConsumoBuilder(detalleRows);
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          ...ordenBaseRow,
          estado: 'FINALIZADO',
          cantidad_real: 980,
          merma_manual: 20,
          destino_silo: 'Silo Norte',
          id_silo_legacy: 'S-01',
        },
      ],
      error: null,
    });
  });

  it('finalizacion exitosa', async () => {
    const result = await supabaseOrdenService.update('OP-2026-999', finalizePayload);

    expect(mockRpc).toHaveBeenCalledWith('finalizar_orden_produccion', {
      p_orden_id: ordenBaseRow.id,
      p_cantidad_real: 980,
      p_merma_manual: 20,
      p_destino_silo: 'Silo Norte',
      p_lote_salida: 'PT-LOTE-001',
    });
    expect(result.estado).toBe('FINALIZADO');
    expect(result.cantidad_real).toBe(980);
  });

  it('rollback por stock insuficiente', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Stock insuficiente para Maiz en lote stk-1.' } });

    await expect(
      supabaseOrdenService.update('OP-2026-999', finalizePayload)
    ).rejects.toMatchObject({ message: 'Stock insuficiente para Maiz en lote stk-1.' });
  });

  it('rollback por silo invalido', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Silo de destino inválido.' } });

    await expect(
      supabaseOrdenService.update('OP-2026-999', { ...finalizePayload, destino_silo: 'Silo Fantasma' })
    ).rejects.toMatchObject({ message: 'Silo de destino inválido.' });
  });

  it('rollback por orden finalizada', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'La orden ya se encuentra finalizada.' } });

    await expect(
      supabaseOrdenService.update('OP-2026-999', finalizePayload)
    ).rejects.toMatchObject({ message: 'La orden ya se encuentra finalizada.' });
  });

  it('rollback por falta de consumo planificado', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ordenes_produccion') return buildOrdenesBuilder(ordenBaseRow);
      if (table === 'orden_consumo_lotes') return buildConsumoBuilder([]);
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    await expect(
      supabaseOrdenService.update('OP-2026-999', finalizePayload)
    ).rejects.toThrowError('La orden no tiene consumo planificado.');

    expect(mockRpc).not.toHaveBeenCalled();
  });
});
