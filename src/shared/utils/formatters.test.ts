import { describe, expect, it } from 'vitest';
import { formatDateDDMMYYYY, parseNumericInput, formatNumericInput } from './formatters';

describe('formatters', () => {
  it('formatea fechas como DD/MM/AAAA', () => {
    expect(formatDateDDMMYYYY('2026-06-26')).toBe('26/06/2026');
  });

  it('permite dejar vacío el input numérico', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(formatNumericInput(null)).toBe('');
  });

  it('convierte textos numéricos a número', () => {
    expect(parseNumericInput('0123')).toBe(123);
  });
});
