import type { ChequeTesoreriaRow, MovimientoFinanciero, TipoMovimientoFinanciero } from '../types';

export const MONTH_LABELS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const PLAZO_CAJA_OPTIONS = [120, 130, 140, 150, 160] as const;

export type ProyeccionCajaFilaClave = 'saldo_inicial' | 'ingresos' | 'gastos' | 'ganancia_perdida' | 'acumulado' | 'rentabilidad';
export type ProyeccionCajaFormato = 'currency' | 'percentage';

export interface ProyeccionCajaRow {
  key: ProyeccionCajaFilaClave;
  label: string;
  format: ProyeccionCajaFormato;
  values: Array<number | null>;
}

export interface ProyeccionCajaItem {
  id: string;
  tipo: TipoMovimientoFinanciero;
  fuente: string;
  descripcion: string;
  monto: number;
  fecha_base: string;
  plazo_aplicado_dias: number;
  fecha_proyectada: string;
  mes_proyectado: string;
  cliente_nombre?: string | null;
  proveedor_nombre?: string | null;
  categoria?: string | null;
}

export interface ProyeccionCajaFilters {
  anio: number;
  plazoCobranzaDias: number;
  plazoPagoDias: number;
  saldoInicialEnero: number;
  cliente?: string;
  proveedor?: string;
  tipoMovimiento?: TipoMovimientoFinanciero | '';
}

export interface ProyeccionCajaInput extends ProyeccionCajaFilters {
  movimientos: MovimientoFinanciero[];
  chequesRecibidos: ChequeTesoreriaRow[];
  chequesEmitidos: ChequeTesoreriaRow[];
}

export interface ProyeccionCajaResult {
  anio: number;
  meses: typeof MONTH_LABELS_ES;
  rows: ProyeccionCajaRow[];
  items: ProyeccionCajaItem[];
  resumen: {
    ingresos_total: number;
    gastos_total: number;
    ganancia_perdida_total: number;
    saldo_final: number;
    rentabilidad_total: number | null;
  };
}

const toLocalDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toLocalIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (value: string, days: number): string => {
  const date = toLocalDate(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
};

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const isPendingFinancialState = (value: string | null | undefined, tipo: TipoMovimientoFinanciero) => {
  const state = normalize(value).toUpperCase();
  if (tipo === 'INGRESO') {
    return ['PENDIENTE', 'PENDIENTE_COBRO', 'POR_COBRAR', 'VENCIDO'].includes(state);
  }
  if (tipo === 'EGRESO') {
    return ['PENDIENTE', 'PENDIENTE_PAGO', 'POR_PAGAR', 'VENCIDO'].includes(state);
  }
  return false;
};

const isEligibleCheque = (cheque: ChequeTesoreriaRow, tipo: TipoMovimientoFinanciero) => {
  if (tipo === 'INGRESO') {
    return cheque.tipo === 'RECIBIDO' && !['COBRADO', 'DEPOSITADO', 'ENDOSADO', 'RECHAZADO'].includes(cheque.estado);
  }
  if (tipo === 'EGRESO') {
    return cheque.tipo === 'EMITIDO' && !['COBRADO', 'RECHAZADO'].includes(cheque.estado);
  }
  return false;
};

const resolveMovementBaseDate = (movement: MovimientoFinanciero) => movement.fecha_cobro_pago || movement.fecha_vencimiento || movement.fecha_operacion || movement.fecha;
const resolveChequeBaseDate = (cheque: ChequeTesoreriaRow) => cheque.fecha_emision || cheque.fecha_vencimiento;

const matchesText = (candidate: string | null | undefined, filter: string | undefined) => {
  if (!filter) return true;
  return normalize(candidate).includes(normalize(filter));
};

const matchesTypeFilter = (tipo: TipoMovimientoFinanciero, filter: TipoMovimientoFinanciero | '') => {
  if (!filter) return true;
  return tipo === filter;
};

const buildItemFromMovement = (
  movement: MovimientoFinanciero,
  plazoDias: number,
): ProyeccionCajaItem | null => {
  if (!isPendingFinancialState(movement.estado_financiero ?? movement.estado, movement.tipo)) return null;
  if (!['INGRESO', 'EGRESO'].includes(movement.tipo)) return null;
  const baseDate = resolveMovementBaseDate(movement);
  const projectedDate = addDays(baseDate, plazoDias);
  if (!projectedDate) return null;
  const monto = Number(movement.monto ?? 0);
  if (!Number.isFinite(monto) || monto <= 0) return null;
  return {
    id: `mov-${movement.uid}`,
    tipo: movement.tipo,
    fuente: 'Movimiento financiero',
    descripcion: movement.descripcion,
    monto,
    fecha_base: baseDate,
    plazo_aplicado_dias: plazoDias,
    fecha_proyectada: projectedDate,
    mes_proyectado: MONTH_LABELS_ES[(toLocalDate(projectedDate)?.getMonth() ?? 0)],
    categoria: movement.categoria ?? null,
  };
};

const buildItemFromCheque = (
  cheque: ChequeTesoreriaRow,
  plazoDias: number,
): ProyeccionCajaItem | null => {
  const tipo: TipoMovimientoFinanciero = cheque.tipo === 'RECIBIDO' ? 'INGRESO' : 'EGRESO';
  if (!isEligibleCheque(cheque, tipo)) return null;
  const baseDate = resolveChequeBaseDate(cheque);
  const projectedDate = addDays(baseDate, plazoDias);
  if (!projectedDate) return null;
  const monto = Number(cheque.importe ?? 0);
  if (!Number.isFinite(monto) || monto <= 0) return null;
  return {
    id: `cheque-${cheque.id}`,
    tipo,
    fuente: cheque.tipo === 'RECIBIDO' ? 'Cheque recibido' : 'Cheque emitido',
    descripcion: `${cheque.tipo === 'RECIBIDO' ? 'Cobranza' : 'Pago'} ${cheque.numero}`,
    monto,
    fecha_base: baseDate,
    plazo_aplicado_dias: plazoDias,
    fecha_proyectada: projectedDate,
    mes_proyectado: MONTH_LABELS_ES[(toLocalDate(projectedDate)?.getMonth() ?? 0)],
    cliente_nombre: cheque.tipo === 'RECIBIDO' ? cheque.cliente_nombre ?? cheque.tercero : null,
    proveedor_nombre: cheque.tipo === 'EMITIDO' ? cheque.tercero : null,
  };
};

export const buildProyeccionCaja = (input: ProyeccionCajaInput): ProyeccionCajaResult => {
  const items = [
    ...input.movimientos.map((movement) => buildItemFromMovement(movement, movement.tipo === 'INGRESO' ? input.plazoCobranzaDias : input.plazoPagoDias)),
    ...input.chequesRecibidos.map((cheque) => buildItemFromCheque(cheque, input.plazoCobranzaDias)),
    ...input.chequesEmitidos.map((cheque) => buildItemFromCheque(cheque, input.plazoPagoDias)),
  ]
    .filter((item): item is ProyeccionCajaItem => item !== null)
    .filter((item) => {
      const projected = toLocalDate(item.fecha_proyectada);
      if (!projected) return false;
      if (projected.getFullYear() !== input.anio) return false;
      if (!matchesTypeFilter(item.tipo, input.tipoMovimiento ?? '')) return false;
      if (item.tipo === 'INGRESO') {
        return matchesText(item.cliente_nombre ?? item.descripcion, input.cliente);
      }
      return matchesText(item.proveedor_nombre ?? item.descripcion, input.proveedor);
    })
    .sort((a, b) => a.fecha_proyectada.localeCompare(b.fecha_proyectada) || a.descripcion.localeCompare(b.descripcion));

  const monthly = Array.from({ length: 12 }, () => ({ ingresos: 0, gastos: 0 }));
  items.forEach((item) => {
    const projected = toLocalDate(item.fecha_proyectada);
    if (!projected) return;
    const monthIndex = projected.getMonth();
    if (item.tipo === 'INGRESO') {
      monthly[monthIndex].ingresos += item.monto;
    } else if (item.tipo === 'EGRESO') {
      monthly[monthIndex].gastos += item.monto;
    }
  });

  const saldoInicial: number[] = Array.from({ length: 12 }, () => 0);
  const acumulado: number[] = Array.from({ length: 12 }, () => 0);
  const gananciaPerdida: number[] = Array.from({ length: 12 }, () => 0);
  const rentabilidad: Array<number | null> = Array.from({ length: 12 }, () => null);

  for (let index = 0; index < 12; index += 1) {
    saldoInicial[index] = index === 0 ? input.saldoInicialEnero : acumulado[index - 1];
    gananciaPerdida[index] = monthly[index].ingresos - monthly[index].gastos;
    acumulado[index] = saldoInicial[index] + gananciaPerdida[index];
    rentabilidad[index] = monthly[index].ingresos > 0 ? gananciaPerdida[index] / monthly[index].ingresos : null;
  }

  const rows: ProyeccionCajaRow[] = [
    { key: 'saldo_inicial', label: 'Saldo inicial', format: 'currency', values: saldoInicial },
    { key: 'ingresos', label: 'Ingresos', format: 'currency', values: monthly.map((month) => month.ingresos) },
    { key: 'gastos', label: 'Gastos', format: 'currency', values: monthly.map((month) => month.gastos) },
    { key: 'ganancia_perdida', label: 'Ganancia / Pérdida', format: 'currency', values: gananciaPerdida },
    { key: 'acumulado', label: 'Acumulado', format: 'currency', values: acumulado },
    { key: 'rentabilidad', label: 'Rentabilidad', format: 'percentage', values: rentabilidad },
  ];

  const ingresosTotal = monthly.reduce((acc, month) => acc + month.ingresos, 0);
  const gastosTotal = monthly.reduce((acc, month) => acc + month.gastos, 0);
  const gananciaTotal = ingresosTotal - gastosTotal;
  const saldoFinal = acumulado[11] ?? input.saldoInicialEnero;

  return {
    anio: input.anio,
    meses: MONTH_LABELS_ES,
    rows,
    items,
    resumen: {
      ingresos_total: ingresosTotal,
      gastos_total: gastosTotal,
      ganancia_perdida_total: gananciaTotal,
      saldo_final: saldoFinal,
      rentabilidad_total: ingresosTotal > 0 ? gananciaTotal / ingresosTotal : null,
    },
  };
};
