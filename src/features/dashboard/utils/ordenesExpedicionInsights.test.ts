import { describe, expect, it } from 'vitest';
import type { Cliente } from '../../clientes/types/cliente';
import type { OrdenExpedicion } from '../../ordenes/types';
import { buildOrdenesExpedicionInsights } from './ordenesExpedicionInsights';

describe('buildOrdenesExpedicionInsights', () => {
  const clientes: Cliente[] = [
    { uid: 'cli-001', nombre: 'Estancia La Esperanza', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true },
    { uid: 'cli-002', nombre: 'Agropecuaria Don Sergio', estado: 'Activo', saldoPendienteArs: 0, estaActivo: true },
  ];

  const expediciones: OrdenExpedicion[] = [
    {
      id: 'e-1',
      legacy_uid: 'exp-1',
      numero_expedicion: 'EXP-2026-000001',
      stock_pt_id: 'pt-1',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote_pt: 'L-1',
      cliente_id: 'cli-001',
      cliente_nombre: 'Estancia La Esperanza',
      presentacion: 'GRANEL',
      cantidad: 50,
      cantidad_original: 50,
      unidad_cantidad: 'kg',
      cantidad_kg: 50,
      estado: 'despachada',
      motivo: 'Venta',
      referencia: 'R-1',
      created_at: '2026-06-18T10:00:00Z',
      updated_at: '2026-06-18T10:00:00Z',
    },
    {
      id: 'e-2',
      legacy_uid: 'exp-2',
      numero_expedicion: 'EXP-2026-000002',
      stock_pt_id: 'pt-2',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote_pt: 'L-2',
      cliente_id: 'cli-002',
      cliente_nombre: 'Agropecuaria Don Sergio',
      presentacion: 'BIG_BAG',
      cantidad: 25,
      cantidad_original: 25,
      unidad_cantidad: 'kg',
      cantidad_kg: 25,
      estado: 'despachada',
      motivo: 'Venta',
      referencia: 'R-2',
      created_at: '2026-06-18T11:00:00Z',
      updated_at: '2026-06-18T11:00:00Z',
    },
    {
      id: 'e-3',
      legacy_uid: 'exp-3',
      numero_expedicion: 'EXP-2026-000003',
      stock_pt_id: 'pt-3',
      producto_id: 'prod-b',
      nombre_producto: 'Producto B',
      lote_pt: 'L-3',
      cliente_id: null,
      cliente_nombre: null,
      presentacion: 'BOLSA',
      cantidad: 10,
      cantidad_original: 10,
      unidad_cantidad: 'kg',
      cantidad_kg: 10,
      estado: 'cancelada',
      motivo: 'Cancelada',
      referencia: 'R-3',
      created_at: '2026-06-18T12:00:00Z',
      updated_at: '2026-06-18T12:00:00Z',
    },
  ];

  it('agrega métricas y lista de expedición por cliente', () => {
    const insights = buildOrdenesExpedicionInsights(expediciones, clientes);

    expect(insights.resumen.expediciones_registradas).toBe(2);
    expect(insights.resumen.kg_expedidos).toBe(75);
    expect(insights.resumen.clientes_atendidos).toBe(2);
    expect(insights.resumen.producto_mas_expedido).toBe('Producto A');
    expect(insights.porProducto[0]).toMatchObject({
      nombre_producto: 'Producto A',
      kg_expedidos: 75,
    });
    expect(insights.porCliente[0]).toMatchObject({
      cliente_nombre: 'Agropecuaria Don Sergio',
      presentacion: 'BIG_BAG',
    });
  });
});
