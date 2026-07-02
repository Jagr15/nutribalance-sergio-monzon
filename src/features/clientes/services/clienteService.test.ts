import { describe, expect, it, beforeEach, vi } from 'vitest';

// Define a stub for window and localStorage in Node test environment
if (typeof window === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
      length: 0,
      key: () => null,
    },
  } as any;
}

vi.mock('../../../infrastructure/api/mock/mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import { mockClienteService } from '../../../infrastructure/api/mock/services/mockClienteService';
import { resetMockStockPTService } from '../../../infrastructure/api/mock/services/mockStockPTService';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';

describe('mockClienteService.registrarPago - Unit Tests (Mock mode)', () => {
  beforeEach(() => {
    runtimeConfig.mode = 'mock';
    resetMockStockPTService();
    window.localStorage.removeItem('nutribalance_tesoreria_cheques_v1');
    window.localStorage.removeItem('nutribalance_contabilidad_operativa_v1');
  });

  it('Caso A: Registrar pago parcial en efectivo', async () => {
    const clientsBefore = await mockClienteService.getAll();
    const target = clientsBefore.find((c) => c.uid === 'cli-001')!;
    const originalSaldo = target.saldoPendienteArs;
    expect(originalSaldo).toBeGreaterThan(0);

    const paymentAmount = 2000;
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: paymentAmount,
      fechaPago: '2026-07-02',
      metodoPago: 'efectivo',
      referencia: 'REF-123',
      observaciones: 'Pago parcial efectivo',
    });

    const clientsAfter = await mockClienteService.getAll();
    const targetAfter = clientsAfter.find((c) => c.uid === 'cli-001')!;
    expect(targetAfter.saldoPendienteArs).toBe(originalSaldo - paymentAmount);

    const ccRows = await mockClienteService.getEstadoCuentaCliente('cli-001');
    const recibo = ccRows.find((r) => r.producto === 'PAGO CLIENTE' && r.importe === paymentAmount);
    expect(recibo).toBeDefined();
    expect(recibo?.referencia).toBe('REF-123');
  });

  it('Caso B: Registrar pago total', async () => {
    const clientsBefore = await mockClienteService.getAll();
    const target = clientsBefore.find((c) => c.uid === 'cli-001')!;
    const originalSaldo = target.saldoPendienteArs;

    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: originalSaldo,
      fechaPago: '2026-07-02',
      metodoPago: 'transferencia',
      referencia: 'TRANSF-TOTAL',
    });

    const clientsAfter = await mockClienteService.getAll();
    const targetAfter = clientsAfter.find((c) => c.uid === 'cli-001')!;
    expect(targetAfter.saldoPendienteArs).toBe(0);

    const ccRows = await mockClienteService.getEstadoCuentaCliente('cli-001');
    const facturas = ccRows.filter((r) => r.producto !== 'PAGO CLIENTE');
    facturas.forEach((f) => {
      expect(f.saldo).toBe(0);
      expect(f.estado).toBe('PAGADO');
    });
  });

  it('Caso C: Pago mayor al saldo debe bloquearse', async () => {
    const clientsBefore = await mockClienteService.getAll();
    const target = clientsBefore.find((c) => c.uid === 'cli-001')!;
    const originalSaldo = target.saldoPendienteArs;

    await expect(
      mockClienteService.registrarPago({
        clienteId: 'cli-001',
        monto: originalSaldo + 100,
        fechaPago: '2026-07-02',
        metodoPago: 'efectivo',
      })
    ).rejects.toThrow();
  });

  it('Caso D: Registrar pago con cheque crea cheque recibido en tesorería', async () => {
    const paymentAmount = 1000;
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: paymentAmount,
      fechaPago: '2026-07-02',
      metodoPago: 'cheque',
      referencia: 'CH-888',
      cheque: {
        numero: '888',
        banco: 'Banco Nación',
        fechaEmision: '2026-07-01',
        fechaVencimiento: '2026-07-07',
      },
    });

    const raw = window.localStorage.getItem('nutribalance_tesoreria_cheques_v1');
    expect(raw).toBeDefined();
    const cheques = JSON.parse(raw || '[]');
    const cheque = cheques.find((c: any) => c.numero === '888');
    expect(cheque).toBeDefined();
    expect(cheque.importe).toBe(paymentAmount);
    expect(cheque.estado).toBe('PENDIENTE');
  });

  it('Caso E: Cliente sin saldo inicial debe bloquearse', async () => {
    const clientsBefore = await mockClienteService.getAll();
    const target = clientsBefore.find((c) => c.uid === 'cli-003')!;
    expect(target.saldoPendienteArs).toBe(0);

    await expect(
      mockClienteService.registrarPago({
        clienteId: 'cli-003',
        monto: 500,
        fechaPago: '2026-07-02',
        metodoPago: 'efectivo',
      })
    ).rejects.toThrow();
  });
});
