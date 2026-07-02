import { describe, expect, it } from 'vitest';
import type { AlertaOperativa } from '../../alertas/types/alerta';
import { EstadoOrden, type OrdenProduccion } from '../../ordenes/types';
import type { MovimientoStockPT } from '../../productos/types';
import { buildDashboardTemporalInsights, filterAlertasByPeriodo } from './dashboardTemporalInsights';

describe('dashboardTemporalInsights', () => {
  const now = new Date('2026-06-18T12:00:00Z');

  const ordenes: OrdenProduccion[] = [
    {
      id: 'op-1',
      lote: 'OP-1',
      numero_orden: 'OP-1',
      id_formula: 'form-1',
      nombre_producto: 'Producto A',
      version_formula: 1,
      usuario_responsable: 'Operador',
      estado: EstadoOrden.FINALIZADO,
      fecha_creacion: '2026-06-18T08:00:00Z',
      cantidad_objetivo: 100,
      cantidad_real: 95,
      costo_total_insumos: 120,
      merma_manual: 0,
      id_silo: null,
      destino_silo: null,
      detalle_insumos: [],
    } as OrdenProduccion,
    {
      id: 'op-2',
      lote: 'OP-2',
      numero_orden: 'OP-2',
      id_formula: 'form-1',
      nombre_producto: 'Producto A',
      version_formula: 1,
      usuario_responsable: 'Operador',
      estado: EstadoOrden.FINALIZADO,
      fecha_creacion: '2026-06-15T08:00:00Z',
      cantidad_objetivo: 100,
      cantidad_real: 96,
      costo_total_insumos: 80,
      merma_manual: 0,
      id_silo: null,
      destino_silo: null,
      detalle_insumos: [],
    } as OrdenProduccion,
    {
      id: 'op-3',
      lote: 'OP-3',
      numero_orden: 'OP-3',
      id_formula: 'form-1',
      nombre_producto: 'Producto A',
      version_formula: 1,
      usuario_responsable: 'Operador',
      estado: EstadoOrden.FINALIZADO,
      fecha_creacion: '2026-06-05T08:00:00Z',
      cantidad_objetivo: 100,
      cantidad_real: 94,
      costo_total_insumos: 300,
      merma_manual: 0,
      id_silo: null,
      destino_silo: null,
      detalle_insumos: [],
    } as OrdenProduccion,
  ];

  const movimientosPT: MovimientoStockPT[] = [
    {
      id: 'm-1',
      stock_pt_id: 'pt-1',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote: 'PT-1',
      numero_orden: 'OP-1',
      silo: 'S1',
      tipo: 'SALIDA',
      cantidad: 10,
      unidad: 'KG',
      costo_unitario: 9,
      valor_total: 90,
      motivo: 'Venta',
      referencia: 'R-1',
      cliente_id: 'cli-1',
      cliente_nombre: 'Cliente 1',
      created_at: '2026-06-18T09:00:00Z',
    },
    {
      id: 'm-2',
      stock_pt_id: 'pt-2',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote: 'PT-2',
      numero_orden: 'OP-2',
      silo: 'S1',
      tipo: 'SALIDA',
      cantidad: 20,
      unidad: 'KG',
      costo_unitario: 11,
      valor_total: 220,
      motivo: 'Venta',
      referencia: 'R-2',
      cliente_id: 'cli-2',
      cliente_nombre: 'Cliente 2',
      created_at: '2026-06-15T09:00:00Z',
    },
    {
      id: 'm-3',
      stock_pt_id: 'pt-3',
      producto_id: 'prod-a',
      nombre_producto: 'Producto A',
      lote: 'PT-3',
      numero_orden: 'OP-3',
      silo: 'S1',
      tipo: 'SALIDA',
      cantidad: 30,
      unidad: 'KG',
      costo_unitario: 12,
      valor_total: 360,
      motivo: 'Venta',
      referencia: 'R-3',
      cliente_id: 'cli-3',
      cliente_nombre: 'Cliente 3',
      created_at: '2026-06-05T09:00:00Z',
    },
  ];

  const alertas: AlertaOperativa[] = [
    {
      id: 'a-1',
      titulo: 'Alerta 1',
      descripcion: 'x',
      prioridad: 'critica',
      area: 'stock',
      estado: 'pendiente',
      fechaEvento: '2026-06-18T07:00:00Z',
      fechaRelativa: 'Hace 5 min',
      datoAsociado: {},
      accionRecomendada: 'Revisar',
      impactoOperativo: 'Impacto',
    },
    {
      id: 'a-2',
      titulo: 'Alerta 2',
      descripcion: 'x',
      prioridad: 'media',
      area: 'costos',
      estado: 'pendiente',
      fechaEvento: '2026-06-15T07:00:00Z',
      fechaRelativa: 'Hace 3 d',
      datoAsociado: {},
      accionRecomendada: 'Revisar',
      impactoOperativo: 'Impacto',
    },
    {
      id: 'a-3',
      titulo: 'Alerta 3',
      descripcion: 'x',
      prioridad: 'informativa',
      area: 'tesoreria',
      estado: 'pendiente',
      fechaEvento: '2026-06-05T07:00:00Z',
      fechaRelativa: 'Hace 10 d',
      datoAsociado: {},
      accionRecomendada: 'Revisar',
      impactoOperativo: 'Impacto',
    },
  ];

  it('recalcula costos, ingresos, flujo y alertas por período', () => {
    const hoy = buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, 'HOY', now);
    const semana = buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, 'SEMANA', now);
    const mes = buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, 'MES', now);

    expect(hoy.costos).toBe(120);
    expect(semana.costos).toBe(200);
    expect(mes.costos).toBe(500);
    expect(hoy.ingresos).toBe(90);
    expect(semana.ingresos).toBe(310);
    expect(mes.ingresos).toBe(670);
    expect(hoy.flujoCaja).toBe(-30);
    expect(semana.flujoCaja).toBe(110);
    expect(mes.flujoCaja).toBe(170);
    expect(hoy.alertas).toHaveLength(1);
    expect(semana.alertas).toHaveLength(2);
    expect(mes.alertas).toHaveLength(3);
  });

  it('filtra alertas con fecha real', () => {
    expect(filterAlertasByPeriodo(alertas, 'HOY', now)).toHaveLength(1);
    expect(filterAlertasByPeriodo(alertas, 'SEMANA', now)).toHaveLength(2);
    expect(filterAlertasByPeriodo(alertas, 'MES', now)).toHaveLength(3);
  });

  it('diferencia entre flujo de caja real y proyectado', () => {
    const movimientosFlujo = [
      { fecha: '2026-06-18T10:00:00Z', tipo: 'INGRESO', monto: 1000, estado: 'CONFIRMADO', estado_financiero: 'COBRADO', deleted_at: null },
      { fecha: '2026-06-18T11:00:00Z', tipo: 'EGRESO', monto: 300, estado: 'CONFIRMADO', estado_financiero: 'PAGADO', deleted_at: null },
      { fecha: '2026-06-18T12:00:00Z', tipo: 'INGRESO', monto: 500, estado: 'PENDIENTE', estado_financiero: 'PENDIENTE_COBRO', fecha_vencimiento: '2026-06-18T15:00:00Z', deleted_at: null },
      { fecha: '2026-06-18T12:00:00Z', tipo: 'EGRESO', monto: 200, estado: 'PENDIENTE', estado_financiero: 'PENDIENTE_PAGO', fecha_vencimiento: '2026-06-18T16:00:00Z', deleted_at: null },
      { fecha: '2026-06-15T12:00:00Z', tipo: 'INGRESO', monto: 150, estado: 'PENDIENTE', estado_financiero: 'PENDIENTE_COBRO', fecha_vencimiento: '2026-06-15T15:00:00Z', deleted_at: null },
      // Confirmed but financial status is pending - should NOT affect real flow!
      { fecha: '2026-06-18T13:00:00Z', tipo: 'INGRESO', monto: 1500, estado: 'CONFIRMADO', estado_financiero: 'PENDIENTE_COBRO', fecha_vencimiento: '2026-06-18T20:00:00Z', deleted_at: null },
      { fecha: '2026-06-18T14:00:00Z', tipo: 'EGRESO', monto: 15000, estado: 'CONFIRMADO', estado_financiero: 'PENDIENTE_PAGO', fecha_vencimiento: '2026-06-18T20:00:00Z', deleted_at: null },
    ];

    const comprobantes = [
      { tipo: 'FACTURA_VENTA', total: 600, saldo: 600, estado_financiero: 'PENDIENTE_COBRO', fecha_vencimiento: '2026-06-18T17:00:00Z', deleted_at: null }
    ];

    const result = buildDashboardTemporalInsights(
      [],
      [],
      [],
      'HOY',
      now,
      movimientosFlujo,
      comprobantes,
      [],
      []
    );

    expect(result.ingresosReales).toBe(1000);
    expect(result.egresosReales).toBe(300);
    expect(result.flujoReal).toBe(700);

    expect(result.ingresosProyectados).toBe(2600); // 500 + 1500 + 600
    expect(result.egresosProyectados).toBe(15200); // 200 + 15000
    expect(result.flujoProyectado).toBe(-12600);

    expect(result.vencidosCobrar).toBe(150);
    expect(result.vencidosPagar).toBe(0);
  });
});
