import { describe, expect, it } from 'vitest';
import { ControlEstado, type MovimientoStockPT, type StockProductoTerminado } from '../types';
import { buildStockPTResumen } from './stockPtResumen';

describe('buildStockPTResumen', () => {
  it('consolida por producto y calcula estado y valor', () => {
    const stock: StockProductoTerminado[] = [
      {
        uid: 'pt-a',
        id_orden: 'op-1',
        numero_orden: 'OP-000001',
        id_formula: 'form-a',
        version_formula: 1,
        nombre_producto: 'Producto A',
        cantidad_total: 80,
        cantidad_inicial: 100,
        costo_unitario_estimado: 10,
        lote: 'L-1',
        unidad_medida: 'KG',
        estado: ControlEstado.BAJO,
        id_silo: 's-1',
        nombre_silo: 'Silo 1',
        detalle_insumos: [],
        fecha_ingreso: '2026-06-16T10:00:00Z',
        usuario: 'Usuario',
        updateAt: '2026-06-16T11:00:00Z',
      },
      {
        uid: 'pt-b',
        id_orden: 'op-2',
        numero_orden: 'OP-000002',
        id_formula: 'form-a',
        version_formula: 1,
        nombre_producto: 'Producto A',
        cantidad_total: 10,
        cantidad_inicial: 100,
        costo_unitario_estimado: 10,
        lote: 'L-2',
        unidad_medida: 'KG',
        estado: ControlEstado.CRITICO,
        id_silo: 's-1',
        nombre_silo: 'Silo 1',
        detalle_insumos: [],
        fecha_ingreso: '2026-06-16T12:00:00Z',
        usuario: 'Usuario',
        updateAt: '2026-06-16T12:30:00Z',
      },
    ];

    const movimientos: MovimientoStockPT[] = [
      {
        id: 'm-1',
        stock_pt_id: 'pt-a',
        producto_id: 'form-a',
        nombre_producto: 'Producto A',
        lote: 'L-1',
        numero_orden: 'OP-000001',
        silo: 'Silo 1',
        tipo: 'INGRESO',
        cantidad: 80,
        unidad: 'KG',
        costo_unitario: 10,
        valor_total: 800,
        motivo: 'Ingreso',
        referencia: 'OP-000001',
        created_at: '2026-06-16T11:00:00Z',
      },
    ];

    const resumen = buildStockPTResumen(stock, movimientos);
    expect(resumen).toHaveLength(1);
    expect(resumen[0]).toMatchObject({
      nombre_producto: 'Producto A',
      stock_actual: 90,
      valor_monetario: 900,
      estado: ControlEstado.CRITICO,
      cantidad_lotes: 2,
      numero_orden: 'OP-000002',
      id_formula: 'form-a',
      version_formula: 1,
    });
  });
});
