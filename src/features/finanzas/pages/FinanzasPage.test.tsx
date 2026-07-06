import { describe, expect, it } from 'vitest';
import type { MovimientoFinanciero } from '../types';
import { movimientoMatchesSearch, sortMovimientosByRegistroDesc } from './FinanzasPage';

const movimiento = (overrides: Partial<MovimientoFinanciero>): MovimientoFinanciero => ({
  uid: 'mov-base',
  fecha: '2026-01-01T00:00:00Z',
  tipo: 'INGRESO',
  descripcion: 'Movimiento base',
  monto: 100,
  estado: 'CONFIRMADO',
  ...overrides,
});

describe('FinanzasPage movimientos financieros', () => {
  it('ordena los ultimos movimientos por created_at aunque la fecha operativa sea antigua', () => {
    const rows = [
      movimiento({
        uid: 'factura-reciente',
        fecha: '2026-07-05T00:00:00Z',
        created_at: '2026-07-05T10:00:00Z',
        descripcion: 'Factura reciente',
      }),
      movimiento({
        uid: 'pago-compra-antigua',
        fecha: '2026-06-01T00:00:00Z',
        created_at: '2026-07-06T09:00:00Z',
        tipo: 'EGRESO',
        descripcion: 'Pago de compra antigua',
      }),
    ];

    expect([...rows].sort(sortMovimientosByRegistroDesc).map((row) => row.uid)).toEqual([
      'pago-compra-antigua',
      'factura-reciente',
    ]);
  });

  it('usa fecha como fallback cuando no existe created_at', () => {
    const rows = [
      movimiento({ uid: 'junio', fecha: '2026-06-01T00:00:00Z' }),
      movimiento({ uid: 'julio', fecha: '2026-07-06T00:00:00Z' }),
    ];

    expect([...rows].sort(sortMovimientosByRegistroDesc)[0].uid).toBe('julio');
  });

  it('busca por texto amplio en historial', () => {
    const row = movimiento({
      descripcion: 'Pago proveedor',
      categoria: 'Energía',
      tipo: 'EGRESO',
      origen_operativo: 'PAGO',
      cliente: 'Jorge Alvarez',
      proveedor: 'Servicios Pampeanos',
      tercero: 'Jorge Alvarez',
      comprobante: 'FC-2026-001',
      referencia: 'EXP-2026-69',
      monto: 570000,
      metadata: {
        metodo_pago: 'transferencia',
        referencia: 'EXP-2026-69',
      },
    });

    expect(movimientoMatchesSearch(row, 'Jorge')).toBe(true);
    expect(movimientoMatchesSearch(row, 'pago')).toBe(true);
    expect(movimientoMatchesSearch(row, 'EXP-2026-69')).toBe(true);
    expect(movimientoMatchesSearch(row, 'energia')).toBe(true);
    expect(movimientoMatchesSearch(row, '570000')).toBe(true);
  });
});
