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
  ingresos_pt_por_producto: Array<{
    producto: string;
    cantidad_kg: number;
    importe_total: number;
    clientes_count: number;
    ultima_fecha: string | null;
    variacion_pct?: number | null;
    costo_referencial_kg?: number | null;
  }>;
  rentabilidad_por_formula: Array<{ id_formula: string; nombre_producto: string; costo_total: number; kg_total: number; costo_promedio_kg: number }>;
  costo_operativo_mensual: Array<{ mes: string; monto: number }>;
}

export type RubroFinanciero =
  string;

export interface PresupuestoVsRealRubro {
  rubro: RubroFinanciero;
  presupuesto: number;
  real: number;
  variacion_abs: number;
  variacion_pct: number;
  generado: boolean;
}

export interface GastoPorRubro {
  rubro: RubroFinanciero;
  monto: number;
  porcentaje: number;
}

export interface RubroFinancieroCatalogo {
  id: string;
  nombre: string;
  tipo: 'INGRESO' | 'EGRESO';
  activo: boolean;
  area?: string | null;
}

export interface ClienteCarteraRow {
  cliente_id: string | null;
  cliente_nombre: string;
  saldo_pendiente: number;
  ultima_compra: string | null;
  dias_atraso: number | null;
  proximo_vencimiento: string | null;
}

export type TipoChequeTesoreria = 'EMITIDO' | 'RECIBIDO';
export type EstadoChequeTesoreria = 'PENDIENTE' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'VENCIDO';

export interface ChequeTesoreriaRow {
  id: string;
  numero: string;
  tipo: TipoChequeTesoreria;
  tercero: string;
  importe: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_acreditacion?: string | null;
  estado: EstadoChequeTesoreria;
  cliente_id: string | null;
  cliente_nombre: string | null;
}

export interface ProyeccionFlujoRow {
  horizonte: 'Hoy' | '7 días' | '15 días' | '30 días';
  saldo_estimado: number;
  ingresos_estimados: number;
  egresos_estimados: number;
}

export interface AlertaTesoreriaRaw {
  alerta_id: string;
  tipo: string;
  prioridad: 'critica' | 'media' | 'informativa';
  area: 'tesoreria';
  titulo: string;
  dato_asociado: Record<string, unknown>;
  fecha_evento: string;
}

export interface FinanzasTesoreriaInsights {
  presupuestoVsReal: PresupuestoVsRealRubro[];
  gastosPorRubro: GastoPorRubro[];
  variacionesPorRubro: PresupuestoVsRealRubro[];
  carteraClientes: ClienteCarteraRow[];
  chequesEmitidos: ChequeTesoreriaRow[];
  chequesRecibidos: ChequeTesoreriaRow[];
  proyeccionFlujo: ProyeccionFlujoRow[];
  alertasTesoreria: AlertaTesoreriaRaw[];
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
