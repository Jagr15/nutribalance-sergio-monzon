import type { MovimientoStockPT } from '../../productos/types';

const salidaTypes = new Set(['SALIDA', 'DESPACHO_PT']);
const num = (value: unknown) => Number(value ?? 0);

export interface IngresoPTFinancieroLink {
  stock_pt_id: string | null;
  monto?: number | string | null;
  fecha?: string | null;
}

export interface IngresoPTPorProducto {
  producto: string;
  cantidad_kg: number;
  importe_total: number;
  clientes_count: number;
  ultima_fecha: string | null;
}

type ProductAccumulator = {
  producto: string;
  cantidad_kg: number;
  importe_total: number;
  clientes: Set<string>;
  ultima_fecha: string | null;
};

type LoteAccumulator = {
  producto: string;
  stock_pt_id: string;
  cantidad_kg: number;
  importe_estimado: number;
  clientes: Set<string>;
  ultima_fecha: string | null;
};

const latestDate = (current: string | null, candidate: string | null | undefined) => {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentTime = new Date(current).getTime();
  const candidateTime = new Date(candidate).getTime();
  if (Number.isNaN(candidateTime)) return current;
  if (Number.isNaN(currentTime) || candidateTime > currentTime) return candidate;
  return current;
};

const resolveProducto = (movimiento: MovimientoStockPT) =>
  (movimiento.nombre_producto || movimiento.producto_id || movimiento.stock_pt_id || 'Sin producto').trim();

export const buildIngresosPtPorProducto = (
  movimientosPT: MovimientoStockPT[] = [],
  ingresosFinancieros: IngresoPTFinancieroLink[] = [],
): IngresoPTPorProducto[] => {
  const ingresosPorStockPt = new Map<string, { monto: number; fecha: string | null }>();

  ingresosFinancieros.forEach((row) => {
    if (!row.stock_pt_id) return;
    const current = ingresosPorStockPt.get(row.stock_pt_id) ?? { monto: 0, fecha: null };
    current.monto += num(row.monto);
    current.fecha = latestDate(current.fecha, row.fecha ?? null);
    ingresosPorStockPt.set(row.stock_pt_id, current);
  });

  const lotes = new Map<string, LoteAccumulator>();

  movimientosPT
    .filter((movimiento) => salidaTypes.has(movimiento.tipo))
    .forEach((movimiento) => {
      const stockPtKey = movimiento.stock_pt_id ?? `mov-${movimiento.id}`;
      const producto = resolveProducto(movimiento);
      const current = lotes.get(stockPtKey) ?? {
        producto,
        stock_pt_id: stockPtKey,
        cantidad_kg: 0,
        importe_estimado: 0,
        clientes: new Set<string>(),
        ultima_fecha: null,
      };

      current.cantidad_kg += num(movimiento.cantidad);
      current.importe_estimado += num(movimiento.valor_total) > 0
        ? num(movimiento.valor_total)
        : num(movimiento.cantidad) * num(movimiento.costo_unitario);
      if (movimiento.cliente_id) current.clientes.add(movimiento.cliente_id);
      current.ultima_fecha = latestDate(current.ultima_fecha, movimiento.created_at);
      lotes.set(stockPtKey, current);
    });

  const acumulados = new Map<string, ProductAccumulator>();

  lotes.forEach((lote) => {
    const current = acumulados.get(lote.producto) ?? {
      producto: lote.producto,
      cantidad_kg: 0,
      importe_total: 0,
      clientes: new Set<string>(),
      ultima_fecha: null,
    };

    const finanzas = ingresosPorStockPt.get(lote.stock_pt_id);
    current.cantidad_kg += lote.cantidad_kg;
    current.importe_total += finanzas?.monto ?? lote.importe_estimado;
    lote.clientes.forEach((clienteId) => current.clientes.add(clienteId));
    current.ultima_fecha = latestDate(current.ultima_fecha, lote.ultima_fecha);
    current.ultima_fecha = latestDate(current.ultima_fecha, finanzas?.fecha ?? null);
    acumulados.set(lote.producto, current);
  });

  return [...acumulados.values()]
    .map((row) => ({
      producto: row.producto,
      cantidad_kg: Number(row.cantidad_kg.toFixed(3)),
      importe_total: Number(row.importe_total.toFixed(2)),
      clientes_count: row.clientes.size,
      ultima_fecha: row.ultima_fecha,
    }))
    .sort((a, b) => b.importe_total - a.importe_total || b.cantidad_kg - a.cantidad_kg);
};
