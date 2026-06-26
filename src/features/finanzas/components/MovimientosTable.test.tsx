import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovimientosTable } from './MovimientosTable';

const rows = [
  { uid: 'm-1', fecha: '2026-06-18T00:00:00Z', tipo: 'INGRESO', descripcion: 'Alta', monto: 100, estado: 'CONFIRMADO', categoria: 'Ventas' },
];

describe('MovimientosTable', () => {
  it('renderiza una tabla válida sin div dentro de table', () => {
    const html = renderToStaticMarkup(<MovimientosTable movimientos={rows as never} />);
    expect(html).not.toContain('<table><div');
    expect(html).not.toContain('<tbody><div');
  });
});
