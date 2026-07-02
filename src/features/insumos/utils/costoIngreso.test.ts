import { describe, expect, it } from 'vitest';
import { calcularCostoIngresoMP, resolverCostoIngresoMP } from './costoIngreso';

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

  it('usa costo manual cuando existe', () => {
    const result = resolverCostoIngresoMP({
      cantidad: 10,
      unidad_entrada: 'KG',
      costo_unitario: 25,
      costo_por_kg: 40,
    });

    expect(result.cantidad_kg).toBe(10);
    expect(result.costo_unitario).toBe(25);
    expect(result.costo_total).toBe(250);
    expect(result.fuente_costo).toBe('manual');
  });

  it('usa costo de referencia cuando no hay costo manual', () => {
    const result = resolverCostoIngresoMP({
      cantidad: 10,
      unidad_entrada: 'KG',
      costo_por_kg: 40,
      ref_costo_unitario: 35,
    });

    expect(result.cantidad_kg).toBe(10);
    expect(result.costo_unitario).toBe(40);
    expect(result.costo_total).toBe(400);
    expect(result.fuente_costo).toBe('referencia');
  });

  it('permite costo cero cuando no hay fuente', () => {
    const result = resolverCostoIngresoMP({
      cantidad: 10,
      unidad_entrada: 'KG',
    });

    expect(result.cantidad_kg).toBe(10);
    expect(result.costo_unitario).toBe(0);
    expect(result.costo_total).toBe(0);
    expect(result.fuente_costo).toBe('sin_costo');
  });
});
