import type { FinanzasKPIs, MovimientoFinanciero } from '../types';

const PENDING_STATES = new Set(['PENDIENTE', 'PENDIENTE_COBRO', 'PENDIENTE_PAGO', 'POR_COBRAR', 'POR_PAGAR', 'VENCIDO']);
const SETTLED_STATES = new Set(['COBRADO', 'PAGADO']);
const CANCELLED_STATES = new Set(['ANULADO', 'CANCELADO']);

const normalize = (value: string | null | undefined) => (value ?? '').trim().toUpperCase();
const num = (value: unknown) => Number(value ?? 0);

export const calcFlujoNeto = (ingresos: number, egresos: number) => ingresos - egresos;

export const calcMargenOperativo = (ingresos: number, egresos: number) => {
  if (ingresos <= 0) return 0;
  return ((ingresos - egresos) / ingresos) * 100;
};

export const obtenerMontoPendiente = (m: any): number => {
  if (m.monto_pendiente !== undefined && m.monto_pendiente !== null) return Number(m.monto_pendiente);
  if (m.saldo_pendiente !== undefined && m.saldo_pendiente !== null) return Number(m.saldo_pendiente);
  if (m.comprobante_saldo !== undefined && m.comprobante_saldo !== null) return Number(m.comprobante_saldo);
  if (m.saldo !== undefined && m.saldo !== null) return Number(m.saldo);
  if (m.total !== undefined && m.total !== null) return Number(m.total);
  return Number(m.monto ?? 0);
};

export const getMovimientoEstadoFinanciero = (movement: Pick<MovimientoFinanciero, 'estado_financiero' | 'estado'>) =>
  normalize(movement.estado_financiero || movement.estado);

export const hasPendingComprobanteBalance = (movement: Pick<MovimientoFinanciero, 'comprobante_saldo' | 'comprobante_estado' | 'comprobante_tipo'>) => {
  const saldo = num(movement.comprobante_saldo);
  const estado = normalize(movement.comprobante_estado);
  if (!movement.comprobante_tipo) return false;
  if (saldo > 0) return true;
  return PENDING_STATES.has(estado);
};

export const isMovimientoCancelado = (movement: Pick<MovimientoFinanciero, 'estado' | 'estado_financiero'>) => {
  const estado = getMovimientoEstadoFinanciero(movement);
  return CANCELLED_STATES.has(estado);
};

export const isMovimientoPendiente = (movement: Pick<MovimientoFinanciero, 'estado' | 'estado_financiero'>) => {
  const estado = getMovimientoEstadoFinanciero(movement);
  return PENDING_STATES.has(estado);
};

export const isMovimientoLiquidado = (movement: Pick<MovimientoFinanciero, 'estado' | 'estado_financiero' | 'fecha_cobro_pago'>) => {
  const estado = getMovimientoEstadoFinanciero(movement);
  return SETTLED_STATES.has(estado) || Boolean(movement.fecha_cobro_pago);
};

export const isIngresoVentaPendiente = (movement: Pick<MovimientoFinanciero, 'tipo' | 'origen_operativo' | 'comprobante_tipo' | 'comprobante_saldo' | 'comprobante_estado' | 'estado' | 'estado_financiero'>) => (
  movement.tipo === 'INGRESO' &&
  normalize(movement.origen_operativo) === 'VENTA_PT' &&
  (normalize(movement.comprobante_tipo) === 'FACTURA_VENTA' || hasPendingComprobanteBalance(movement)) &&
  (hasPendingComprobanteBalance(movement) || isMovimientoPendiente(movement))
);

export const isEgresoCompraPendiente = (movement: Pick<MovimientoFinanciero, 'tipo' | 'origen_operativo' | 'comprobante_tipo' | 'comprobante_saldo' | 'comprobante_estado' | 'estado' | 'estado_financiero'>) => (
  movement.tipo === 'EGRESO' &&
  normalize(movement.origen_operativo) === 'COMPRA_MP' &&
  (
    hasPendingComprobanteBalance(movement) ||
    isMovimientoPendiente(movement) ||
    normalize(movement.comprobante_tipo) === 'FACTURA_COMPRA'
  )
);

export const isMovimientoCajaReal = (movement: Pick<MovimientoFinanciero, 'tipo' | 'origen_operativo' | 'estado' | 'estado_financiero' | 'fecha_cobro_pago' | 'comprobante_tipo' | 'comprobante_estado' | 'comprobante_saldo'>) => {
  if (movement.tipo === 'TRANSFERENCIA') return false;
  if (isMovimientoCancelado(movement)) return false;

  const origen = normalize(movement.origen_operativo);
  if (origen === 'VENTA_PT') {
    // La facturación/expedición no representa caja por sí sola.
    return false;
  }
  if (origen === 'COMPRA_MP') {
    // Una compra de MP sólo impacta caja si fue marcada explícitamente como pagada.
    return isMovimientoLiquidado(movement);
  }
  if (isIngresoVentaPendiente(movement) || isEgresoCompraPendiente(movement)) return false;
  if (origen === 'COBRANZA' || origen === 'PAGO') {
    return isMovimientoLiquidado(movement) || normalize(movement.estado) === 'CONFIRMADO';
  }

  if (isMovimientoPendiente(movement)) return false;
  if (isMovimientoLiquidado(movement)) return true;
  return normalize(movement.estado) === 'CONFIRMADO';
};

export const calcularCuentasPorCobrar = (movimientos: MovimientoFinanciero[]): MovimientoFinanciero[] => {
  return movimientos.filter((movement) => {
    if (movement.tipo !== 'INGRESO') return false;
    if (isMovimientoCancelado(movement)) return false;
    if (isMovimientoCajaReal(movement)) return false;
    if (normalize(movement.comprobante_tipo) === 'FACTURA_VENTA' && hasPendingComprobanteBalance(movement)) return true;
    return isMovimientoPendiente(movement) || isIngresoVentaPendiente(movement);
  });
};

export const calcularCuentasPorPagar = (movimientos: MovimientoFinanciero[]): MovimientoFinanciero[] => {
  return movimientos.filter((movement) => {
    if (movement.tipo !== 'EGRESO') return false;
    if (isMovimientoCancelado(movement)) return false;
    if (isMovimientoCajaReal(movement)) return false;
    if (normalize(movement.comprobante_tipo) === 'FACTURA_COMPRA' && hasPendingComprobanteBalance(movement)) return true;
    return isMovimientoPendiente(movement) || isEgresoCompraPendiente(movement);
  });
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
