import { ControlEstado, type MovimientoStockPT, type StockProductoTerminado, type StockProductoTerminadoResumen } from '../types';

const num = (value: unknown) => Number(value ?? 0);

const stateRank: Record<StockProductoTerminado['estado'], number> = {
  OK: 0,
  BAJO: 1,
  CRITICO: 2,
};

const pickWorstState = (states: Array<StockProductoTerminado['estado'] | undefined>): StockProductoTerminado['estado'] => {
  const ranked = states.filter(Boolean).sort((a, b) => stateRank[b as StockProductoTerminado['estado']] - stateRank[a as StockProductoTerminado['estado']]);
  return ranked[0] ?? ControlEstado.OK;
};

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
    const key = mov.producto_id ?? mov.nombre_producto;
    const current = movimientosByProducto.get(key) ?? [];
    current.push(mov);
    movimientosByProducto.set(key, current);
  });

  const grouped = new Map<string, StockProductoTerminado[]>();
  stock.forEach((item) => {
    const key = item.nombre_producto.trim().toLowerCase();
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  });

  return [...grouped.entries()].map(([key, items]) => {
    const sortedByDate = [...items].sort((a, b) => {
      const aDate = new Date(a.updateAt || a.fecha_ingreso).getTime();
      const bDate = new Date(b.updateAt || b.fecha_ingreso).getTime();
      return aDate - bDate;
    });
    const latestItem = sortedByDate[sortedByDate.length - 1] ?? items[0];
    const saldoActual = items.reduce((acc, item) => acc + num(item.cantidad_total), 0);
    const valorMonetario = items.reduce(
      (acc, item) => acc + num(item.cantidad_total) * num(item.costo_unitario_estimado),
      0
    );
    const cantidadLotes = items.length;
    const ultimaActualizacion = latestItem?.updateAt || latestItem?.fecha_ingreso || '';
    const numeroOrden = latestItem?.numero_orden || latestItem?.id_orden || null;
    const idFormula = latestItem?.id_formula ?? null;
    const versionFormula = typeof latestItem?.version_formula === 'number' ? latestItem.version_formula : null;
    const movimientosDelProducto = movimientosByProducto.get(items[0].nombre_producto) ?? movimientosByProducto.get(key) ?? [];
    const tieneMovimientos = movimientosDelProducto.length > 0;
    const estado = tieneMovimientos ? pickWorstState(
      items.map((item) => getStateFromBalance(num(item.cantidad_total), item.cantidad_inicial, item.estado))
    ) : pickWorstState(
      items.map((item) => getStateFromBalance(num(item.cantidad_total), item.cantidad_inicial, item.estado))
    );

    return {
      producto_id: idFormula,
      nombre_producto: items[0].nombre_producto,
      unidad: items[0].unidad_medida,
      stock_actual: saldoActual,
      valor_monetario: valorMonetario,
      estado,
      cantidad_lotes: cantidadLotes,
      ultima_actualizacion: ultimaActualizacion,
      numero_orden: numeroOrden,
      id_formula: idFormula,
      version_formula: versionFormula,
    };
  }).sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto));
};
