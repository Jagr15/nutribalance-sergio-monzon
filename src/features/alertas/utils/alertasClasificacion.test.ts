import { describe, expect, it } from 'vitest';
import type { AlertaOperativa } from '../types/alerta';
import { getAlertCategory, isFinancialAlert, isProductAlert } from './alertasClasificacion';

const buildAlert = (overrides: Partial<AlertaOperativa>): AlertaOperativa => ({
  id: 'a1',
  titulo: 'Alerta',
  descripcion: 'Descripción',
  prioridad: 'media',
  area: 'produccion',
  estado: 'pendiente',
  fechaEvento: new Date().toISOString(),
  fechaRelativa: 'hoy',
  datoAsociado: {},
  accionRecomendada: 'Revisar',
  impactoOperativo: 'Impacto',
  ...overrides,
});

describe('alertasClasificacion', () => {
  it('clasifica alertas financieras por área y contenido', () => {
    const alerta = buildAlert({ area: 'tesoreria', titulo: 'Cheque vencido' });
    expect(isFinancialAlert(alerta)).toBe(true);
    expect(isProductAlert(alerta)).toBe(false);
    expect(getAlertCategory(alerta)).toBe('financiera');
  });

  it('clasifica alertas de producción por área y contenido', () => {
    const alerta = buildAlert({ area: 'stock', titulo: 'Stock crítico' });
    expect(isProductAlert(alerta)).toBe(true);
    expect(isFinancialAlert(alerta)).toBe(false);
    expect(getAlertCategory(alerta)).toBe('produccion');
  });

  it('deja como general lo que no encaja claramente', () => {
    const alerta = buildAlert({ area: 'clientes', titulo: 'Seguimiento comercial' });
    expect(getAlertCategory(alerta)).toBe('general');
  });
});
