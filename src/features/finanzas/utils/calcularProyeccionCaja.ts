import { buildProyeccionCaja, type ProyeccionCajaInput, type ProyeccionCajaResult } from './proyeccionCaja';

/**
 * Calcula la proyección de caja mensual para un año determinado,
 * considerando plazos de cobranza y pago, saldo inicial y movimientos/cheques.
 */
export const calcularProyeccionCaja = (input: ProyeccionCajaInput): ProyeccionCajaResult => {
  return buildProyeccionCaja(input);
};
