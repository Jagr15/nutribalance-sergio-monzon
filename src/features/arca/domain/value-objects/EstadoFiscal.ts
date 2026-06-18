export type EstadoFiscal =
  | 'BORRADOR'
  | 'VALIDANDO'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'ANULADA'
  | 'PENDIENTE_CREDENCIALES'
  | 'NO_HABILITADA';

export const ESTADOS_FISCALES: readonly EstadoFiscal[] = [
  'BORRADOR',
  'VALIDANDO',
  'ACEPTADA',
  'RECHAZADA',
  'ANULADA',
  'PENDIENTE_CREDENCIALES',
  'NO_HABILITADA',
];
