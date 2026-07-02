import type { FinanzasInventarioResumen, FinanzasKPIs, FinanzasTesoreriaInsights, MovimientoFinanciero } from '../types';
import { calcularCuentasPorCobrar, calcularCuentasPorPagar, obtenerMontoPendiente } from './finanzasCalculations';

export type PeriodoFiltro = 'MES_ACTUAL' | 'TRIMESTRE_ACTUAL' | 'ANIO_ACTUAL' | 'TODO' | 'RANGO';

export interface RangoFechas {
  desde: string;
  hasta: string;
}

export interface EstadoResultadoItem {
  label: string;
  amount: number;
}

export interface BalanceLinea {
  label: string;
  amount: number;
}

export interface LibroMayorRow {
  fecha: string;
  descripcion: string;
  cuenta: string;
  debito: number;
  credito: number;
  saldo: number;
}

export interface EstadosFinancierosData {
  estadoResultados: {
    ingresos: EstadoResultadoItem[];
    egresos: EstadoResultadoItem[];
    utilidadNeta: number;
  };
  balanceGeneral: {
    activos: BalanceLinea[];
    pasivos: BalanceLinea[];
    patrimonio: BalanceLinea[];
  };
  libros: {
    libroMayor: LibroMayorRow[];
    auxiliarIngresos: EstadoResultadoItem[];
    auxiliarEgresos: EstadoResultadoItem[];
  };
}

const num = (value: unknown) => Number(value ?? 0);
const toDate = (value: string) => new Date(value);
const toUtcDateKey = (value: string) => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};
const toUtcMonthKey = (value: string) => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 7);
};
const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const keyMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);

export const getPeriodoRango = (periodo: PeriodoFiltro, custom?: RangoFechas): RangoFechas | null => {
  const today = new Date();
  if (periodo === 'TODO') return null;
  if (periodo === 'MES_ACTUAL') return { desde: toLocalDateInput(startOfMonth(today)), hasta: toLocalDateInput(today) };
  if (periodo === 'TRIMESTRE_ACTUAL') return { desde: toLocalDateInput(startOfQuarter(today)), hasta: toLocalDateInput(today) };
  if (periodo === 'ANIO_ACTUAL') return { desde: toLocalDateInput(startOfYear(today)), hasta: toLocalDateInput(today) };
  return custom?.desde && custom?.hasta ? custom : null;
};

export const filtrarMovimientosPorPeriodo = (movimientos: MovimientoFinanciero[], rango: RangoFechas | null) => {
  if (!rango) return movimientos;
  const desde = rango.desde;
  const hasta = rango.hasta;
  return movimientos.filter((movimiento) => {
    const fecha = toUtcDateKey(movimiento.fecha);
    return fecha !== null && fecha >= desde && fecha <= hasta;
  });
};

export const buildEstadosFinancieros = (params: {
  movimientos: MovimientoFinanciero[];
  kpis: FinanzasKPIs;
  inventario: FinanzasInventarioResumen;
  tesoreria: FinanzasTesoreriaInsights;
  periodo: PeriodoFiltro;
  rangoCustom?: RangoFechas;
}): EstadosFinancierosData => {
  const rango = getPeriodoRango(params.periodo, params.rangoCustom);
  const movimientos = filtrarMovimientosPorPeriodo(params.movimientos, rango);
  const movimientosConfirmados = movimientos.filter((movimiento) => movimiento.estado === 'CONFIRMADO');
  const ingresos = movimientosConfirmados.filter((movimiento) => movimiento.tipo === 'INGRESO');
  const egresos = movimientosConfirmados.filter((movimiento) => movimiento.tipo === 'EGRESO');

  if (typeof import.meta !== 'undefined' && import.meta.env.DEV) {
    const excludedByPeriod = rango
      ? params.movimientos.filter((movimiento) => {
          const fecha = toUtcDateKey(movimiento.fecha);
          return fecha === null || fecha < rango.desde || fecha > rango.hasta;
        })
      : [];
    const excludedByStatus = movimientos.filter((movimiento) => movimiento.estado !== 'CONFIRMADO');
    console.debug('[EstadosFinancieros] cálculo', {
      rango,
      totalLeidos: params.movimientos.length,
      totalEnRango: movimientos.length,
      totalConfirmados: movimientosConfirmados.length,
      ingresosConfirmados: ingresos.length,
      egresosConfirmados: egresos.length,
      ingresosTotal: Number(ingresos.reduce((acc, row) => acc + num(row.monto), 0).toFixed(2)),
      egresosTotal: Number(egresos.reduce((acc, row) => acc + num(row.monto), 0).toFixed(2)),
      excluidosPorPeriodo: excludedByPeriod.length,
      excluidosPorEstado: excludedByStatus.length,
    });
    if (excludedByPeriod.length > 0) {
      console.debug('[EstadosFinancieros] excluidos por periodo', excludedByPeriod.slice(0, 20).map((movimiento) => ({
        uid: movimiento.uid,
        fecha: movimiento.fecha,
        fechaUtc: toUtcDateKey(movimiento.fecha),
        tipo: movimiento.tipo,
        estado: movimiento.estado,
        monto: movimiento.monto,
        descripcion: movimiento.descripcion,
      })));
    }
  }

  const ingresosPorCuenta = new Map<string, number>();
  const egresosPorCuenta = new Map<string, number>();
  ingresos.forEach((movimiento) => ingresosPorCuenta.set(movimiento.origen_operativo ?? 'Operación', (ingresosPorCuenta.get(movimiento.origen_operativo ?? 'Operación') ?? 0) + num(movimiento.monto)));
  egresos.forEach((movimiento) => egresosPorCuenta.set(movimiento.origen_operativo ?? 'Operación', (egresosPorCuenta.get(movimiento.origen_operativo ?? 'Operación') ?? 0) + num(movimiento.monto)));

  const ingresosItems = [...ingresosPorCuenta.entries()].map(([label, amount]) => ({ label, amount: Number(amount.toFixed(2)) })).sort((a, b) => b.amount - a.amount);
  const egresosItems = [...egresosPorCuenta.entries()].map(([label, amount]) => ({ label, amount: Number(amount.toFixed(2)) })).sort((a, b) => b.amount - a.amount);

  const ventas = ingresos.reduce((acc, row) => acc + num(row.monto), 0);
  const gastos = egresos.reduce((acc, row) => acc + num(row.monto), 0);
  const utilidadNeta = Number((ventas - gastos).toFixed(2));

  const ctasCobrarFiltradas = calcularCuentasPorCobrar(movimientos);
  const ctasPagarFiltradas = calcularCuentasPorPagar(movimientos);

  const totalCuentasPorCobrar = ctasCobrarFiltradas.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);
  const totalCuentasPorPagar = ctasPagarFiltradas.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0);

  const activos = [
    { label: 'Caja y bancos', amount: Number(params.kpis.saldo_actual.toFixed(2)) },
    { label: 'Cuentas por cobrar', amount: Number(totalCuentasPorCobrar.toFixed(2)) },
    { label: 'Inventario total', amount: Number(params.inventario.valor_inventario_total.toFixed(2)) },
  ].filter((row) => row.amount !== 0);
  const pasivos = [
    { label: 'Cuentas por pagar', amount: Number(totalCuentasPorPagar.toFixed(2)) },
    { label: 'Cheques emitidos pendientes', amount: Number(params.tesoreria.chequesEmitidos.filter((cheque) => cheque.estado === 'PENDIENTE').reduce((acc, cheque) => acc + cheque.importe, 0).toFixed(2)) },
  ].filter((row) => row.amount !== 0);
  const patrimonioNeto = Number((activos.reduce((acc, row) => acc + row.amount, 0) - pasivos.reduce((acc, row) => acc + row.amount, 0)).toFixed(2));
  const patrimonio = [{ label: 'Patrimonio neto estimado', amount: patrimonioNeto }];

  const libroMayor = movimientosConfirmados.map((movimiento) => ({
    fecha: movimiento.fecha,
    descripcion: movimiento.descripcion,
    cuenta: movimiento.categoria ?? movimiento.origen_operativo ?? 'Operación',
    debito: movimiento.tipo === 'EGRESO' ? num(movimiento.monto) : 0,
    credito: movimiento.tipo === 'INGRESO' ? num(movimiento.monto) : 0,
    saldo: movimiento.tipo === 'INGRESO' ? num(movimiento.monto) : -num(movimiento.monto),
  })).sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime());

  const libroPorMes = new Map<string, number>();
  movimientosConfirmados.forEach((movimiento) => {
    const mes = toUtcMonthKey(movimiento.fecha) ?? keyMonth(toDate(movimiento.fecha));
    libroPorMes.set(mes, (libroPorMes.get(mes) ?? 0) + (movimiento.tipo === 'INGRESO' ? num(movimiento.monto) : -num(movimiento.monto)));
  });

  return {
    estadoResultados: {
      ingresos: ingresosItems,
      egresos: egresosItems,
      utilidadNeta,
    },
    balanceGeneral: {
      activos,
      pasivos,
      patrimonio,
    },
    libros: {
      libroMayor,
      auxiliarIngresos: [...ingresosPorCuenta.entries()].map(([label, amount]) => ({ label, amount: Number(amount.toFixed(2)) })),
      auxiliarEgresos: [...egresosPorCuenta.entries()].map(([label, amount]) => ({ label, amount: Number(amount.toFixed(2)) })),
    },
  };
};
