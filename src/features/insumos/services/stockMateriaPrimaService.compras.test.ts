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

  it('no registra compra financiera para una carga inicial de stock', async () => {
    createMock.mockResolvedValue({ uid: 'stk-099' });

    await stockMateriaPrimaService.create({
      id_insumo: 'i-1',
      nombre_insumo: 'Maiz',
      id_proveedor: 'p-1',
      nombre_prov: 'Proveedor SA',
      ubicacion: 'Silo 1',
      lote: ' lote-ajuste ',
      remito_nro: '',
      cantidad: 10,
      unidad_entrada: TipoUnidad.KG,
      fecha_ingreso: '2026-06-18',
      cantidad_actual: 10,
      cantidad_inicial: 10,
      origen: 'CARGA_INICIAL',
      tipoOperacion: 'AJUSTE',
      registrarCompraFinanciera: false,
    });

    expect(registrarCompraMock).not.toHaveBeenCalled();
  });

  it('registra el movimiento contable solo para una compra real', async () => {
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
      fecha_ingreso: '2026-06-18',
      cantidad_actual: 10,
      cantidad_inicial: 10,
      origen: 'COMPRA',
      tipoOperacion: 'COMPRA',
      registrarCompraFinanciera: true,
      condicion_pago: 'CTA_CTE',
    });

    expect(registrarCompraMock).toHaveBeenCalledWith({
      stock_lote_legacy_uid: 'stk-100',
      fecha: '2026-06-18',
      lote: 'LOTE-1',
      insumo: 'Maiz',
      proveedor: 'Proveedor SA',
      monto: expect.any(Number),
      remito: 'rem-1',
      condicion_pago: 'CTA_CTE',
    });
  });
});
