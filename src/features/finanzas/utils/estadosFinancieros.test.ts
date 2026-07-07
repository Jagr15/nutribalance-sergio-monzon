import { describe, expect, it, vi } from 'vitest';
import { buildEstadosFinancieros, getFlujoCajaPagina } from './estadosFinancieros';

vi.useFakeTimers();
vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));

describe('estadosFinancieros', () => {
  it('incluye movimientos del mismo día aunque estén en UTC a medianoche', () => {
    const result = buildEstadosFinancieros({
      periodo: 'RANGO',
      rangoCustom: { desde: '2026-07-01', hasta: '2026-07-01' },
      movimientos: [
        { uid: '1', fecha: '2026-07-01T00:00:00Z', tipo: 'INGRESO', descripcion: 'Ingreso UTC', monto: 1000, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: '2', fecha: '2026-06-30T23:59:59Z', tipo: 'INGRESO', descripcion: 'Fuera de rango', monto: 500, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
      ],
      kpis: {
        saldo_actual: 0,
        ingresos_mes: 1000,
        egresos_mes: 0,
        flujo_neto: 1000,
        margen_operativo: 100,
        costo_produccion: 0,
        valorizacion_inventario: 0,
        cuentas_por_pagar: 0,
        cuentas_por_cobrar: 0,
        perdida_merma: 0,
        valor_stock_mp: 0,
        valor_stock_pt: 0,
        valor_inventario_total: 0,
      },
      inventario: { valor_stock_mp: 0, valor_stock_pt: 0, valor_inventario_total: 0 },
      tesoreria: {
        presupuestoVsReal: [],
        gastosPorRubro: [],
        variacionesPorRubro: [],
        carteraClientes: [{ cliente_id: 'cli-1', cliente_nombre: 'Cliente demo', saldo_pendiente: 300, ultima_compra: null, dias_atraso: null, proximo_vencimiento: null }],
        chequesEmitidos: [],
        chequesRecibidos: [],
        proyeccionFlujo: [],
        alertasTesoreria: [],
      },
    });

    expect(result.estadoResultados.ingresos).toHaveLength(1);
    expect(result.estadoResultados.ingresos[0]).toMatchObject({ label: 'VENTA', amount: 1000 });
    expect(result.estadoResultados.utilidadNeta).toBe(1000);
  });

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
    expect(result.balanceGeneral.activos.find((row) => row.label === 'Cuentas por cobrar')?.amount).toBe(300);
    expect(result.balanceGeneral.pasivos.find((row) => row.label === 'Cuentas por pagar')?.amount).toBe(200);
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
        carteraClientes: [{ cliente_id: 'cli-1', cliente_nombre: 'Cliente demo', saldo_pendiente: 300, ultima_compra: null, dias_atraso: null, proximo_vencimiento: null }],
        chequesEmitidos: [],
        chequesRecibidos: [],
        proyeccionFlujo: [],
        alertasTesoreria: [],
      },
    });

    expect(result.estadoResultados.utilidadNeta).toBe(5000);
    expect(result.estadoResultados.egresos).toHaveLength(0);
  });

  it('reproduce el caso de validación financiera del 01/07/2026', () => {
    const result = buildEstadosFinancieros({
      periodo: 'RANGO',
      rangoCustom: { desde: '2026-07-01', hasta: '2026-07-01' },
      movimientos: [
        { uid: '1', fecha: '2026-07-01T08:00:00Z', tipo: 'INGRESO', descripcion: 'test t', monto: 1000, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: '2', fecha: '2026-07-01T09:00:00Z', tipo: 'INGRESO', descripcion: 'test', monto: 1000, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: '3', fecha: '2026-07-01T10:00:00Z', tipo: 'INGRESO', descripcion: 'venta', monto: 500000, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: '4', fecha: '2026-07-01T11:00:00Z', tipo: 'INGRESO', descripcion: 'ventas', monto: 1500000, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: '5', fecha: '2026-07-01T12:00:00Z', tipo: 'EGRESO', descripcion: 'egreso 1', monto: 1500000, origen_operativo: 'COMPRA', estado: 'CONFIRMADO' },
        { uid: '6', fecha: '2026-07-01T13:00:00Z', tipo: 'EGRESO', descripcion: 'egreso 2', monto: 1200000, origen_operativo: 'COMPRA', estado: 'CONFIRMADO' },
      ],
      kpis: {
        saldo_actual: 0,
        ingresos_mes: 2002000,
        egresos_mes: 2700000,
        flujo_neto: -698000,
        margen_operativo: -34.86613386613387,
        costo_produccion: 0,
        valorizacion_inventario: 0,
        cuentas_por_pagar: 0,
        cuentas_por_cobrar: 0,
        perdida_merma: 0,
        valor_stock_mp: 0,
        valor_stock_pt: 0,
        valor_inventario_total: 0,
      },
      inventario: { valor_stock_mp: 0, valor_stock_pt: 0, valor_inventario_total: 0 },
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

    expect(result.estadoResultados.ingresos.reduce((acc, row) => acc + row.amount, 0)).toBe(2002000);
    expect(result.estadoResultados.egresos.reduce((acc, row) => acc + row.amount, 0)).toBe(2700000);
    expect(result.estadoResultados.utilidadNeta).toBe(-698000);
    expect(result.libros.auxiliarIngresos.reduce((acc, row) => acc + row.amount, 0)).toBe(2002000);
    expect(result.libros.auxiliarEgresos.reduce((acc, row) => acc + row.amount, 0)).toBe(2700000);
  });

  it('calcula correctamente el flujo de caja operativo y saldo acumulado', () => {
    const result = buildEstadosFinancieros({
      periodo: 'TODO',
      movimientos: [
        { uid: 'm3', fecha: '2026-07-03T10:00:00Z', tipo: 'EGRESO', descripcion: 'Egreso 3', monto: 300, origen_operativo: 'COMPRA', estado: 'CONFIRMADO' },
        { uid: 'm1', fecha: '2026-07-01T10:00:00Z', tipo: 'INGRESO', descripcion: 'Ingreso 1', monto: 1000, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: 'm2', fecha: '2026-07-02T10:00:00Z', tipo: 'INGRESO', descripcion: 'Ingreso 2', monto: 500, origen_operativo: 'VENTA', estado: 'CONFIRMADO' },
        { uid: 'm4', fecha: '2026-07-04T10:00:00Z', tipo: 'INGRESO', descripcion: 'Ingreso PND', monto: 800, origen_operativo: 'VENTA', estado: 'PENDIENTE' },
      ],
      kpis: {
        saldo_actual: 1200,
        ingresos_mes: 0,
        egresos_mes: 0,
        flujo_neto: 0,
        margen_operativo: 0,
        costo_produccion: 0,
        valorizacion_inventario: 0,
        cuentas_por_pagar: 0,
        cuentas_por_cobrar: 0,
        perdida_merma: 0,
        valor_stock_mp: 0,
        valor_stock_pt: 0,
        valor_inventario_total: 0,
      },
      inventario: { valor_stock_mp: 0, valor_stock_pt: 0, valor_inventario_total: 0 },
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

    const fc = result.flujoCaja;
    // Deben ser solo 3 movimientos (el PENDIENTE se excluye)
    expect(fc.movimientos).toHaveLength(3);

    // Deben estar ordenados de forma descendente en el array final expuesto para la UI
    expect(fc.movimientos[0].id).toBe('m3'); // 2026-07-03
    expect(fc.movimientos[1].id).toBe('m2'); // 2026-07-02
    expect(fc.movimientos[2].id).toBe('m1'); // 2026-07-01

    // Pero el saldo acumulado debió calcularse cronológicamente (ascendente):
    // 1. m1 (Ingreso 1000) -> saldo: 1000
    // 2. m2 (Ingreso 500) -> saldo: 1000 + 500 = 1500
    // 3. m3 (Egreso 300) -> saldo: 1500 - 300 = 1200
    expect(fc.movimientos.find(m => m.id === 'm1')?.saldo_acumulado).toBe(1000);
    expect(fc.movimientos.find(m => m.id === 'm2')?.saldo_acumulado).toBe(1500);
    expect(fc.movimientos.find(m => m.id === 'm3')?.saldo_acumulado).toBe(1200);

    // Resumen superior
    expect(fc.resumen.totalIngresos).toBe(1500);
    expect(fc.resumen.totalEgresos).toBe(300);
    expect(fc.resumen.flujoNeto).toBe(1200);
    expect(fc.resumen.saldoFinal).toBe(1200);
    expect(fc.resumen.cantidadMovimientos).toBe(3);
  });

  it('paginación del flujo de caja divide correctamente los movimientos en bloques de 15', () => {
    // Generar 35 movimientos mock
    const baseMovimientos = Array.from({ length: 35 }, (_, i) => ({
      id: `mov-${i}`,
      fecha: `2026-07-${String(i + 1).padStart(2, '0')}`,
      tipo: 'INGRESO' as const,
      categoria: 'VENTA',
      referencia: null,
      tercero: null,
      descripcion: `Movimiento ${i}`,
      metodo_pago: null,
      estado: 'CONFIRMADO',
      ingreso: 100,
      egreso: 0,
      saldo_acumulado: (i + 1) * 100,
    }));

    // Primera página (15 registros)
    const page1 = getFlujoCajaPagina(baseMovimientos, 1, 15);
    expect(page1).toHaveLength(15);
    expect(page1[0].id).toBe('mov-0');
    expect(page1[14].id).toBe('mov-14');

    // Segunda página (15 registros)
    const page2 = getFlujoCajaPagina(baseMovimientos, 2, 15);
    expect(page2).toHaveLength(15);
    expect(page2[0].id).toBe('mov-15');
    expect(page2[14].id).toBe('mov-29');

    // Tercera página (5 registros restantes)
    const page3 = getFlujoCajaPagina(baseMovimientos, 3, 15);
    expect(page3).toHaveLength(5);
    expect(page3[0].id).toBe('mov-30');
    expect(page3[4].id).toBe('mov-34');
  });
});
