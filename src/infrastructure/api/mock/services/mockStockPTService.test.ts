import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import { mockStockPTService, resetMockStockPTService } from './mockStockPTService';

describe('mockStockPTService', () => {
  beforeEach(() => {
    resetMockStockPTService();
  });

  it('consolida el resumen y registra salidas', async () => {
    const resumenInicial = await mockStockPTService.getResumen();
    expect(resumenInicial.length).toBeGreaterThan(0);

    const primerLote = (await mockStockPTService.getAll())[0]!;
    const updated = await mockStockPTService.registrarSalida({
      stock_pt_id: primerLote.uid,
      cantidad: 10,
      motivo: 'Venta',
      referencia: 'FAC-001',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
    });

    expect(updated.cantidad_total).toBe(primerLote.cantidad_total - 10);

    const movimientos = await mockStockPTService.getMovimientos();
    expect(movimientos[0]).toMatchObject({
      stock_pt_id: primerLote.uid,
      tipo: 'SALIDA',
      motivo: 'Venta',
      referencia: 'FAC-001',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
    });
  });

  it('rechaza salidas sin saldo suficiente', async () => {
    const primerLote = (await mockStockPTService.getAll())[0]!;
    await expect(mockStockPTService.registrarSalida({
      stock_pt_id: primerLote.uid,
      cantidad: primerLote.cantidad_total + 1,
      motivo: 'Venta',
      referencia: 'FAC-002',
    })).rejects.toThrow('No hay saldo suficiente');
  });
});
