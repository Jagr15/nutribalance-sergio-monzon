import { ControlEstado, type MovimientoStockPT, type StockProductoTerminado, type StockProductoTerminadoResumen } from '../types';

const num = (value: unknown) => Number(value ?? 0);

const getStateFromBalance = (saldo: number, inicial?: number | null, fallback: StockProductoTerminado['estado'] = ControlEstado.OK) => {
  if (!Number.isFinite(saldo)) return fallback;
  const base = num(inicial);
  if (base <= 0) return fallback;
  const ratio = saldo / base;
  if (ratio <= 0.2) return ControlEstado.CRITICO;
  if (ratio <= 0.4) return ControlEstado.BAJO;
  return ControlEstado.OK;
};

export const buildStockPTResumen = (
  stock: StockProductoTerminado[],
  movimientos: MovimientoStockPT[] = [],
): StockProductoTerminadoResumen[] => {
  const movimientosByProducto = new Map<string, MovimientoStockPT[]>();
  movimientos.forEach((mov) => {
    const key = mov.stock_pt_id ?? mov.producto_id ?? `${mov.nombre_producto}-${mov.lote}`;
    const current = movimientosByProducto.get(key) ?? [];
    current.push(mov);
    movimientosByProducto.set(key, current);
  });

  return stock.map((item) => {
    const key = item.uid ?? `${item.id_orden}-${item.lote}`;
    const movimientosDelProducto = movimientosByProducto.get(key) ?? [];
    const saldoActual = num(item.cantidad_total);
    const valorMonetario = saldoActual * num(item.costo_unitario_estimado);
    const estado = movimientosDelProducto.length > 0
      ? getStateFromBalance(saldoActual, item.cantidad_inicial, item.estado)
      : getStateFromBalance(saldoActual, item.cantidad_inicial, item.estado);

    return {
      producto_id: item.uid,
      nombre_producto: item.nombre_producto,
      unidad: item.unidad_medida,
      stock_actual: saldoActual,
      valor_monetario: valorMonetario,
      estado,
      cantidad_lotes: 1,
      ultima_actualizacion: item.updateAt || item.fecha_ingreso || '',
      numero_orden: item.numero_orden || item.id_orden || null,
      id_formula: item.id_formula ?? null,
      version_formula: typeof item.version_formula === 'number' ? item.version_formula : null,
    };
  }).sort((a, b) => {
    const dateA = new Date(a.ultima_actualizacion).getTime();
    const dateB = new Date(b.ultima_actualizacion).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return a.nombre_producto.localeCompare(b.nombre_producto);
  });
};
