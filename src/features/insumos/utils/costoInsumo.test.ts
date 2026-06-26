import { describe, expect, it } from 'vitest';
import { normalizarCostoInsumo } from './costoInsumo';

describe('normalizarCostoInsumo', () => {
  it('convierte costo por kg sin cambios', () => {
    expect(normalizarCostoInsumo({ costo: 125, unidad_costo: 'KG' })).toEqual({
      costo: 125,
      unidad_costo: 'KG',
      costo_por_kg: 125,
      costo_por_tonelada: 125000,
    });
  });

  it('convierte costo por tonelada a costo por kg', () => {
    expect(normalizarCostoInsumo({ costo: 250000, unidad_costo: 'TON' })).toEqual({
      costo: 250000,
      unidad_costo: 'TON',
      costo_por_kg: 250,
      costo_por_tonelada: 250000,
    });
  });

  it('devuelve null con costo inválido', () => {
    expect(normalizarCostoInsumo({ costo: -1, unidad_costo: 'KG' })).toBeNull();
  });
});
