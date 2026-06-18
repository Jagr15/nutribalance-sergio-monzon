import type { AlertaOperativa } from '../../alertas/types/alerta';
import { EstadoOrden, type OrdenProduccion } from '../../ordenes/types';
import type { MovimientoStockPT } from '../../productos/types';
import { getDashboardPeriodoRange, type DashboardPeriodo } from './dashboardExecutiveInsights';

const num = (value: unknown) => Number(value ?? 0);

export interface DashboardTemporalInsights {
  costos: number;
  ingresos: number;
  flujoCaja: number;
  alertas: AlertaOperativa[];
}

export const filterAlertasByPeriodo = (
  alertas: AlertaOperativa[],
  periodo: DashboardPeriodo,
  now = new Date(),
) => {
  const { start, end } = getDashboardPeriodoRange(periodo, now);
  return alertas.filter((alerta) => {
    const fecha = new Date(alerta.fechaEvento);
    if (Number.isNaN(fecha.getTime())) return false;
    return fecha.getTime() >= start.getTime() && fecha.getTime() <= end.getTime();
  });
};

export const buildDashboardTemporalInsights = (
  ordenes: OrdenProduccion[],
  movimientosPT: MovimientoStockPT[],
  alertas: AlertaOperativa[],
  periodo: DashboardPeriodo,
  now = new Date(),
): DashboardTemporalInsights => {
  const { start, end } = getDashboardPeriodoRange(periodo, now);

  const ordenesPeriodo = ordenes.filter((orden) => {
    const fecha = new Date(orden.fecha_creacion);
    if (Number.isNaN(fecha.getTime())) return false;
    return fecha.getTime() >= start.getTime() && fecha.getTime() <= end.getTime();
  });

  const salidasPeriodo = movimientosPT.filter((movimiento) => {
    if (!['SALIDA', 'DESPACHO_PT'].includes(movimiento.tipo)) return false;
    const fecha = new Date(movimiento.created_at);
    if (Number.isNaN(fecha.getTime())) return false;
    return fecha.getTime() >= start.getTime() && fecha.getTime() <= end.getTime();
  });

  const costos = ordenesPeriodo
    .filter((orden) => orden.estado === EstadoOrden.FINALIZADO)
    .reduce((acc, orden) => acc + num(orden.costo_total_insumos), 0);

  const ingresos = salidasPeriodo.reduce((acc, movimiento) => {
    const venta = num(movimiento.valor_total) > 0
      ? num(movimiento.valor_total)
      : num(movimiento.cantidad) * num(movimiento.costo_unitario);
    return acc + venta;
  }, 0);

  const alertasPeriodo = filterAlertasByPeriodo(alertas, periodo, now);

  return {
    costos: Number(costos.toFixed(2)),
    ingresos: Number(ingresos.toFixed(2)),
    flujoCaja: Number((ingresos - costos).toFixed(2)),
    alertas: alertasPeriodo,
  };
};
