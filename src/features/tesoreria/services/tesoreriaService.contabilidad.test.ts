import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMock, ensureMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  ensureMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({
  runtimeConfig: { mode: 'mock' },
}));
vi.mock('../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: {
    from: vi.fn(),
  },
}));
vi.mock('../../finanzas/services/contabilidadOperativaService', () => ({
  contabilidadOperativaService: {
    registrarCobranzaComprobante: ensureMock,
    registrarPagoComprobante: updateMock,
  },
}));

import { tesoreriaService } from './tesoreriaService';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: localStorageMock },
});
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock });

describe('tesoreriaService contabilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('nutribalance_tesoreria_cheques_v1', JSON.stringify([
      { id: 'chq-1', numero: '0001', tipo: 'RECIBIDO', tercero: 'Cliente Demo', importe: 1000, fecha_emision: '2026-06-01', fecha_vencimiento: '2026-06-10', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: 'Cliente Demo' },
      { id: 'chq-2', numero: '0002', tipo: 'EMITIDO', tercero: 'Proveedor Demo', importe: 2000, fecha_emision: '2026-06-01', fecha_vencimiento: '2026-06-10', estado: 'PENDIENTE', cliente_id: null, cliente_nombre: null },
    ]));
  });

  it('registra cobranza al cobrar un cheque recibido', async () => {
    const cheque = await tesoreriaService.updateChequeEstado('chq-1', 'COBRADO');
    expect(ensureMock).toHaveBeenCalledWith(expect.objectContaining({
      comprobante_legacy_uid: 'chq-chq-1',
      tercero: 'Cliente Demo',
      monto: 1000,
      referencia: 'Cobranza por cheque 0001',
    }));
    expect(cheque.estado).toBe('COBRADO');
  });

  it('registra pago al depositar un cheque emitido', async () => {
    const cheque = await tesoreriaService.updateChequeEstado('chq-2', 'DEPOSITADO');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      comprobante_legacy_uid: 'chq-chq-2',
      tercero: 'Proveedor Demo',
      monto: 2000,
      referencia: 'Pago por cheque 0002',
    }));
    expect(cheque.estado).toBe('DEPOSITADO');
  });
});
