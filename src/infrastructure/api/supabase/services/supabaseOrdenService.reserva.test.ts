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

type Scenario = {
  ordenRow: Record<string, unknown>;
  detalleRows: Array<Record<string, unknown>>;
  formulaLookupRow: Record<string, unknown>;
  formulaIngredRows: Array<Record<string, unknown>>;
  stockRows: Array<Record<string, unknown>>;
  insumoLookupRows: Array<Record<string, unknown>>;
  usuarioLookupRow: Record<string, unknown>;
  updatedRow: Record<string, unknown>;
};

const baseOrden = {
  id: '11111111-1111-1111-1111-111111111111',
  legacy_uid: 'OP-2026-999',
  lote: 'OP-2026-999',
  formula_id: 'formula-db-1',
  id_formula_legacy: 'F-001',
  nombre_producto: 'Alimento Test',
  version_formula: 1,
  cantidad_objetivo: 1000,
  cantidad_real: null,
  merma_manual: null,
  silo_id: null,
  id_silo_legacy: null,
  destino_silo: null,
  estado: 'PENDIENTE',
  fecha_creacion: '2026-05-26T00:00:00Z',
  usuario_responsable: 'Sergio',
  usuario_id: 'usr-1',
  costo_total_insumos: 1000,
};

const currentDetalle = [
  {
    orden_id: baseOrden.id,
    id_lote_legacy: 'stk-1',
    id_insumo_legacy: 'i-1',
    nombre_insumo: 'Maiz',
    cantidad_usada: 600,
    tipo_unidad: 'KG',
    costo_unitario: 1,
    costo_total: 600,
  },
  {
    orden_id: baseOrden.id,
    id_lote_legacy: 'stk-2',
    id_insumo_legacy: 'i-2',
    nombre_insumo: 'Soja',
    cantidad_usada: 400,
    tipo_unidad: 'KG',
    costo_unitario: 1,
    costo_total: 400,
  },
];

const createScenario = (): Scenario => ({
  ordenRow: { ...baseOrden },
  detalleRows: [...currentDetalle],
  formulaLookupRow: { id: 'formula-db-1', legacy_uid: 'F-001' },
  formulaIngredRows: [
    { porcentaje: 60, nombre_insumo: 'Maiz', insumos: { legacy_uid: 'i-1' } },
    { porcentaje: 40, nombre_insumo: 'Soja', insumos: { legacy_uid: 'i-2' } },
  ],
  stockRows: [
    {
      id: 'lot-db-1',
      legacy_uid: 'stk-1',
      lote: 'L1',
      fecha_ingreso: '2026-01-01T00:00:00Z',
      cantidad_actual: 1000,
      cantidad_comprometida: 600,
      costo_unitario: 1,
      insumos: [{ legacy_uid: 'i-1', nombre: 'Maiz' }],
    },
    {
      id: 'lot-db-2',
      legacy_uid: 'stk-2',
      lote: 'L2',
      fecha_ingreso: '2026-02-01T00:00:00Z',
      cantidad_actual: 1000,
      cantidad_comprometida: 400,
      costo_unitario: 1,
      insumos: [{ legacy_uid: 'i-2', nombre: 'Soja' }],
    },
  ],
  insumoLookupRows: [
    { id: 'insumo-db-1', legacy_uid: 'i-1' },
    { id: 'insumo-db-2', legacy_uid: 'i-2' },
  ],
  usuarioLookupRow: { id: 'usr-1', legacy_uid: 'usr-admin-01' },
  updatedRow: {
    ...baseOrden,
    cantidad_objetivo: 1200,
    costo_total_insumos: 1200,
  },
});

let scenario = createScenario();

const makeTableMock = (table: string) => {
  switch (table) {
    case 'ordenes_produccion':
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              single: vi.fn(async () => ({ data: scenario.ordenRow, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    case 'orden_consumo_lotes':
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: scenario.detalleRows, error: null })),
        })),
      };
    case 'formulas':
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: scenario.formulaLookupRow, error: null })),
            })),
          })),
          order: vi.fn(async () => ({ data: scenario.formulaIngredRows, error: null })),
        })),
      };
    case 'formula_ingredientes':
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: scenario.formulaIngredRows, error: null })),
          })),
        })),
      };
    case 'stock_lotes_mp':
      return {
        select: vi.fn(() => ({
          is: vi.fn(async () => ({ data: scenario.stockRows, error: null })),
        })),
      };
    case 'insumos':
      return {
        select: vi.fn(() => ({
          is: vi.fn(async () => ({ data: scenario.insumoLookupRows, error: null })),
        })),
      };
    case 'usuarios':
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: scenario.usuarioLookupRow, error: null })),
            })),
          })),
        })),
      };
    case 'silos':
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { id: 'silo-db-1', legacy_uid: 'silo-1' }, error: null })),
            })),
          })),
        })),
      };
    default:
      throw new Error(`Tabla no mockeada: ${table}`);
  }
};

beforeEach(() => {
  scenario = createScenario();
  vi.clearAllMocks();
  mockFrom.mockImplementation((table: string) => makeTableMock(table));
  mockRpc.mockResolvedValue({
    data: [scenario.updatedRow],
    error: null,
  });
});

describe('supabaseOrdenService - reserva y edición segura', () => {
  it('crea una OP pendiente reservando stock', async () => {
    scenario = {
      ...scenario,
      stockRows: scenario.stockRows.map((row) => ({ ...row, cantidad_comprometida: 0 })),
    };

    mockRpc.mockResolvedValueOnce({
      data: [scenario.ordenRow],
      error: null,
    });

    const result = await supabaseOrdenService.create({
      lote: 'OP-2026-999',
      id_formula: 'F-001',
      nombre_producto: 'Alimento Test',
      version_formula: 1,
      cantidad_objetivo: 1000,
      detalle_insumos: [],
      costo_total_insumos: 1000,
      usuario_responsable: 'Sergio',
      id_silo: null,
      destino_silo: null,
      estado: 'PENDIENTE',
      fecha_creacion: '2026-05-26T00:00:00Z',
    });

    expect(mockRpc).toHaveBeenCalledWith('crear_orden_produccion_con_reserva', expect.objectContaining({
      p_legacy_uid: '',
      p_lote: '',
      p_detalle: expect.any(Array),
    }));
    expect(result.estado).toBe('PENDIENTE');
  });

  it('edita una OP aumentando cantidad y recalcula la reserva', async () => {
    const result = await supabaseOrdenService.update('OP-2026-999', {
      cantidad_objetivo: 1200,
    });

    const call = mockRpc.mock.calls.find(([name]) => name === 'actualizar_orden_produccion_con_reserva');
    expect(call).toBeTruthy();
    const payload = call?.[1] as Record<string, unknown>;
    const detalle = payload?.p_detalle as Array<Record<string, unknown>>;
    const total = detalle.reduce((acc, item) => acc + Number(item.cantidad_usada), 0);

    expect(payload.p_cantidad_objetivo).toBe(1200);
    expect(total).toBeCloseTo(1200, 6);
    expect(result.estado).toBe('PENDIENTE');
  });

  it('edita una OP reduciendo cantidad y libera excedente de la reserva anterior', async () => {
    await supabaseOrdenService.update('OP-2026-999', {
      cantidad_objetivo: 800,
    });

    const call = mockRpc.mock.calls.find(([name]) => name === 'actualizar_orden_produccion_con_reserva');
    const payload = call?.[1] as Record<string, unknown>;
    const detalle = payload?.p_detalle as Array<Record<string, unknown>>;
    const total = detalle.reduce((acc, item) => acc + Number(item.cantidad_usada), 0);

    expect(payload.p_cantidad_objetivo).toBe(800);
    expect(total).toBeCloseTo(800, 6);
  });

  it('bloquea la edición de una OP finalizada', async () => {
    scenario = {
      ...scenario,
      ordenRow: {
        ...scenario.ordenRow,
        estado: 'FINALIZADO',
      },
    };

    await expect(
      supabaseOrdenService.update('OP-2026-999', { cantidad_objetivo: 900 })
    ).rejects.toThrow('Solo se puede editar una orden PENDIENTE o EN PROCESO.');

    expect(mockRpc).not.toHaveBeenCalledWith('actualizar_orden_produccion_con_reserva', expect.anything());
  });

  it('falla si no alcanza stock para la nueva versión', async () => {
    scenario = {
      ...scenario,
      stockRows: [
        {
          id: 'lot-db-1',
          legacy_uid: 'stk-1',
          lote: 'L1',
          fecha_ingreso: '2026-01-01T00:00:00Z',
          cantidad_actual: 450,
          cantidad_comprometida: 300,
          costo_unitario: 1,
          insumos: [{ legacy_uid: 'i-1', nombre: 'Maiz' }],
        },
        {
          id: 'lot-db-2',
          legacy_uid: 'stk-2',
          lote: 'L2',
          fecha_ingreso: '2026-02-01T00:00:00Z',
          cantidad_actual: 350,
          cantidad_comprometida: 200,
          costo_unitario: 1,
          insumos: [{ legacy_uid: 'i-2', nombre: 'Soja' }],
        },
      ],
    };

    await expect(
      supabaseOrdenService.update('OP-2026-999', { cantidad_objetivo: 1200 })
    ).rejects.toThrow(/Stock insuficiente/);

    expect(mockRpc).not.toHaveBeenCalledWith('actualizar_orden_produccion_con_reserva', expect.anything());
  });

  it('libera la reserva al anular la OP', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await supabaseOrdenService.delete('OP-2026-999');

    expect(mockRpc).toHaveBeenCalledWith('anular_orden_produccion_con_liberacion', {
      p_orden_id: baseOrden.id,
    });
    expect(result).toBe(true);
  });
});
