import type { FinanzasKPIs } from '../types';

export const calcFlujoNeto = (ingresos: number, egresos: number) => ingresos - egresos;

export const calcMargenOperativo = (ingresos: number, egresos: number) => {
  if (ingresos <= 0) return 0;
  return ((ingresos - egresos) / ingresos) * 100;
};

export const normalizeKpis = (kpi: Partial<FinanzasKPIs>): FinanzasKPIs => {
  const ingresos = Number(kpi.ingresos_mes ?? 0);
  const egresos = Number(kpi.egresos_mes ?? 0);
  return {
    saldo_actual: Number(kpi.saldo_actual ?? 0),
    ingresos_mes: ingresos,
    egresos_mes: egresos,
    flujo_neto: Number(kpi.flujo_neto ?? calcFlujoNeto(ingresos, egresos)),
    margen_operativo: Number(kpi.margen_operativo ?? calcMargenOperativo(ingresos, egresos)),
    costo_produccion: Number(kpi.costo_produccion ?? 0),
    valorizacion_inventario: Number(kpi.valorizacion_inventario ?? 0),
    cuentas_por_pagar: Number(kpi.cuentas_por_pagar ?? 0),
    cuentas_por_cobrar: Number(kpi.cuentas_por_cobrar ?? 0),
    perdida_merma: Number(kpi.perdida_merma ?? 0),
    valor_stock_mp: Number(kpi.valor_stock_mp ?? 0),
    valor_stock_pt: Number(kpi.valor_stock_pt ?? 0),
    valor_inventario_total: Number(kpi.valor_inventario_total ?? kpi.valorizacion_inventario ?? 0),
  };
};
