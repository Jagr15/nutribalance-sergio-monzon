import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';

export type DashboardPeriodo = 'HOY' | 'SEMANA' | 'MES';

export interface DashboardExecutiveProductoRow {
  producto_id: string | null;
  producto_nombre: string;
  kg: number;
  importe: number;
  clientes_atendidos: number;
  movimientos: number;
  ultima_fecha: string | null;
}

export interface DashboardExecutiveClienteRow {
  cliente_id: string | null;
  cliente_nombre: string;
  kg: number;
  importe: number;
  movimientos: number;
  ultima_fecha: string | null;
}

export interface DashboardExecutiveInsights {
  ventasPorProducto: DashboardExecutiveProductoRow[];
  kgDespachadosPorProducto: DashboardExecutiveProductoRow[];
  topClientesPorVolumen: DashboardExecutiveClienteRow[];
  clientesAtendidos: number;
  totalKgDespachados: number;
  totalImporte: number;
  periodoLabel: string;
}

const salidaTypes = new Set(['SALIDA', 'DESPACHO_PT']);

const toDate = (iso: string | Date) => new Date(iso);

const normalizeNumber = (value: unknown) => Number(value ?? 0);

const resolveClienteNombre = (clienteId: string | null | undefined, clientes: Cliente[]) => {
  if (!clienteId) return 'Sin cliente asociado';
  return clientes.find((cliente) => cliente.uid === clienteId)?.nombre ?? 'Sin cliente asociado';
};

export const getDashboardPeriodoLabel = (periodo: DashboardPeriodo) => {
  if (periodo === 'HOY') return 'Hoy';
  if (periodo === 'SEMANA') return 'Semana';
  return 'Mes';
};

export const getDashboardPeriodoRange = (periodo: DashboardPeriodo, now = new Date()) => {
  const end = new Date(now);
  const start = new Date(now);
  if (periodo === 'HOY') {
    start.setHours(0, 0, 0, 0);
  } else if (periodo === 'SEMANA') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - (day - 1));
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const isWithinDashboardPeriodo = (value: string | Date, periodo: DashboardPeriodo, now = new Date()) => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = getDashboardPeriodoRange(periodo, now);
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

export const filterMovimientosPTByPeriodo = (
  movimientos: MovimientoStockPT[],
  periodo: DashboardPeriodo,
  now = new Date(),
) => movimientos.filter((mov) => salidaTypes.has(mov.tipo) && isWithinDashboardPeriodo(mov.created_at, periodo, now));

export const buildDashboardExecutiveInsights = (
  movimientos: MovimientoStockPT[],
  clientes: Cliente[],
  periodo: DashboardPeriodo,
  now = new Date(),
): DashboardExecutiveInsights => {
  const salidas = filterMovimientosPTByPeriodo(movimientos, periodo, now);
  const byProducto = new Map<string, {
    producto_id: string | null;
    producto_nombre: string;
    kg: number;
    importe: number;
    clientes: Set<string>;
    movimientos: number;
    ultima_fecha: string | null;
  }>();
  const byCliente = new Map<string, {
    cliente_id: string | null;
    cliente_nombre: string;
    kg: number;
    importe: number;
    movimientos: number;
    ultima_fecha: string | null;
  }>();

  salidas.forEach((movimiento) => {
    const importe = normalizeNumber(movimiento.valor_total) > 0
      ? normalizeNumber(movimiento.valor_total)
      : normalizeNumber(movimiento.costo_unitario) * normalizeNumber(movimiento.cantidad);
    const clienteId = movimiento.cliente_id ?? null;
    const clienteNombre = movimiento.cliente_nombre ?? resolveClienteNombre(clienteId, clientes);
    const productoKey = movimiento.producto_id ?? movimiento.nombre_producto;
    const currentProducto = byProducto.get(productoKey) ?? {
      producto_id: movimiento.producto_id ?? null,
      producto_nombre: movimiento.nombre_producto,
      kg: 0,
      importe: 0,
      clientes: new Set<string>(),
      movimientos: 0,
      ultima_fecha: null,
    };
    currentProducto.kg += normalizeNumber(movimiento.cantidad);
    currentProducto.importe += importe;
    currentProducto.movimientos += 1;
    if (clienteId) currentProducto.clientes.add(clienteId);
    if (!currentProducto.ultima_fecha || toDate(movimiento.created_at).getTime() > toDate(currentProducto.ultima_fecha).getTime()) {
      currentProducto.ultima_fecha = movimiento.created_at;
    }
    byProducto.set(productoKey, currentProducto);

    const clienteKey = clienteId ?? clienteNombre;
    const currentCliente = byCliente.get(clienteKey) ?? {
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      kg: 0,
      importe: 0,
      movimientos: 0,
      ultima_fecha: null,
    };
    currentCliente.kg += normalizeNumber(movimiento.cantidad);
    currentCliente.importe += importe;
    currentCliente.movimientos += 1;
    if (!currentCliente.ultima_fecha || toDate(movimiento.created_at).getTime() > toDate(currentCliente.ultima_fecha).getTime()) {
      currentCliente.ultima_fecha = movimiento.created_at;
    }
    byCliente.set(clienteKey, currentCliente);
  });

  const ventasPorProducto = [...byProducto.values()]
    .map((row) => ({
      producto_id: row.producto_id,
      producto_nombre: row.producto_nombre,
      kg: row.kg,
      importe: row.importe,
      clientes_atendidos: row.clientes.size,
      movimientos: row.movimientos,
      ultima_fecha: row.ultima_fecha,
    }))
    .sort((a, b) => b.importe - a.importe);

  const kgDespachadosPorProducto = [...byProducto.values()]
    .map((row) => ({
      producto_id: row.producto_id,
      producto_nombre: row.producto_nombre,
      kg: row.kg,
      importe: row.importe,
      clientes_atendidos: row.clientes.size,
      movimientos: row.movimientos,
      ultima_fecha: row.ultima_fecha,
    }))
    .sort((a, b) => b.kg - a.kg);

  const topClientesPorVolumen = [...byCliente.values()]
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 6);

  return {
    ventasPorProducto: ventasPorProducto.slice(0, 6),
    kgDespachadosPorProducto: kgDespachadosPorProducto.slice(0, 6),
    topClientesPorVolumen,
    clientesAtendidos: byCliente.size,
    totalKgDespachados: salidas.reduce((acc, mov) => acc + normalizeNumber(mov.cantidad), 0),
    totalImporte: salidas.reduce((acc, mov) => acc + (normalizeNumber(mov.valor_total) > 0 ? normalizeNumber(mov.valor_total) : normalizeNumber(mov.costo_unitario) * normalizeNumber(mov.cantidad)), 0),
    periodoLabel: getDashboardPeriodoLabel(periodo),
  };
};
