import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../../clientes/types/cliente';
import { ARCA_CONFIG, mapClienteToClienteFiscal, validarFactura } from '../../index';

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

const clienteConsumidorFinal: Cliente = {
  uid: 'cli-consumidor-1',
  nombre: 'Consumidor final',
  telefono: '11-1111-1111',
  estado: 'Activo',
  saldoPendienteArs: 0,
  estaActivo: true,
};

const clienteSinDatosFiscales: Cliente = {
  uid: 'cli-sin-datos',
  nombre: 'Cliente Generico',
  estado: 'Activo',
  saldoPendienteArs: 0,
  estaActivo: true,
};

describe('clienteFiscalMapper', () => {
  it('mapea cliente consumidor final', () => {
    const result = mapClienteToClienteFiscal(clienteConsumidorFinal);

    expect(result.clienteFiscal.tipoDocumento).toBe('DNI');
    expect(result.clienteFiscal.condicionIva).toBe('CONSUMIDOR_FINAL');
    expect(result.clienteFiscal.nombre).toBe('Consumidor final');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('mapea cliente empresa con CUIT', () => {
    const result = mapClienteToClienteFiscal(clienteEmpresa);

    expect(result.clienteFiscal.tipoDocumento).toBe('CUIT');
    expect(result.clienteFiscal.numeroDocumento).toBe('30-12345678-9');
    expect(result.clienteFiscal.condicionIva).toBe('RESPONSABLE_INSCRIPTO');
    expect(result.clienteFiscal.email).toBe('facturacion@ferreteria.com');
  });

  it('mapea cliente sin datos fiscales completos con defaults seguros', () => {
    const result = mapClienteToClienteFiscal(clienteSinDatosFiscales);

    expect(result.clienteFiscal.tipoDocumento).toBe('DNI');
    expect(result.clienteFiscal.numeroDocumento).toBe('S/D');
    expect(result.clienteFiscal.condicionIva).toBe('CONSUMIDOR_FINAL');
    expect(result.complete).toBe(false);
    expect(result.warnings).toContain('El cliente no tiene CUIT informado; se aplicaron defaults fiscales seguros.');
  });

  it('mapea email y domicilio fiscal cuando existen', () => {
    const result = mapClienteToClienteFiscal(clienteEmpresa);

    expect(result.clienteFiscal.email).toBe('facturacion@ferreteria.com');
    expect(result.clienteFiscal.domicilioFiscal).toBe('Av. Siempre Viva 123');
    expect(result.clienteFiscal.provincia).toBe('Buenos Aires');
  });

  it('mantiene compatibilidad con la validacion de Factura B simulada', () => {
    const { clienteFiscal } = mapClienteToClienteFiscal(clienteEmpresa);

    const validation = validarFactura(
      {
        modalidad: 'FACTURA_B',
        cliente: clienteFiscal,
        moneda: 'ARS',
        items: [
          {
            concepto: 'Producto',
            cantidad: 1,
            unidadMedida: 'UN',
            precioUnitario: 100,
          },
        ],
      },
      ARCA_CONFIG,
    );

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});
