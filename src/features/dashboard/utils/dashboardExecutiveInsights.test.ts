import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import { buildDashboardExecutiveInsights, filterMovimientosPTByPeriodo } from './dashboardExecutiveInsights';

describe('dashboardExecutiveInsights', () => {
  const clientes: Cliente[] = [
    { uid: 'cli-001', nombre: 'Estancia La Esperanza', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true },
    { uid: 'cli-002', nombre: 'Agropecuaria Don Sergio', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true },
  ];

  const movimientos: MovimientoStockPT[] = [
    {
      id: 'm-1',
      stock_pt_id: 'pt-1',
      producto_id: 'prod-a',
      nombre_producto: 'Núcleo Inicio',
      lote: 'PT-1',
      numero_orden: 'OP-1',
      silo: 'S1',
      tipo: 'SALIDA',
      cantidad: 20,
      unidad: 'KG',
      costo_unitario: 120,
      valor_total: 2400,
      motivo: 'Venta',
      referencia: 'R-1',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
      created_at: '2026-06-18T10:00:00Z',
    },
    {
      id: 'm-2',
      stock_pt_id: 'pt-2',
      producto_id: 'prod-b',
      nombre_producto: 'Pellet Crecimiento',
      lote: 'PT-2',
      numero_orden: 'OP-2',
      silo: 'S2',
      tipo: 'SALIDA',
      cantidad: 40,
      unidad: 'KG',
      costo_unitario: 150,
      valor_total: 6000,
      motivo: 'Venta',
      referencia: 'R-2',
      cliente_id: 'cli-002',
      cliente_nombre: 'Agropecuaria Don Sergio',
      created_at: '2026-06-18T12:00:00Z',
    },
    {
      id: 'm-3',
      stock_pt_id: 'pt-3',
      producto_id: 'prod-a',
      nombre_producto: 'Núcleo Inicio',
      lote: 'PT-3',
      numero_orden: 'OP-1',
      silo: 'S1',
      tipo: 'SALIDA',
      cantidad: 10,
      unidad: 'KG',
      costo_unitario: 120,
      valor_total: 1200,
      motivo: 'Venta',
      referencia: 'R-3',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
      created_at: '2026-05-18T09:00:00Z',
    },
  ];

  it('filtra por período', () => {
    const out = filterMovimientosPTByPeriodo(movimientos, 'HOY', new Date('2026-06-18T13:00:00Z'));
    expect(out).toHaveLength(2);
  });

  it('construye insights ejecutivos por período', () => {
    const insights = buildDashboardExecutiveInsights(movimientos, clientes, 'MES', new Date('2026-06-18T13:00:00Z'));

    expect(insights.ventasPorProducto[0]).toMatchObject({
      producto_nombre: 'Pellet Crecimiento',
      kg: 40,
      importe: 6000,
    });
    expect(insights.kgDespachadosPorProducto[0]).toMatchObject({
      producto_nombre: 'Pellet Crecimiento',
      kg: 40,
    });
    expect(insights.clientesAtendidos).toBe(2);
    expect(insights.topClientesPorVolumen[0]).toMatchObject({
      cliente_nombre: 'Agropecuaria Don Sergio',
      kg: 40,
    });
    expect(insights.totalKgDespachados).toBe(60);
    expect(insights.totalImporte).toBe(8400);
  });
});
