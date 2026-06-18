import { describe, expect, it } from 'vitest';
import { ARCA_CONFIG, type ClienteFiscal, type EmitirFacturaInput, ArcaSimulationProvider } from '../../index';

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

describe('ArcaSimulationProvider', () => {
  it('simula una Factura B aceptada con numeros y totales calculados', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const result = await provider.emitirFactura(buildInput());

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('SIMULACION');
    expect(result.estadoFiscal).toBe('ACEPTADA');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(['Se aplicó la alícuota IVA por defecto en los items sin definición explícita.']);
    expect(result.factura?.numeroComprobante).toBe('SIM-B-00001');
    expect(result.factura?.totales).toEqual({
      subtotal: 210.02,
      iva: 23.1,
      total: 233.12,
    });
    expect(result.factura?.items[0]).toMatchObject({
      concepto: 'Producto A',
      subtotal: 10.02,
      iva: 2.1,
      total: 12.12,
      alicuotaIva: 0.21,
    });
    expect(result.factura?.items[1]).toMatchObject({
      concepto: 'Producto B',
      subtotal: 200,
      iva: 21,
      total: 221,
      alicuotaIva: 0.105,
    });
  });

  it('rechaza un cliente invalido', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const result = await provider.emitirFactura(
      buildInput({
        cliente: {
          ...baseClient,
          nombre: '',
          numeroDocumento: '',
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('RECHAZADA');
    expect(result.errors).toContain('El nombre del cliente es obligatorio.');
    expect(result.errors).toContain('El documento fiscal del cliente es obligatorio.');
  });

  it('rechaza un item invalido', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const result = await provider.emitirFactura(
      buildInput({
        items: [
          {
            concepto: 'Item invalido',
            cantidad: 0,
            unidadMedida: 'UN',
            precioUnitario: 100,
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('RECHAZADA');
    expect(result.errors).toContain('El item 1 debe tener una cantidad mayor a 0.');
  });

  it('bloquea Factura A sin romper la ejecucion', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const result = await provider.emitirFactura(
      buildInput({
        modalidad: 'FACTURA_A',
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('PENDIENTE_CREDENCIALES');
    expect(result.provider).toBe('SIMULACION');
    expect(result.errors).toEqual(['Factura A pendiente de credenciales/certificados.']);
  });

  it('bloquea Factura Mixta sin romper la ejecucion', async () => {
    const provider = new ArcaSimulationProvider(ARCA_CONFIG, { clock, idGenerator: createIdGenerator() });
    const result = await provider.emitirFactura(
      buildInput({
        modalidad: 'FACTURA_MIXTA',
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.estadoFiscal).toBe('PENDIENTE_CREDENCIALES');
    expect(result.provider).toBe('SIMULACION');
    expect(result.errors).toEqual(['Factura Mixta pendiente de credenciales/certificados.']);
  });
});
