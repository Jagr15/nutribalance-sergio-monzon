import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TipoUnidad } from '../../../../shared/types/global.interface';

vi.mock('../mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import {
  mockMateriaPrimaService,
  resetMockMateriaPrimaService,
} from './mockMateriaPrimaService';

describe('mockMateriaPrimaService compras', () => {
  beforeEach(() => {
    resetMockMateriaPrimaService();
  });

  it('expone historial de compras y ultimo precio por insumo', async () => {
    const historial = await mockMateriaPrimaService.getHistorialCompras();
    const ultimos = await mockMateriaPrimaService.getUltimosPrecios();

    expect(historial.length).toBeGreaterThan(0);
    expect(ultimos.length).toBeGreaterThan(0);
    expect(historial[0]).toHaveProperty('proveedor');
    expect(ultimos[0]).toHaveProperty('ultimo_precio');
  });

  it('recalcula el historial cuando se registra un ingreso nuevo', async () => {
    const baseCount = (await mockMateriaPrimaService.getHistorialCompras()).length;

    await mockMateriaPrimaService.create({
      id_insumo: 'i-4',
      id_proveedor: 'p-1',
      lote: 'L-COMPRA-TEST',
      remito_nro: 'REM-COMP-1',
      cantidad: 1,
      unidad_entrada: TipoUnidad.KG,
      precio_unitario: 100,
      unidad_precio: 'KG',
      id_usuario: 'usr-admin-01',
      fecha_ingreso: new Date('2026-06-16T00:00:00Z'),
      ubicacion: 'Silo MP',
    });

    const newCount = (await mockMateriaPrimaService.getHistorialCompras()).length;
    expect(newCount).toBe(baseCount + 1);
  });
});
