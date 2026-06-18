import { describe, expect, it } from 'vitest';
import type {
  ArcaConsultaRepositoryPort,
} from '../ports/ArcaConsultaRepositoryPort';
import { consultarComprobantesArca } from './ConsultarComprobantesArca';
import { consultarEventosFiscalesArca } from './ConsultarEventosFiscalesArca';
import { consultarFacturaArcaPorId } from './ConsultarFacturaArcaPorId';
import { consultarFacturasArca } from './ConsultarFacturasArca';

const repositoryOk: ArcaConsultaRepositoryPort = {
  consultarFacturas: async () => ([
    {
      id: 'fact-1',
      modalidad: 'FACTURA_B',
      tipoComprobante: 'B',
      clienteNombre: 'Cliente Demo SA',
      clienteDocumento: '30-12345678-9',
      clienteCondicionIva: 'RESPONSABLE_INSCRIPTO',
      moneda: 'ARS',
      subtotal: 100,
      impuestos: 21,
      total: 121,
      estadoFiscal: 'ACEPTADA',
      numeroComprobante: 'SIM-B-00001',
      puntoVenta: '0001',
      providerMode: 'SIMULACION',
      sourceEntidad: 'demo',
      sourceEntidadId: 'demo-1',
      createdAt: '2026-06-17T12:00:00.000Z',
    },
  ]),
  consultarFacturaPorId: async (facturaId: string) => (facturaId === 'fact-1' ? {
    id: 'fact-1',
    modalidad: 'FACTURA_B',
    tipoComprobante: 'B',
    clienteNombre: 'Cliente Demo SA',
    clienteDocumento: '30-12345678-9',
    clienteCondicionIva: 'RESPONSABLE_INSCRIPTO',
    moneda: 'ARS',
    subtotal: 100,
    impuestos: 21,
    total: 121,
    estadoFiscal: 'ACEPTADA',
    numeroComprobante: 'SIM-B-00001',
    puntoVenta: '0001',
    providerMode: 'SIMULACION',
    sourceEntidad: 'demo',
    sourceEntidadId: 'demo-1',
    createdAt: '2026-06-17T12:00:00.000Z',
  } : null),
  consultarComprobantes: async () => ([
    {
      id: 'comp-1',
      facturaId: 'fact-1',
      modalidad: 'FACTURA_B',
      numero: 'SIM-B-00001',
      puntoVenta: '0001',
      estado: 'ACEPTADA',
      providerMode: 'SIMULACION',
      responseRaw: { simulated: true },
      createdAt: '2026-06-17T12:00:01.000Z',
    },
  ]),
  consultarEventosFiscales: async () => ([
    {
      id: 'evt-1',
      facturaId: 'fact-1',
      comprobanteId: 'comp-1',
      accion: 'EMISION_SIMULADA',
      estado: 'ACEPTADA',
      providerMode: 'SIMULACION',
      mensaje: 'Ok',
      payload: { numeroComprobante: 'SIM-B-00001' },
      createdAt: '2026-06-17T12:00:02.000Z',
    },
  ]),
};

const repositoryError: ArcaConsultaRepositoryPort = {
  consultarFacturas: async () => { throw new Error('boom'); },
  consultarFacturaPorId: async () => { throw new Error('boom'); },
  consultarComprobantes: async () => { throw new Error('boom'); },
  consultarEventosFiscales: async () => { throw new Error('boom'); },
};

describe('consultas ARCA', () => {
  it('consulta de facturas con repositorio mock', async () => {
    const result = await consultarFacturasArca({ modalidad: 'FACTURA_B' }, { repository: repositoryOk });

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].numeroComprobante).toBe('SIM-B-00001');
  });

  it('consulta de factura por ID encontrada', async () => {
    const result = await consultarFacturaArcaPorId({ facturaId: 'fact-1' }, { repository: repositoryOk });

    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('fact-1');
  });

  it('consulta de factura por ID no encontrada', async () => {
    const result = await consultarFacturaArcaPorId({ facturaId: 'fact-x' }, { repository: repositoryOk });

    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors).toEqual(['Factura fiscal no encontrada.']);
  });

  it('consulta de comprobantes por factura', async () => {
    const result = await consultarComprobantesArca({ facturaId: 'fact-1' }, { repository: repositoryOk });

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].facturaId).toBe('fact-1');
  });

  it('consulta de eventos por factura', async () => {
    const result = await consultarEventosFiscalesArca({ facturaId: 'fact-1' }, { repository: repositoryOk });

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].accion).toBe('EMISION_SIMULADA');
  });

  it('maneja error controlado del repositorio', async () => {
    const result = await consultarFacturasArca({}, { repository: repositoryError });

    expect(result.ok).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors[0]).toContain('boom');
  });
});
