import { describe, expect, it } from 'vitest';
import { normalizeCantidadOrden } from './cantidad';

describe('normalizeCantidadOrden', () => {
  it('convierte kg sin cambiar el valor', () => {
    expect(normalizeCantidadOrden(25, 'kg')).toEqual({
      cantidadOriginal: 25,
      unidad: 'kg',
      cantidadKg: 25,
    });
  });

  it('convierte toneladas a kg', () => {
    expect(normalizeCantidadOrden(1.5, 'tn')).toEqual({
      cantidadOriginal: 1.5,
      unidad: 'tonelada',
      cantidadKg: 1500,
    });
  });

  it('rechaza valores inválidos', () => {
    expect(() => normalizeCantidadOrden('abc', 'kg')).toThrow('La cantidad debe ser mayor a 0.');
    expect(() => normalizeCantidadOrden(-1, 'kg')).toThrow('La cantidad debe ser mayor a 0.');
    expect(() => normalizeCantidadOrden(1, 'bolsa')).toThrow('La unidad de medida debe ser kg o tn.');
  });

  it('rechaza cantidades vacías', () => {
    expect(() => normalizeCantidadOrden('', 'kg')).toThrow('La cantidad debe ser mayor a 0.');
  });
});
