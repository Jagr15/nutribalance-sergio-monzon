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
import { contabilidadOperativaService } from '../../finanzas/services/contabilidadOperativaService';

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

describe('mockClienteService.getPagos - Unit Tests (Mock mode)', () => {
  beforeEach(() => {
    runtimeConfig.mode = 'mock';
    resetMockStockPTService();
    window.localStorage.removeItem('nutribalance_tesoreria_cheques_v1');
    window.localStorage.removeItem('nutribalance_contabilidad_operativa_v1');
  });

  it('mostrar pagos de distintos clientes en una sola vista', async () => {
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: 2000,
      fechaPago: '2026-07-02T10:00:00Z',
      metodoPago: 'efectivo',
      referencia: 'REF-1',
    });

    await mockClienteService.registrarPago({
      clienteId: 'cli-002',
      monto: 5000,
      fechaPago: '2026-07-03T10:00:00Z',
      metodoPago: 'transferencia',
      referencia: 'REF-2',
    });

    const pagos = await mockClienteService.getPagos();

    expect(pagos).toHaveLength(2);
    const names = pagos.map(p => p.clienteNombre);
    expect(names).toContain('Estancia La Esperanza');
    expect(names).toContain('Agropecuaria Don Sergio');
  });

  it('filtrar por cliente en el listado', async () => {
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: 2000,
      fechaPago: '2026-07-02T10:00:00Z',
      metodoPago: 'efectivo',
      referencia: 'REF-1',
    });

    await mockClienteService.registrarPago({
      clienteId: 'cli-002',
      monto: 5000,
      fechaPago: '2026-07-03T10:00:00Z',
      metodoPago: 'transferencia',
      referencia: 'REF-2',
    });

    const pagos = await mockClienteService.getPagos();
    const filteredForCli1 = pagos.filter(p => p.clienteId === 'cli-001');
    const filteredForCli2 = pagos.filter(p => p.clienteId === 'cli-002');

    expect(filteredForCli1).toHaveLength(1);
    expect(filteredForCli1[0].monto).toBe(2000);
    expect(filteredForCli2).toHaveLength(1);
    expect(filteredForCli2[0].monto).toBe(5000);
  });

  it('filtrar por fecha', async () => {
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: 2000,
      fechaPago: '2026-07-02T10:00:00Z',
      metodoPago: 'efectivo',
      referencia: 'REF-1',
    });

    await mockClienteService.registrarPago({
      clienteId: 'cli-002',
      monto: 5000,
      fechaPago: '2026-07-05T10:00:00Z',
      metodoPago: 'transferencia',
      referencia: 'REF-2',
    });

    const pagos = await mockClienteService.getPagos();
    const filtered = pagos.filter(p => {
      const d = p.fecha.split('T')[0];
      return d >= '2026-07-01' && d <= '2026-07-03';
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].clienteId).toBe('cli-001');
  });

  it('sumar correctamente el total visible', async () => {
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: 2000,
      fechaPago: '2026-07-02T10:00:00Z',
      metodoPago: 'efectivo',
    });

    await mockClienteService.registrarPago({
      clienteId: 'cli-002',
      monto: 5000,
      fechaPago: '2026-07-03T10:00:00Z',
      metodoPago: 'transferencia',
    });

    const pagos = await mockClienteService.getPagos();
    const sum = pagos.reduce((acc, p) => acc + p.monto, 0);
    expect(sum).toBe(7000);
  });

  it('evitar duplicados cuando un pago tiene movimiento financiero relacionado', async () => {
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: 3000,
      fechaPago: '2026-07-02T10:00:00Z',
      metodoPago: 'efectivo',
    });

    const pagos = await mockClienteService.getPagos();
    expect(pagos).toHaveLength(1);
    const ids = pagos.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('excluir o marcar correctamente pagos cancelados/anulados si existen', async () => {
    await mockClienteService.registrarPago({
      clienteId: 'cli-001',
      monto: 1000,
      fechaPago: '2026-07-02T10:00:00Z',
      metodoPago: 'cheque',
      cheque: {
        numero: '999',
        banco: 'Banco Nación',
        fechaEmision: '2026-07-01',
        fechaVencimiento: '2026-07-07',
      }
    });

    const pagosBefore = await mockClienteService.getPagos();
    const chequePago = pagosBefore.find(p => p.metodoPago === 'cheque');
    expect(chequePago).toBeDefined();
    expect(chequePago?.estado).toBe('PENDIENTE');

    // Register an annulled client payment directly
    await contabilidadOperativaService.ensureMovimiento({
      legacy_uid: 'fcm-pago-anulado-test',
      fecha: '2026-07-02T10:00:00Z',
      tipo: 'INGRESO',
      origen_operativo: 'COBRANZA',
      descripcion: 'Cobro cliente anulado',
      monto: 4000,
      estado: 'ANULADO',
      metadata: {
        cliente_legacy_uid: 'cli-001',
      }
    });

    const pagosAfter = await mockClienteService.getPagos();
    const annulledPago = pagosAfter.find(p => p.id === 'fcm-pago-anulado-test');
    expect(annulledPago).toBeDefined();
    expect(annulledPago?.estado).toBe('ANULADO');

    // Summing should exclude ANULADO and CANCELADO
    const validPagosSum = pagosAfter
      .filter(p => p.estado !== 'ANULADO' && p.estado !== 'CANCELADO')
      .reduce((acc, p) => acc + p.monto, 0);

    expect(validPagosSum).toBe(1000); // Only the cheque payment is valid
  });
});
