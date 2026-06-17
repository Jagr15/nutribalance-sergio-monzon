import type { Formula } from '../../formulas/types';
import type { OrdenProduccion } from '../../ordenes/types';

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

const round6 = (value: number) => Number(value.toFixed(6));

const getFormulaKey = (formula?: Formula | null) => formula?.uid ?? '';

const getOrderFormulaKey = (orden: OrdenProduccion) => orden.id_formula || orden.nombre_producto;

const getLastOperationLabel = (orden: OrdenProduccion) => orden.lote?.trim() || orden.id;

export const buildCostosFormulaVsReal = (formulas: Formula[], ordenes: OrdenProduccion[]): CostosFormulaVsReal[] => {
  const finalizedOrders = ordenes.filter((orden) => orden.estado === 'FINALIZADO');
  const ordersByFormula = new Map<string, OrdenProduccion[]>();

  finalizedOrders.forEach((orden) => {
    const key = getOrderFormulaKey(orden);
    const current = ordersByFormula.get(key) ?? [];
    current.push(orden);
    ordersByFormula.set(key, current);
  });

  return formulas.map((formula) => {
    const ordersForFormula = ordersByFormula.get(getFormulaKey(formula)) ?? ordersByFormula.get(formula.nombre_producto) ?? [];
    if (ordersForFormula.length === 0) {
      return {
        producto_formula_id: getFormulaKey(formula),
        nombre_producto: formula.nombre_producto,
        version_formula: formula.version ?? null,
        costo_formulado_kg: round6(Number(formula.costo_por_kg ?? 0)),
        costo_formulado_ton: round6(Number(formula.costo_por_tonelada ?? Number(formula.costo_por_kg ?? 0) * 1000)),
        costo_real_kg: 0,
        costo_real_ton: 0,
        variacion_abs: 0,
        variacion_pct: 0,
        ultima_op: null,
      };
    }

    const totalCostoReal = ordersForFormula.reduce((acc, orden) => acc + Number(orden.costo_total_insumos ?? 0), 0);
    const totalCantidadReal = ordersForFormula.reduce((acc, orden) => acc + Number(orden.cantidad_real ?? orden.cantidad_objetivo ?? 0), 0);
    const latestOrder = [...ordersForFormula].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime())[0] ?? null;

    const costoFormuladoKg = Number(formula.costo_por_kg ?? 0);
    const costoFormuladoTon = Number(formula.costo_por_tonelada ?? costoFormuladoKg * 1000);
    const costoRealKg = totalCantidadReal > 0 ? round6(totalCostoReal / totalCantidadReal) : 0;
    const costoRealTon = round6(costoRealKg * 1000);
    const variacionAbs = round6(costoRealKg - costoFormuladoKg);
    const variacionPct = costoFormuladoKg > 0 ? round6((variacionAbs / costoFormuladoKg) * 100) : 0;

    return {
      producto_formula_id: getFormulaKey(formula),
      nombre_producto: formula.nombre_producto,
      version_formula: formula.version ?? null,
      costo_formulado_kg: round6(costoFormuladoKg),
      costo_formulado_ton: round6(costoFormuladoTon),
      costo_real_kg: round6(costoRealKg),
      costo_real_ton: round6(costoRealTon),
      variacion_abs: round6(variacionAbs),
      variacion_pct: round6(variacionPct),
      ultima_op: latestOrder ? getLastOperationLabel(latestOrder) : null,
    };
  }).sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto));
};
