export type TipoMovimientoFinanciero = 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';

export interface MovimientoFinanciero {
  uid: string;
  fecha: string;
  tipo: TipoMovimientoFinanciero;
  origen_operativo?: string;
  descripcion: string;
  monto: number;
  categoria?: string;
  centro_costo?: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
}

export interface FinanzasKPIs {
  saldo_actual: number;
  ingresos_mes: number;
  egresos_mes: number;
  flujo_neto: number;
  margen_operativo: number;
  costo_produccion: number;
  valorizacion_inventario: number;
  cuentas_por_pagar: number;
  cuentas_por_cobrar: number;
  perdida_merma: number;
  valor_stock_mp?: number;
  valor_stock_pt?: number;
  valor_inventario_total?: number;
}

export interface FinanzasReportes {
  flujo_caja_mensual: Array<{ mes: string; ingresos: number; egresos: number; neto: number }>;
  gastos_por_categoria: Array<{ categoria: string; monto: number }>;
  ingresos_por_categoria: Array<{ categoria: string; monto: number }>;
  rentabilidad_por_formula: Array<{ id_formula: string; nombre_producto: string; costo_total: number; kg_total: number; costo_promedio_kg: number }>;
  costo_operativo_mensual: Array<{ mes: string; monto: number }>;
}

export interface CostosFormulaVsReal {
  producto_formula_id: string;
  nombre_producto: string;
  version_formula: number | null;
  costo_formulado_kg: number;
  costo_formulado_ton: number;
  costo_real_kg: number;
  costo_real_ton: number;
  variacion_abs: number;
  variacion_pct: number;
  ultima_op: string | null;
}

export interface FinanzasInventarioResumen {
  valor_stock_mp: number;
  valor_stock_pt: number;
  valor_inventario_total: number;
}
