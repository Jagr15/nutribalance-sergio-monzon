import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import { mockOrdenesExpedicionService, resetMockOrdenesExpedicionService } from './mockOrdenesExpedicionService';
import { mockStockPTService, resetMockStockPTService } from './mockStockPTService';

describe('mockOrdenesExpedicionService', () => {
  beforeEach(() => {
    resetMockStockPTService();
    resetMockOrdenesExpedicionService();
  });

  it('crea una expedición y descuenta stock PT', async () => {
    const inicial = await mockOrdenesExpedicionService.getAll();
    const lote = (await mockStockPTService.getAll())[0]!;

    const created = await mockOrdenesExpedicionService.create({
      stock_pt_id: lote.uid,
      cliente_id: 'cli-001',
      presentacion_key: 'GRANEL_KG',
      presentacion: 'GRANEL',
      cantidad: 10,
      unidad_cantidad: 'kg',
      motivo: 'Venta',
      referencia: 'EXP-TEST',
    });

    expect(created.cliente_nombre).toBe('Estancia La Esperanza');
    expect(created.presentacion).toBe('GRANEL');

    const expediciones = await mockOrdenesExpedicionService.getAll();
    expect(expediciones.length).toBe(inicial.length + 1);
    expect(expediciones[0].referencia).toBe('EXP-TEST');
  });

  it('rechaza expediciones sin cliente', async () => {
    const stock = (await mockStockPTService.getAll())[0]!;

    await expect(mockOrdenesExpedicionService.create({
      stock_pt_id: stock.uid,
      cliente_id: '',
      presentacion_key: 'BOLSA_20',
      presentacion: 'BOLSA',
      cantidad: 1,
      unidad_cantidad: 'kg',
    })).rejects.toThrow('El cliente destino es obligatorio.');
  });

  it('convierte toneladas a kg', async () => {
    const stock = (await mockStockPTService.getAll())[0]!;
    const created = await mockOrdenesExpedicionService.create({
      stock_pt_id: stock.uid,
      cliente_id: 'cli-001',
      presentacion_key: 'TONELADA',
      presentacion: 'GRANEL',
      cantidad: 1.25,
      unidad_cantidad: 'tonelada',
    });

    expect(created.cantidad_original).toBe(1.25);
    expect(created.cantidad_kg).toBe(1250);
  });
});
