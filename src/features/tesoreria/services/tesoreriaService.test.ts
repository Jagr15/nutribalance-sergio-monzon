import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, insertMock, updateMock, singleMock, maybeSingleMock, selectMock, eqMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  singleMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock('../../../infrastructure/api/runtimeConfig', () => ({ runtimeConfig: { mode: 'supabase' } }));
vi.mock('../../../infrastructure/api/supabase/client', () => ({ supabaseClient: { from: fromMock } }));
vi.mock('../../finanzas/services/contabilidadOperativaService', () => ({
  contabilidadOperativaService: {
    registrarCobranzaComprobante: vi.fn(),
    registrarPagoComprobante: vi.fn(),
  },
}));

import { tesoreriaService } from './tesoreriaService';

describe('tesoreriaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table !== 'tesoreria_cheques') throw new Error(`tabla inesperada: ${table}`);
      const chain = {
        select: selectMock.mockReturnValue({
          eq: eqMock.mockReturnValue({
            maybeSingle: maybeSingleMock,
          }),
          order: vi.fn().mockReturnThis(),
          single: singleMock,
        }),
        insert: insertMock.mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: singleMock,
          }),
        }),
        update: updateMock.mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: singleMock,
            }),
          }),
        }),
        eq: eqMock.mockReturnValue({
          maybeSingle: maybeSingleMock,
          select: vi.fn().mockReturnValue({
            single: singleMock,
          }),
        }),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      };
      return chain;
    });
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: singleMock,
      }),
    });
    updateMock.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
    });
  });

  it('crea un cheque recibido sin fecha de acreditación y la deja null', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'chq-1',
        numero: '0001',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Demo',
        importe: 1000,
        fecha_emision: '2026-06-18',
        fecha_vencimiento: '2026-06-20',
        fecha_acreditacion: null,
        estado: 'PENDIENTE',
        cliente_id: null,
        cliente_nombre: 'Cliente Demo',
      },
      error: null,
    });

    const created = await tesoreriaService.createCheque({
      numero: '0001',
      tipo: 'RECIBIDO',
      tercero: 'Cliente Demo',
      importe: 1000,
      fecha_emision: '2026-06-18',
      fecha_vencimiento: '2026-06-20',
      fecha_acreditacion: '',
      estado: 'PENDIENTE',
      cliente_id: null,
      cliente_nombre: 'Cliente Demo',
    });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      fecha_acreditacion: null,
      numero: '0001',
    }));
    expect(created.fecha_acreditacion).toBeNull();
  });

  it('crea un cheque emitido sin fecha de acreditación', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'chq-2',
        numero: '0002',
        tipo: 'EMITIDO',
        tercero: 'Proveedor Demo',
        importe: 2000,
        fecha_emision: '2026-06-18',
        fecha_vencimiento: '2026-06-25',
        fecha_acreditacion: null,
        estado: 'PENDIENTE',
        cliente_id: null,
        cliente_nombre: null,
      },
      error: null,
    });

    await tesoreriaService.createCheque({
      numero: '0002',
      tipo: 'EMITIDO',
      tercero: 'Proveedor Demo',
      importe: 2000,
      fecha_emision: '2026-06-18',
      fecha_vencimiento: '2026-06-25',
      fecha_acreditacion: null,
      estado: 'PENDIENTE',
    });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ fecha_acreditacion: null }));
  });

  it('no duplica la acción directa si el cheque ya está depositado', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'chq-1',
        numero: '0001',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Demo',
        importe: 1000,
        fecha_emision: '2026-06-18',
        fecha_vencimiento: '2026-06-20',
        fecha_acreditacion: null,
        estado: 'DEPOSITADO',
        cliente_id: null,
        cliente_nombre: 'Cliente Demo',
      },
      error: null,
    });

    const updated = await tesoreriaService.updateChequeEstado('chq-1', 'DEPOSITADO');
    expect(updateMock).not.toHaveBeenCalled();
    expect(updated.estado).toBe('DEPOSITADO');
  });

  it('no vuelve a actualizar un cheque rechazado si ya quedó rechazado', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'chq-9',
        numero: '0009',
        tipo: 'RECIBIDO',
        tercero: 'Cliente Demo',
        importe: 500,
        fecha_emision: '2026-06-18',
        fecha_vencimiento: '2026-06-20',
        fecha_acreditacion: null,
        estado: 'RECHAZADO',
        cliente_id: null,
        cliente_nombre: 'Cliente Demo',
      },
      error: null,
    });

    const updated = await tesoreriaService.updateChequeEstado('chq-9', 'RECHAZADO');
    expect(updateMock).not.toHaveBeenCalled();
    expect(updated.estado).toBe('RECHAZADO');
  });
});
