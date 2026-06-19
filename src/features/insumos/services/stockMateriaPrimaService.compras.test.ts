import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TipoUnidad } from '../../../shared/types/global.interface';

const { createMock, auditMock, registrarCompraMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  auditMock: vi.fn(),
  registrarCompraMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/', () => ({
  ApiService: { stockMP: { getAllLotes: vi.fn(), create: createMock, update: vi.fn(), delete: vi.fn() } },
}));
vi.mock('../../auth/audit', () => ({ auditAction: auditMock }));
vi.mock('../../finanzas/services/contabilidadOperativaService', () => ({
  contabilidadOperativaService: { registrarCompraMateriaPrima: registrarCompraMock },
}));

import { stockMateriaPrimaService } from './stockMateriaPrimaService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  },
});

describe('stockMateriaPrimaService compras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('nutribalance_auth', 'true');
    localStorage.setItem('nutribalance_user_role', 'inventario');
  });

  it('registra el movimiento contable al crear un lote', async () => {
    createMock.mockResolvedValue({ uid: 'stk-100' });

    await stockMateriaPrimaService.create({
      id_insumo: 'i-1',
      nombre_insumo: 'Maiz',
      id_proveedor: 'p-1',
      nombre_prov: 'Proveedor SA',
      ubicacion: 'Silo 1',
      lote: ' lote-1 ',
      remito_nro: ' rem-1 ',
      cantidad: 10,
      unidad_entrada: TipoUnidad.KG,
      precio_unitario: 100,
      unidad_precio: 'KG',
      fecha_ingreso: '2026-06-18',
      cantidad_actual: 10,
      cantidad_inicial: 10,
    });

    expect(registrarCompraMock).toHaveBeenCalledWith({
      stock_lote_legacy_uid: 'stk-100',
      fecha: '2026-06-18',
      lote: 'LOTE-1',
      insumo: 'Maiz',
      proveedor: 'Proveedor SA',
      monto: expect.any(Number),
      remito: 'rem-1',
    });
  });
});
