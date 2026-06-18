import { describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../../../infrastructure/api/supabase/client', () => ({
  supabaseClient: {
    from: fromMock,
  },
}));

import { SupabaseArcaFiscalRepository } from './SupabaseArcaFiscalRepository';
import { SupabaseArcaEventoFiscalRepository } from './SupabaseArcaEventoFiscalRepository';
import type { Factura } from '../../domain/entities/Factura';

const buildFactura = (): Factura => ({
  id: 'factura-local-1',
  modalidad: 'FACTURA_B',
  tipoComprobante: 'B',
  clienteFiscal: {
    id: 'cli-001',
    nombre: 'Cliente Fiscal SA',
    tipoDocumento: 'CUIT',
    numeroDocumento: '30-12345678-9',
    condicionIva: 'RESPONSABLE_INSCRIPTO',
  },
  items: [
    {
      concepto: 'Producto',
      cantidad: 1,
      unidadMedida: 'UN',
      precioUnitario: 10,
      alicuotaIva: 0.21,
      subtotal: 10,
      iva: 2.1,
      total: 12.1,
    },
  ],
  moneda: 'ARS',
  totales: {
    subtotal: 10,
    iva: 2.1,
    total: 12.1,
  },
  estadoFiscal: 'ACEPTADA',
  numeroComprobante: 'SIM-B-00001',
  puntoVenta: '0001',
  observaciones: 'Demo',
  createdAt: '2026-06-17T12:00:00.000Z',
});

describe('SupabaseArcaFiscalRepository', () => {
  it('guarda factura y comprobante con el mapeo fiscal esperado', async () => {
    const facturaSingle = vi.fn(async () => ({ data: { id: 'fact-db-1', created_at: '2026-06-17T12:00:01.000Z' }, error: null }));
    const comprobanteSingle = vi.fn(async () => ({
      data: { id: 'comp-db-1', factura_id: 'fact-db-1', created_at: '2026-06-17T12:00:02.000Z' },
      error: null,
    }));
    const facturaInsert = vi.fn(() => ({ select: () => ({ single: facturaSingle }) }));
    const comprobanteInsert = vi.fn(() => ({ select: () => ({ single: comprobanteSingle }) }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'arca_facturas') {
        return { insert: facturaInsert };
      }
      if (table === 'arca_comprobantes') {
        return { insert: comprobanteInsert };
      }
      throw new Error(`Tabla inesperada: ${table}`);
    });

    const repository = new SupabaseArcaFiscalRepository();
    const facturaPersistida = await repository.guardarFactura({
      factura: buildFactura(),
      providerMode: 'SIMULACION',
      estadoFiscal: 'ACEPTADA',
    });
    const comprobantePersistido = await repository.guardarComprobante({
      facturaId: facturaPersistida.id,
      comprobante: {
        id: 'comp-local-1',
        facturaId: 'factura-local-1',
        modalidad: 'FACTURA_B',
        numero: 'SIM-B-00001',
        puntoVenta: '0001',
        estado: 'ACEPTADA',
        providerMode: 'SIMULACION',
        responseRaw: { simulated: true },
        createdAt: '2026-06-17T12:00:00.000Z',
      },
      providerMode: 'SIMULACION',
    });

    expect(facturaPersistida.id).toBe('fact-db-1');
    expect(comprobantePersistido.id).toBe('comp-db-1');
    expect(facturaInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        modalidad: 'FACTURA_B',
        cliente_nombre: 'Cliente Fiscal SA',
        impuestos: 2.1,
        total: 12.1,
        provider_mode: 'SIMULACION',
      }),
    );
    expect(comprobanteInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        factura_id: 'fact-db-1',
        numero: 'SIM-B-00001',
        provider_mode: 'SIMULACION',
      }),
    );
  });
});

describe('SupabaseArcaEventoFiscalRepository', () => {
  it('guarda eventos de auditoria fiscal', async () => {
    const eventoSingle = vi.fn(async () => ({ data: { id: 'evt-db-1', created_at: '2026-06-17T12:00:03.000Z' }, error: null }));
    const eventoInsert = vi.fn(() => ({ select: () => ({ single: eventoSingle }) }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'arca_eventos_fiscales') {
        return { insert: eventoInsert };
      }
      throw new Error(`Tabla inesperada: ${table}`);
    });

    const repository = new SupabaseArcaEventoFiscalRepository();
    const result = await repository.registrarEvento({
      facturaId: 'fact-db-1',
      comprobanteId: 'comp-db-1',
      accion: 'EMISION_SIMULADA',
      estado: 'ACEPTADA',
      providerMode: 'SIMULACION',
      mensaje: 'Emision fiscal simulada persistida.',
      payload: { numeroComprobante: 'SIM-B-00001' },
    });

    expect(result.id).toBe('evt-db-1');
    expect(eventoInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        factura_id: 'fact-db-1',
        comprobante_id: 'comp-db-1',
        accion: 'EMISION_SIMULADA',
        provider_mode: 'SIMULACION',
      }),
    );
  });
});
