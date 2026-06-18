import { describe, expect, it } from 'vitest';
import { formatSimulatedComprobanteNumero, roundMoney } from './facturaB';

describe('facturaB utils', () => {
  it('redondea importes a 2 decimales', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.674)).toBe(2.67);
  });

  it('formatea el numero de comprobante simulado', () => {
    expect(formatSimulatedComprobanteNumero(1)).toBe('SIM-B-00001');
    expect(formatSimulatedComprobanteNumero(2)).toBe('SIM-B-00002');
  });
});
