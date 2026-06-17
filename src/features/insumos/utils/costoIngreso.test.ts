import { describe, expect, it } from 'vitest';
import { calcularCostoIngresoMP } from './costoIngreso';

describe('calcularCostoIngresoMP', () => {
  it('calcula total cuando el precio viene por KG', () => {
    const result = calcularCostoIngresoMP({
      cantidad: 500,
      unidad_entrada: 'KG',
      precio_unitario: 120,
      unidad_precio: 'KG',
    });

    expect(result.cantidad_kg).toBe(500);
    expect(result.precio_unitario_kg).toBe(120);
    expect(result.costo_total).toBe(60000);
  });

  it('convierte precio por TON a KG antes de calcular el total', () => {
    const result = calcularCostoIngresoMP({
      cantidad: 2,
      unidad_entrada: 'TON',
      precio_unitario: 100000,
      unidad_precio: 'TON',
    });

    expect(result.cantidad_kg).toBe(2000);
    expect(result.precio_unitario_kg).toBe(100);
    expect(result.costo_total).toBe(200000);
  });
});
