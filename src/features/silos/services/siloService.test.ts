import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TipoUnidad } from '../../../shared/types/global.interface';

if (typeof window === 'undefined') {
  (globalThis as any).window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
  } as any;
}

vi.mock('../../../infrastructure/api/mock/mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import { mockSiloService } from '../../../infrastructure/api/mock/services/mockSiloService';
import { mockMateriaPrimaService, resetMockMateriaPrimaService } from '../../../infrastructure/api/mock/services/mockMateriaPrimaService';

describe('mockSiloService - Stock crossing unit tests', () => {
  beforeEach(() => {
    resetMockMateriaPrimaService();
  });

  it('cargar materia prima en un silo y ver reflejado el stock en catálogo de silos', async () => {
    const silosBefore = await mockSiloService.getAll();
    const siloMaizBefore = silosBefore.find(s => s.nombre === 'Silo Maíz');
    expect(siloMaizBefore).toBeDefined();
    const originalStock = siloMaizBefore?.stock_actual_ton ?? 0;

    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'LOTE-MAIZ-1',
      remito_nro: 'REM-1',
      cantidad: 5000,
      unidad_entrada: TipoUnidad.KG,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-07-02T12:00:00Z'),
      ubicacion: 'Silo Maíz'
    });

    const silosAfter = await mockSiloService.getAll();
    const siloMaizAfter = silosAfter.find(s => s.nombre === 'Silo Maíz');
    expect(siloMaizAfter?.stock_actual_ton).toBe(originalStock + 5);
  });

  it('cargar materia prima en distintos silos y que cada silo muestre solo su saldo', async () => {
    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'LOTE-MAIZ-2',
      remito_nro: 'REM-2',
      cantidad: 5000,
      unidad_entrada: TipoUnidad.KG,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-07-02T12:00:00Z'),
      ubicacion: 'Silo Maíz'
    });

    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'LOTE-SOJA-2',
      remito_nro: 'REM-3',
      cantidad: 3000,
      unidad_entrada: TipoUnidad.KG,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-07-02T12:00:00Z'),
      ubicacion: 'Silo Soja'
    });

    const silos = await mockSiloService.getAll();
    const siloMaiz = silos.find(s => s.nombre === 'Silo Maíz');
    const siloSoja = silos.find(s => s.nombre === 'Silo Soja');

    expect(siloMaiz).toBeDefined();
    expect(siloSoja).toBeDefined();
    expect(siloMaiz?.stock_actual_ton).toBeGreaterThan(0);
    expect(siloSoja?.stock_actual_ton).toBeGreaterThan(0);
  });

  it('convertir kg a toneladas correctamente', async () => {
    const silosBefore = await mockSiloService.getAll();
    const siloMaizBefore = silosBefore.find(s => s.nombre === 'Silo Maíz')!;
    const beforeStock = siloMaizBefore.stock_actual_ton ?? 0;

    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'LOTE-CONV-1',
      remito_nro: 'REM-4',
      cantidad: 1500,
      unidad_entrada: TipoUnidad.KG,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-07-02T12:00:00Z'),
      ubicacion: 'Silo Maíz'
    });

    const silosAfter = await mockSiloService.getAll();
    const siloMaizAfter = silosAfter.find(s => s.nombre === 'Silo Maíz')!;
    expect(siloMaizAfter.stock_actual_ton).toBe(Number((beforeStock + 1.5).toFixed(2)));
  });

  it('no sumar lotes anulados o sin saldo', async () => {
    const lot = await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'LOTE-DEP-1',
      remito_nro: 'REM-5',
      cantidad: 4000,
      unidad_entrada: TipoUnidad.KG,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-07-02T12:00:00Z'),
      ubicacion: 'Silo Maíz'
    });

    const silosBefore = await mockSiloService.getAll();
    const siloMaizBefore = silosBefore.find(s => s.nombre === 'Silo Maíz')!;
    const beforeStock = siloMaizBefore.stock_actual_ton ?? 0;

    lot.cantidad_actual = 0;

    const silosAfter = await mockSiloService.getAll();
    const siloMaizAfter = silosAfter.find(s => s.nombre === 'Silo Maíz')!;
    expect(siloMaizAfter.stock_actual_ton).toBe(Number((beforeStock - 4).toFixed(2)));
  });

  it('no mezclar producto terminado con materia prima', async () => {
    const silos = await mockSiloService.getAll();
    const siloMaiz = silos.find(s => s.nombre === 'Silo Maíz')!;
    const siloLechera = silos.find(s => s.nombre === 'Silo Lechera')!;

    expect(siloMaiz.tipo_uso).toBe('MATERIA_PRIMA');
    expect(siloLechera.tipo_uso).toBe('PRODUCTO_TERMINADO');

    const lecheraStockBefore = siloLechera.stock_actual_ton;

    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'LOTE-PT-1',
      remito_nro: 'REM-6',
      cantidad: 8000,
      unidad_entrada: TipoUnidad.KG,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-07-02T12:00:00Z'),
      ubicacion: 'Silo Lechera'
    });

    const silosAfter = await mockSiloService.getAll();
    const siloLecheraAfter = silosAfter.find(s => s.nombre === 'Silo Lechera')!;
    expect(siloLecheraAfter.stock_actual_ton).toBe(lecheraStockBefore);
  });
});
