import { describe, expect, it, vi } from 'vitest';
import { TipoUnidad } from '../../../../shared/types/global.interface';

vi.mock('../mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import { mockMateriaPrimaService } from './mockMateriaPrimaService';

describe('mockMateriaPrimaService', () => {
  it('permite lotes repetidos y consolida el resumen por insumo', async () => {
    const baseResumen = await mockMateriaPrimaService.getResumen();
    const baseRow = baseResumen.find((row) => row.insumo_id === 'i-4');
    expect(baseRow).toBeDefined();

    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'L-TEST-REPETIDO',
      remito_nro: 'REM-TEST-1',
      cantidad: 10,
      unidad_entrada: TipoUnidad.KG,
      costo_total: 1000,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-06-16T00:00:00Z'),
      ubicacion: 'Silo MP',
    });

    await expect(mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'L-TEST-REPETIDO',
      remito_nro: 'REM-TEST-2',
      cantidad: 10,
      unidad_entrada: TipoUnidad.KG,
      costo_total: 1000,
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-06-16T00:00:00Z'),
      ubicacion: 'Silo MP',
    })).resolves.toMatchObject({ lote: 'L-TEST-REPETIDO' });

    const updatedResumen = await mockMateriaPrimaService.getResumen();
    const updatedRow = updatedResumen.find((row) => row.insumo_id === 'i-4');

    expect(updatedRow).toBeDefined();
    expect((updatedRow?.stock_actual ?? 0) - (baseRow?.stock_actual ?? 0)).toBe(20);
    expect((updatedRow?.stock_disponible ?? 0) - (baseRow?.stock_disponible ?? 0)).toBe(20);
  });

  it('calcula costo total cuando el precio unitario viene por tonelada', async () => {
    const lote = await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'L-TEST-TON',
      remito_nro: 'REM-TON-1',
      cantidad: 2,
      unidad_entrada: TipoUnidad.TON,
      precio_unitario: 100000,
      unidad_precio: 'TON',
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-06-16T00:00:00Z'),
      ubicacion: 'Silo MP',
    });

    expect(lote.cantidad_actual).toBe(2000);
    expect(lote.costo_unitario).toBeCloseTo(100, 6);
    expect(lote.costo_total).toBeCloseTo(200000, 6);
  });
});
