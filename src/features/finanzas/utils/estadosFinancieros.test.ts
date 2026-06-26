import { describe, expect, it, vi } from 'vitest';
import { buildEstadosFinancieros } from './estadosFinancieros';

vi.useFakeTimers();
vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));

describe('estadosFinancieros', () => {
  it('construye estado de resultados y balance desde movimientos reales', () => {
    const result = buildEstadosFinancieros({
      periodo: 'TODO',
      movimientos: [
        { uid: '1', fecha: '2026-06-10T00:00:00Z', tipo: 'INGRESO', descripcion: 'Cobranza Costos', monto: 5000, origen_operativo: 'COBRANZA', origen_modulo: 'costos', origen_id: 'costo-001', estado: 'CONFIRMADO' },
        { uid: '2', fecha: '2026-06-11T00:00:00Z', tipo: 'EGRESO', descripcion: 'Egreso Costos', monto: 2000, origen_operativo: 'EGRESO_OPERATIVO', origen_modulo: 'costos', origen_id: 'costo-002', estado: 'CONFIRMADO' },
      ],
      kpis: {
        saldo_actual: 1000,
        ingresos_mes: 5000,
        egresos_mes: 2000,
        flujo_neto: 3000,
        margen_operativo: 60,
        costo_produccion: 0,
        valorizacion_inventario: 400,
        cuentas_por_pagar: 200,
        cuentas_por_cobrar: 300,
        perdida_merma: 0,
        valor_stock_mp: 100,
        valor_stock_pt: 300,
        valor_inventario_total: 400,
      },
      inventario: { valor_stock_mp: 100, valor_stock_pt: 300, valor_inventario_total: 400 },
      tesoreria: {
        presupuestoVsReal: [],
        gastosPorRubro: [],
        variacionesPorRubro: [],
        carteraClientes: [],
        chequesEmitidos: [],
        chequesRecibidos: [],
        proyeccionFlujo: [],
        alertasTesoreria: [],
      },
    });

    expect(result.estadoResultados.utilidadNeta).toBe(3000);
    expect(result.balanceGeneral.activos.find((row) => row.label === 'Caja y bancos')?.amount).toBe(1000);
    expect(result.libros.libroMayor).toHaveLength(2);
    expect(result.libros.auxiliarIngresos[0]).toMatchObject({ label: 'COBRANZA', amount: 5000 });
  });

  it('ignora movimientos anulados para el resultado', () => {
    const result = buildEstadosFinancieros({
      periodo: 'TODO',
      movimientos: [
        { uid: '1', fecha: '2026-06-10T00:00:00Z', tipo: 'INGRESO', descripcion: 'Venta PT', monto: 5000, origen_operativo: 'VENTA_PT', estado: 'CONFIRMADO' },
        { uid: '2', fecha: '2026-06-11T00:00:00Z', tipo: 'EGRESO', descripcion: 'Costos anulados', monto: 2000, origen_operativo: 'COSTOS', origen_modulo: 'costos', origen_id: 'costo-003', estado: 'ANULADO' },
      ],
      kpis: {
        saldo_actual: 1000,
        ingresos_mes: 5000,
        egresos_mes: 0,
        flujo_neto: 5000,
        margen_operativo: 100,
        costo_produccion: 0,
        valorizacion_inventario: 400,
        cuentas_por_pagar: 200,
        cuentas_por_cobrar: 300,
        perdida_merma: 0,
        valor_stock_mp: 100,
        valor_stock_pt: 300,
        valor_inventario_total: 400,
      },
      inventario: { valor_stock_mp: 100, valor_stock_pt: 300, valor_inventario_total: 400 },
      tesoreria: {
        presupuestoVsReal: [],
        gastosPorRubro: [],
        variacionesPorRubro: [],
        carteraClientes: [],
        chequesEmitidos: [],
        chequesRecibidos: [],
        proyeccionFlujo: [],
        alertasTesoreria: [],
      },
    });

    expect(result.estadoResultados.utilidadNeta).toBe(5000);
    expect(result.estadoResultados.egresos).toHaveLength(0);
  });
});
