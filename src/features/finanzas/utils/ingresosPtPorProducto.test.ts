import { describe, expect, it } from 'vitest';
import type { MovimientoStockPT } from '../../productos/types';
import { buildIngresosPtPorProducto } from './ingresosPtPorProducto';

describe('buildIngresosPtPorProducto', () => {
  it('agrega ventas de PT por producto usando monto financiero cuando existe y estimado cuando no', () => {
    const movimientos: MovimientoStockPT[] = [
      {
        id: 'mov-1',
        stock_pt_id: 'pt-1',
        producto_id: 'form-1',
        nombre_producto: 'Pellet Crecimiento',
        lote: 'L1',
        numero_orden: 'OP-1',
        silo: 'Silo 1',
        tipo: 'SALIDA',
        cantidad: 60,
        unidad: 'KG',
        costo_unitario: 360,
        valor_total: 21600,
        motivo: 'Salida',
        referencia: 'R1',
        cliente_id: 'cli-1',
        created_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'mov-2',
        stock_pt_id: 'pt-2',
        producto_id: 'form-2',
        nombre_producto: 'Nucleo Inicio',
        lote: 'L2',
        numero_orden: 'OP-2',
        silo: 'Silo 2',
        tipo: 'DESPACHO_PT' as MovimientoStockPT['tipo'],
        cantidad: 55,
        unidad: 'KG',
        costo_unitario: 400,
        valor_total: 22000,
        motivo: 'Salida',
        referencia: 'R2',
        cliente_id: 'cli-1',
        created_at: '2026-06-02T10:00:00Z',
      },
      {
        id: 'mov-3',
        stock_pt_id: 'pt-2',
        producto_id: 'form-2',
        nombre_producto: 'Nucleo Inicio',
        lote: 'L2',
        numero_orden: 'OP-2',
        silo: 'Silo 2',
        tipo: 'SALIDA',
        cantidad: 10,
        unidad: 'KG',
        costo_unitario: 400,
        valor_total: 4000,
        motivo: 'Salida',
        referencia: 'R3',
        cliente_id: 'cli-2',
        created_at: '2026-06-03T10:00:00Z',
      },
      {
        id: 'mov-4',
        stock_pt_id: 'pt-3',
        producto_id: 'form-3',
        nombre_producto: 'Recria Balance',
        lote: 'L3',
        numero_orden: 'OP-3',
        silo: 'Silo 3',
        tipo: 'SALIDA',
        cantidad: 35,
        unidad: 'KG',
        costo_unitario: 340,
        valor_total: 11900,
        motivo: 'Salida',
        referencia: 'R4',
        cliente_id: null,
        created_at: '2026-06-04T10:00:00Z',
      },
    ];

    const ingresosFinancieros = [
      { stock_pt_id: 'pt-1', monto: 25000, fecha: '2026-06-01T12:00:00Z' },
      { stock_pt_id: 'pt-2', monto: 22000, fecha: '2026-06-03T12:00:00Z' },
    ];

    const rows = buildIngresosPtPorProducto(movimientos, ingresosFinancieros);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      producto: 'Pellet Crecimiento',
      cantidad_kg: 60,
      importe_total: 25000,
      clientes_count: 1,
    });
    expect(rows[1]).toMatchObject({
      producto: 'Nucleo Inicio',
      cantidad_kg: 65,
      importe_total: 22000,
      clientes_count: 2,
    });
    expect(rows[2]).toMatchObject({
      producto: 'Recria Balance',
      cantidad_kg: 35,
      importe_total: 11900,
      clientes_count: 0,
    });
    expect(rows[1].ultima_fecha).toBe('2026-06-03T12:00:00Z');
  });
});
