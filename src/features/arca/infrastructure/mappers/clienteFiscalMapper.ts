import type { Cliente } from '../../../clientes/types/cliente';
import type { ClienteFiscal, TipoDocumentoFiscal } from '../../domain/entities/ClienteFiscal';
import type { CondicionIva } from '../../domain/value-objects/CondicionIva';

export interface ClienteFiscalMappingResult {
  clienteFiscal: ClienteFiscal;
  warnings: string[];
  complete: boolean;
}

export interface MapClienteFiscalOptions {
  tipoDocumento?: TipoDocumentoFiscal;
  numeroDocumento?: string;
  condicionIva?: CondicionIva;
}

const normalize = (value: string | undefined): string => value?.trim() ?? '';

const hasText = (value: string | undefined): boolean => normalize(value).length > 0;

export const inferirTipoDocumentoFiscal = (
  cliente: Cliente,
  options: MapClienteFiscalOptions = {},
): TipoDocumentoFiscal => {
  if (options.tipoDocumento) return options.tipoDocumento;
  if (hasText(cliente.cuit)) return 'CUIT';
  if (!hasText(cliente.cuit) && !hasText(cliente.razonSocial)) return 'DNI';
  return 'CUIT';
};

export const inferirCondicionIvaCliente = (
  cliente: Cliente,
  options: MapClienteFiscalOptions = {},
): CondicionIva => {
  if (options.condicionIva) return options.condicionIva;
  if (!hasText(cliente.cuit) && !hasText(cliente.razonSocial)) return 'CONSUMIDOR_FINAL';
  if (hasText(cliente.cuit)) return 'RESPONSABLE_INSCRIPTO';
  return 'NO_CATEGORIZADO';
};

const inferirNumeroDocumento = (cliente: Cliente, tipoDocumento: TipoDocumentoFiscal, options: MapClienteFiscalOptions): string => {
  if (hasText(options.numeroDocumento)) return normalize(options.numeroDocumento);
  if (hasText(cliente.cuit)) return normalize(cliente.cuit);
  if (tipoDocumento === 'DNI') return 'S/D';
  return 'S/D';
};

const inferirDomicilioFiscal = (cliente: Cliente): string | undefined => {
  const domicilio = normalize(cliente.direccion);
  if (domicilio.length > 0) return domicilio;

  const partes = [cliente.ubicacion, cliente.localidad, cliente.provincia]
    .map((part) => normalize(part))
    .filter((part) => part.length > 0);

  return partes.length > 0 ? partes.join(', ') : undefined;
};

const buildWarnings = (cliente: Cliente, clienteFiscal: ClienteFiscal): string[] => {
  const warnings: string[] = [];

  if (!hasText(cliente.cuit)) {
    warnings.push('El cliente no tiene CUIT informado; se aplicaron defaults fiscales seguros.');
  }

  if (!hasText(clienteFiscal.numeroDocumento) || clienteFiscal.numeroDocumento === 'S/D') {
    warnings.push('No se pudo inferir un numero de documento fiscal valido; se uso S/D.');
  }

  if (!clienteFiscal.domicilioFiscal) {
    warnings.push('No se pudo inferir domicilio fiscal; se dejo sin informar.');
  }

  return warnings;
};

export const mapClienteToClienteFiscal = (
  cliente: Cliente,
  options: MapClienteFiscalOptions = {},
): ClienteFiscalMappingResult => {
  const tipoDocumento = inferirTipoDocumentoFiscal(cliente, options);
  const condicionIva = inferirCondicionIvaCliente(cliente, options);
  const numeroDocumento = inferirNumeroDocumento(cliente, tipoDocumento, options);
  const domicilioFiscal = inferirDomicilioFiscal(cliente);
  const clienteFiscal: ClienteFiscal = {
    id: cliente.uid,
    nombre: normalize(cliente.razonSocial) || normalize(cliente.nombre) || 'Cliente sin nombre',
    tipoDocumento,
    numeroDocumento,
    condicionIva,
    email: hasText(cliente.email) ? normalize(cliente.email) : undefined,
    domicilioFiscal,
    provincia: hasText(cliente.provincia) ? normalize(cliente.provincia) : undefined,
    codigoPostal: undefined,
  };

  const warnings = buildWarnings(cliente, clienteFiscal);
  const complete =
    hasText(clienteFiscal.nombre) &&
    hasText(clienteFiscal.numeroDocumento) &&
    hasText(clienteFiscal.domicilioFiscal) &&
    warnings.length === 0;

  return {
    clienteFiscal,
    warnings,
    complete,
  };
};
