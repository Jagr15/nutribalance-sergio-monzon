import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMovimientoResponsable, MovimientosTable } from './MovimientosTable';
import type { MovimientoFinanciero } from '../types';

const rows = [
  { uid: 'm-1', fecha: '2026-06-18T00:00:00Z', tipo: 'INGRESO', descripcion: 'Alta', monto: 100, estado: 'CONFIRMADO', categoria: 'Ventas', cliente: 'Jorge Cliente' },
];

describe('MovimientosTable', () => {
  it('renderiza una tabla válida sin div dentro de table', () => {
    const html = renderToStaticMarkup(<MovimientosTable movimientos={rows as never} />);
    expect(html).not.toContain('<table><div');
    expect(html).not.toContain('<tbody><div');
  });

  it('renderiza cliente/proveedor y permite ocultar estado financiero y acciones', () => {
    const html = renderToStaticMarkup(<MovimientosTable movimientos={rows as never} showEstadoFinanciero={false} showActions={false} />);

    expect(html).toContain('Cliente / Proveedor');
    expect(html).toContain('Jorge Cliente');
    expect(html).toContain('title="Jorge Cliente"');
    expect(html).not.toContain('Est. Fin.');
    expect(html).not.toContain('Acciones');
  });

  it('resuelve el responsable con prioridad cliente, proveedor, tercero y metadata', () => {
    expect(getMovimientoResponsable({ cliente: 'Jorge Cliente' } as MovimientoFinanciero)).toBe('Jorge Cliente');
    expect(getMovimientoResponsable({ proveedor: 'Proveedor Norte' } as MovimientoFinanciero)).toBe('Proveedor Norte');
    expect(getMovimientoResponsable({ tercero: 'Tercero Demo' } as MovimientoFinanciero)).toBe('Tercero Demo');
    expect(getMovimientoResponsable({ metadata: { comprobante: { tercero: 'Comprobante Sur' } } } as MovimientoFinanciero)).toBe('Comprobante Sur');
    expect(getMovimientoResponsable({} as MovimientoFinanciero)).toBe('-');
  });
});
