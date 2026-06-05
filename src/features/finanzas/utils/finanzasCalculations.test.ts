import { describe, expect, it } from 'vitest';
import { calcFlujoNeto, calcMargenOperativo, normalizeKpis } from './finanzasCalculations';

describe('finanzas calculations', () => {
  it('calcula flujo neto', () => {
    expect(calcFlujoNeto(1000, 700)).toBe(300);
  });

  it('calcula margen operativo', () => {
    expect(calcMargenOperativo(1000, 700)).toBeCloseTo(30, 6);
    expect(calcMargenOperativo(0, 100)).toBe(0);
  });

  it('normaliza kpis', () => {
    const k = normalizeKpis({ ingresos_mes: 1200, egresos_mes: 900 });
    expect(k.flujo_neto).toBe(300);
    expect(k.margen_operativo).toBeCloseTo(25, 6);
  });
});
