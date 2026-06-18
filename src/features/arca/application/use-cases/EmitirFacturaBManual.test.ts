import { describe, expect, it, vi } from 'vitest';
import type { Cliente } from '../../../clientes/types/cliente';
import { ARCA_CONFIG, ArcaSimulationProvider, emitirFacturaBManual } from '../../index';

const clock = {
  now: () => new Date('2026-06-17T12:00:00.000Z'),
};

const createIdGenerator = () => {
  const counters = new Map<string, number>();
  return {
    nextId: (prefix = 'arca') => {
      const current = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, current);
      return `${prefix}-${String(current).padStart(3, '0')}`;
    },
  };
};

const clienteEmpresa: Cliente = {
  uid: 'cli-empresa-1',
  nombre: 'Ferreteria del Norte',
  razonSocial: 'Ferreteria del Norte SA',
  cuit: '30-12345678-9',
  email: 'facturacion@ferreteria.com',
  telefono: '11-5555-5555',
  direccion: 'Av. Siempre Viva 123',
  localidad: 'CABA',
  provincia: 'Buenos Aires',
  segmento: 'Mayorista',
  ubicacion: 'Deposito 1',
  contacto: 'Juan Perez',
  productoPrincipal: 'Ferreteria',
  condicionComercial: '30 dias',
  estado: 'Activo',
  observaciones: 'Cliente B2B',
  saldoPendienteArs: 0,
  estaActivo: true,
};

const clienteSinDatos: Cliente = {
  uid: 'cli-sin-datos',
  nombre: 'Cliente Generico',
  estado: 'Activo',
  saldoPendienteArs: 0,
  estaActivo: true,
};

const buildPersistence = () => ({
  guardarFactura: vi.fn(async () => ({ id: 'fact-db-1', createdAt: '2026-06-17T12:00:01.000Z' })),
  guardarComprobante: vi.fn(async () => ({ id: 'comp-db-1', facturaId: 'fact-db-1', createdAt: '2026-06-17T12:00:02.000Z' })),
});

const buildAudit = () => ({
  registrarEmisionSimulada: vi.fn(async () => ({ id: 'evt-1', createdAt: '2026-06-17T12:00:03.000Z' })),
  registrarIntentoBloqueado: vi.fn(async () => ({ id: 'evt-2', createdAt: '2026-06-17T12:00:04.000Z' })),
  registrarRechazoValidacion: vi.fn(async () => ({ id: 'evt-3', createdAt: '2026-06-17T12:00:05.000Z' })),
});

describe('emitirFacturaBManual', () => {
  it('emite Factura B manual exitosa', async () => {
    const persistence = buildPersistence();
    const audit = buildAudit();
    const result = await emitirFacturaBManual(
      {
        cliente: clienteEmpresa,
        items: [
          {
            concepto: 'Producto demo',
            cantidad: 2,
            unidadMedida: 'UN',
            precioUnitario: 100,
            alicuotaIva: 0.21,
          },
        ],
        source: { entidad: 'demo', entidadId: 'demo-1' },
        observaciones: 'Prueba demo',
      },
      {
        provider: new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() }),
        config: ARCA_CONFIG,
        persistence,
        audit,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.facturaId).toBeDefined();
    expect(result.comprobanteNumero).toBe('SIM-B-00001');
    expect(result.total).toBe(242);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(persistence.guardarFactura).toHaveBeenCalledTimes(1);
    expect(persistence.guardarComprobante).toHaveBeenCalledTimes(1);
    expect(audit.registrarEmisionSimulada).toHaveBeenCalledTimes(1);
  });

  it('acumula warnings de cliente fiscal incompleto', async () => {
    const result = await emitirFacturaBManual(
      {
        cliente: clienteSinDatos,
        items: [
          {
            concepto: 'Producto demo',
            cantidad: 1,
            precioUnitario: 100,
            alicuotaIva: 0.21,
          },
        ],
      },
      {
        provider: new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() }),
        config: ARCA_CONFIG,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'El cliente no tiene CUIT informado; se aplicaron defaults fiscales seguros.',
      'No se pudo inferir un numero de documento fiscal valido; se uso S/D.',
      'No se pudo inferir domicilio fiscal; se dejo sin informar.',
    ]));
  });

  it('falla con items invalidos', async () => {
    const result = await emitirFacturaBManual(
      {
        cliente: clienteEmpresa,
        items: [
          {
            concepto: '',
            cantidad: 0,
            precioUnitario: -1,
          },
        ],
      },
      {
        provider: new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() }),
        config: ARCA_CONFIG,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('no permite cambiar modalidad a A o Mixta', async () => {
    const result = await emitirFacturaBManual(
      {
        cliente: clienteEmpresa,
        items: [
          {
            concepto: 'Producto demo',
            cantidad: 1,
            precioUnitario: 100,
            alicuotaIva: 0.21,
          },
        ],
        modalidad: 'FACTURA_A',
      },
      {
        provider: new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() }),
        config: ARCA_CONFIG,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['Solo se permite FACTURA_B para este flujo manual.']);
  });

  it('funciona sin deps de persistencia', async () => {
    const result = await emitirFacturaBManual(
      {
        cliente: clienteEmpresa,
        items: [
          {
            concepto: 'Producto demo',
            cantidad: 1,
            precioUnitario: 100,
            alicuotaIva: 0.21,
          },
        ],
      },
      {
        provider: new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() }),
        config: ARCA_CONFIG,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.facturaId).toBeDefined();
  });

  it('funciona con deps mock de persistencia y auditoria', async () => {
    const persistence = buildPersistence();
    const audit = buildAudit();
    const result = await emitirFacturaBManual(
      {
        cliente: clienteEmpresa,
        items: [
          {
            concepto: 'Producto demo',
            cantidad: 1,
            precioUnitario: 100,
          },
        ],
        source: { entidad: 'finanza', entidadId: 'fin-1' },
      },
      {
        provider: new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() }),
        config: ARCA_CONFIG,
        persistence,
        audit,
      },
    );

    expect(result.ok).toBe(true);
    expect(persistence.guardarFactura).toHaveBeenCalledTimes(1);
    expect(persistence.guardarComprobante).toHaveBeenCalledTimes(1);
    expect(audit.registrarEmisionSimulada).toHaveBeenCalledTimes(1);
  });
});
