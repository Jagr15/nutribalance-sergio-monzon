import { describe, expect, it } from 'vitest';
import { calcularEmpaques } from './empaques';

describe('calcularEmpaques', () => {
  it('calcula bolsas de 15, 20, 25 y 40 kg', () => {
    expect(calcularEmpaques('EMPAQUES', 30, { tipo_empaque: 'BOLSA', capacidad_kg: 15 })).toMatchObject({ total_kg: 450 });
    expect(calcularEmpaques('EMPAQUES', 30, { tipo_empaque: 'BOLSA', capacidad_kg: 20 })).toMatchObject({ total_kg: 600 });
    expect(calcularEmpaques('EMPAQUES', 30, { tipo_empaque: 'BOLSA', capacidad_kg: 25 })).toMatchObject({ total_kg: 750 });
    expect(calcularEmpaques('EMPAQUES', 30, { tipo_empaque: 'BOLSA', capacidad_kg: 40 })).toMatchObject({ total_kg: 1200 });
  });

  it('calcula big bags de 500 y 1000 kg', () => {
    expect(calcularEmpaques('EMPAQUES', 2, { tipo_empaque: 'BIG_BAG', capacidad_kg: 500 })).toMatchObject({ total_kg: 1000 });
    expect(calcularEmpaques('EMPAQUES', 2, { tipo_empaque: 'BIG_BAG', capacidad_kg: 1000 })).toMatchObject({ total_kg: 2000 });
  });

  it('calcula desde kg', () => {
    expect(calcularEmpaques('KG', 750, { tipo_empaque: 'BOLSA', capacidad_kg: 25 })).toMatchObject({ cantidad_empaques: 30, total_kg: 750 });
    expect(calcularEmpaques('KG', 1000, { tipo_empaque: 'BIG_BAG', capacidad_kg: 500 })).toMatchObject({ cantidad_empaques: 2, total_kg: 1000 });
  });

  it('rechaza valores inválidos', () => {
    expect(() => calcularEmpaques('EMPAQUES', 0, { tipo_empaque: 'BOLSA', capacidad_kg: 25 })).toThrow();
    expect(() => calcularEmpaques('EMPAQUES', -1, { tipo_empaque: 'BOLSA', capacidad_kg: 25 })).toThrow();
    expect(() => calcularEmpaques('EMPAQUES', 1.5, { tipo_empaque: 'BOLSA', capacidad_kg: 25 })).toThrow();
  });

  it('calcula sobrantes', () => {
    expect(calcularEmpaques('KG', 760, { tipo_empaque: 'BOLSA', capacidad_kg: 25 })).toMatchObject({ cantidad_empaques: 31, total_kg: 775, sobrante_kg: 15 });
  });
});
