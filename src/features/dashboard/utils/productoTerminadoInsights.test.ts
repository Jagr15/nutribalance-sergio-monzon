import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT, StockProductoTerminadoResumen } from '../../productos/types';
import { buildProductoTerminadoInsights } from './productoTerminadoInsights';

describe('buildProductoTerminadoInsights', () => {
  const clientes: Cliente[] = [
    {
      uid: 'cli-001',
      nombre: 'Estancia La Esperanza',
      estado: 'Activo',
      saldoPendienteArs: 0,
      estaActivo: true,
    },
  ];

  const resumen: StockProductoTerminadoResumen[] = [
    {
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      unidad: 'KG',
      stock_actual: 120,
      valor_monetario: 36000,
      estado: 'OK',
      cantidad_lotes: 2,
      ultima_actualizacion: '2026-06-18T10:00:00Z',
      numero_orden: 'OP-001',
      id_formula: 'form-a',
      version_formula: 1,
    },
    {
      producto_id: 'prod-b',
      nombre_producto: 'Producto B',
      unidad: 'KG',
      stock_actual: 80,
      valor_monetario: 24000,
      estado: 'BAJO',
      cantidad_lotes: 1,
      ultima_actualizacion: '2026-06-18T09:30:00Z',
      numero_orden: 'OP-002',
      id_formula: 'form-b',
      version_formula: 2,
    },
  ];

  const movimientos: MovimientoStockPT[] = [
    {
      id: 'm-1',
      stock_pt_id: 'pt-1',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote: 'L-1',
      numero_orden: 'OP-001',
      silo: 'Silo 1',
      tipo: 'SALIDA',
      cantidad: 30,
      unidad: 'KG',
      costo_unitario: 300,
      valor_total: 9000,
      motivo: 'Salida 1',
      referencia: 'REM-1',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
      created_at: '2026-06-18T10:30:00Z',
    },
    {
      id: 'm-2',
      stock_pt_id: 'pt-1',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote: 'L-1',
      numero_orden: 'OP-001',
      silo: 'Silo 1',
      tipo: 'SALIDA',
      cantidad: 20,
      unidad: 'KG',
      costo_unitario: 300,
      valor_total: 6000,
      motivo: 'Salida 2',
      referencia: 'REM-2',
      cliente_id: null,
      cliente_nombre: null,
      created_at: '2026-06-18T11:00:00Z',
    },
    {
      id: 'm-3',
      stock_pt_id: 'pt-2',
      producto_id: 'prod-b',
      nombre_producto: 'Producto B',
      lote: 'L-2',
      numero_orden: 'OP-002',
      silo: 'Silo 2',
      tipo: 'SALIDA',
      cantidad: 15,
      unidad: 'KG',
      costo_unitario: 280,
      valor_total: 4200,
      motivo: 'Salida 3',
      referencia: 'REM-3',
      cliente_id: null,
      cliente_nombre: null,
      created_at: '2026-06-18T09:45:00Z',
    },
  ];

  it('agrega salidas, participación y entregas por cliente', () => {
    const insights = buildProductoTerminadoInsights(resumen, movimientos, clientes);

    expect(insights.salidasPorProducto).toHaveLength(2);
    expect(insights.salidasPorProducto[0]).toMatchObject({
      producto_id: 'prod-a',
      kg_salidos: 50,
      cantidad_movimientos: 2,
    });
    expect(insights.participacionStock).toMatchObject([
      expect.objectContaining({ nombre_producto: 'Producto A', porcentaje: 60 }),
      expect.objectContaining({ nombre_producto: 'Producto B', porcentaje: 40 }),
    ]);
    expect(insights.entregasPorCliente[0]).toMatchObject({
      cliente_nombre: 'Sin cliente asociado',
      producto_nombre: 'Producto A',
      kg: 20,
    });
    expect(insights.entregasPorCliente[1]).toMatchObject({
      cliente_nombre: 'Estancia La Esperanza',
      producto_nombre: 'Producto A',
      kg: 30,
    });
  });
});
