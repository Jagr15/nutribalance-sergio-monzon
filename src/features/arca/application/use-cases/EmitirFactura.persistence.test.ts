import { describe, expect, it, vi } from 'vitest';
import { ARCA_CONFIG, type ClienteFiscal, type EmitirFacturaInput, ArcaSimulationProvider, emitirFactura } from '../../index';

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

const baseClient: ClienteFiscal = {
  id: 'cli-001',
  nombre: 'Cliente Fiscal SA',
  tipoDocumento: 'CUIT',
  numeroDocumento: '30-12345678-9',
  condicionIva: 'RESPONSABLE_INSCRIPTO',
};

const buildInput = (overrides: Partial<EmitirFacturaInput> = {}): EmitirFacturaInput => ({
  modalidad: 'FACTURA_B',
  cliente: baseClient,
  moneda: 'ARS',
  items: [
    {
      concepto: 'Producto A',
      cantidad: 1,
      unidadMedida: 'UN',
      precioUnitario: 10.015,
    },
    {
      concepto: 'Producto B',
      cantidad: 2,
      unidadMedida: 'UN',
      precioUnitario: 100,
      alicuotaIva: 0.105,
    },
  ],
  ...overrides,
});

const createAudit = () => ({
  registrarEmisionSimulada: vi.fn(async () => ({ id: 'evt-1', createdAt: '2026-06-17T12:00:01.000Z' })),
  registrarIntentoBloqueado: vi.fn(async () => ({ id: 'evt-2', createdAt: '2026-06-17T12:00:02.000Z' })),
  registrarRechazoValidacion: vi.fn(async () => ({ id: 'evt-3', createdAt: '2026-06-17T12:00:03.000Z' })),
});

const createPersistence = () => ({
  guardarFactura: vi.fn(async () => ({ id: 'fact-1', createdAt: '2026-06-17T12:00:01.000Z' })),
  guardarComprobante: vi.fn(async () => ({ id: 'comp-1', facturaId: 'fact-1', createdAt: '2026-06-17T12:00:02.000Z' })),
});

describe('emitirFactura con persistencia fiscal', () => {
  it('simula, guarda factura, guarda comprobante y audita la emision', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const persistence = createPersistence();
    const audit = createAudit();

    const result = await emitirFactura(buildInput(), {
      provider,
      config: ARCA_CONFIG,
      persistence,
      audit,
    });

    expect(result.ok).toBe(true);
    expect(result.estadoFiscal).toBe('ACEPTADA');
    expect(persistence.guardarFactura).toHaveBeenCalledTimes(1);
    expect(persistence.guardarComprobante).toHaveBeenCalledTimes(1);
    expect(persistence.guardarFactura).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMode: 'SIMULACION',
        estadoFiscal: 'ACEPTADA',
      }),
    );
    expect(persistence.guardarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        facturaId: 'fact-1',
        providerMode: 'SIMULACION',
      }),
    );
    expect(audit.registrarEmisionSimulada).toHaveBeenCalledTimes(1);
    expect(audit.registrarIntentoBloqueado).not.toHaveBeenCalled();
    expect(audit.registrarRechazoValidacion).not.toHaveBeenCalled();
  });

  it('registra intento bloqueado para Factura A', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const persistence = createPersistence();
    const audit = createAudit();

    const result = await emitirFactura(buildInput({ modalidad: 'FACTURA_A' }), {
      provider,
      config: ARCA_CONFIG,
      persistence,
      audit,
    });

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('PENDIENTE_CREDENCIALES');
    expect(persistence.guardarFactura).not.toHaveBeenCalled();
    expect(persistence.guardarComprobante).not.toHaveBeenCalled();
    expect(audit.registrarIntentoBloqueado).toHaveBeenCalledTimes(1);
    expect(audit.registrarEmisionSimulada).not.toHaveBeenCalled();
  });

  it('registra intento bloqueado para Factura Mixta', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const persistence = createPersistence();
    const audit = createAudit();

    const result = await emitirFactura(buildInput({ modalidad: 'FACTURA_MIXTA' }), {
      provider,
      config: ARCA_CONFIG,
      persistence,
      audit,
    });

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('PENDIENTE_CREDENCIALES');
    expect(persistence.guardarFactura).not.toHaveBeenCalled();
    expect(persistence.guardarComprobante).not.toHaveBeenCalled();
    expect(audit.registrarIntentoBloqueado).toHaveBeenCalledTimes(1);
  });

  it('registra rechazo de validacion para cliente invalido', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const persistence = createPersistence();
    const audit = createAudit();

    const result = await emitirFactura(
      buildInput({
        cliente: {
          ...baseClient,
          nombre: '',
          numeroDocumento: '',
        },
      }),
      {
        provider,
        config: ARCA_CONFIG,
        persistence,
        audit,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('RECHAZADA');
    expect(persistence.guardarFactura).not.toHaveBeenCalled();
    expect(audit.registrarRechazoValidacion).toHaveBeenCalledTimes(1);
  });
});
