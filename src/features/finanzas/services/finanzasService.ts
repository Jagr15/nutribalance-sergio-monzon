import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { ApiService } from '../../../infrastructure/api';
import type { CostosFormulaVsReal, FinanzasInventarioResumen, FinanzasKPIs, FinanzasReportes, MovimientoFinanciero } from '../types';
import { normalizeKpis } from '../utils/finanzasCalculations';
import { buildCostosFormulaVsReal } from '../utils/costosFormulaVsReal';
import { buildIngresosPtPorProducto } from '../utils/ingresosPtPorProducto';
import { assertPermission } from '../../auth/accessControl';
import { auditAction } from '../../auth/audit';

export interface CrearMovimientoPayload {
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  descripcion: string;
  monto: number;
  origen_operativo?: string;
  categoria_id?: string;
  centro_costo_id?: string;
  estado?: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
}
type FinanzasReportesRow = { payload?: Record<string, unknown> };
type CategoriaNested = { nombre?: string } | null;
type CentroCostoNested = { nombre?: string } | null;
type FlujoCajaMovimientoRow = {
  legacy_uid?: string | null;
  fecha: string;
  tipo: MovimientoFinanciero['tipo'];
  origen_operativo?: string | null;
  descripcion: string;
  monto?: number | string | null;
  categorias_financieras?: CategoriaNested;
  centros_costo?: CentroCostoNested;
  estado: MovimientoFinanciero['estado'];
};
type CostosFormulaVsRealRow = {
  producto_formula_id: string | null;
  nombre_producto: string;
  version_formula: number | null;
  costo_formulado_kg: number | string | null;
  costo_formulado_ton: number | string | null;
  costo_real_kg: number | string | null;
  costo_real_ton: number | string | null;
  variacion_abs: number | string | null;
  variacion_pct: number | string | null;
  ultima_op: string | null;
};

const emptyReportes: FinanzasReportes = {
  flujo_caja_mensual: [],
  gastos_por_categoria: [],
  ingresos_por_categoria: [],
  ingresos_pt_por_producto: [],
  rentabilidad_por_formula: [],
  costo_operativo_mensual: [],
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const num = (value: unknown) => Number(value ?? 0);

export const finanzasService = {
  async getKPIs(): Promise<FinanzasKPIs> {
    const { data, error } = await supabaseClient.from('vw_finanzas_kpis').select('*').single<Record<string, unknown>>();
    if (error) throw error;
    return normalizeKpis(data ?? {});
  },

  async getReportes(): Promise<FinanzasReportes> {
    const { data, error } = await supabaseClient.from('vw_finanzas_reportes').select('payload').single<FinanzasReportesRow>();
    if (error) throw error;
    const payload = (data?.payload ?? {}) as Record<string, unknown>;
    const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
    return {
      flujo_caja_mensual: asArray<FinanzasReportes['flujo_caja_mensual'][number]>(payload.flujo_caja_mensual),
      gastos_por_categoria: asArray<FinanzasReportes['gastos_por_categoria'][number]>(payload.gastos_por_categoria),
      ingresos_por_categoria: asArray<FinanzasReportes['ingresos_por_categoria'][number]>(payload.ingresos_por_categoria),
      ingresos_pt_por_producto: asArray<FinanzasReportes['ingresos_pt_por_producto'][number]>(payload.ingresos_pt_por_producto),
      rentabilidad_por_formula: asArray<FinanzasReportes['rentabilidad_por_formula'][number]>(payload.rentabilidad_por_formula),
      costo_operativo_mensual: asArray<FinanzasReportes['costo_operativo_mensual'][number]>(payload.costo_operativo_mensual),
    };
  },

  async getMovimientos(): Promise<MovimientoFinanciero[]> {
    const { data, error } = await supabaseClient
      .from('flujo_caja_movimientos')
      .select('legacy_uid,fecha,tipo,origen_operativo,descripcion,monto,estado,categorias_financieras(nombre),centros_costo(nombre)')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as FlujoCajaMovimientoRow[]).map((row) => ({
      uid: row.legacy_uid ?? crypto.randomUUID(),
      fecha: row.fecha,
      tipo: row.tipo,
      origen_operativo: row.origen_operativo ?? undefined,
      descripcion: row.descripcion,
      monto: Number(row.monto ?? 0),
      categoria: row.categorias_financieras?.nombre,
      centro_costo: row.centros_costo?.nombre,
      estado: row.estado,
    }));
  },

  async getCostosComparativos(): Promise<CostosFormulaVsReal[]> {
    const { data, error } = await supabaseClient
      .from('vw_costos_formula_vs_real')
      .select('producto_formula_id,nombre_producto,version_formula,costo_formulado_kg,costo_formulado_ton,costo_real_kg,costo_real_ton,variacion_abs,variacion_pct,ultima_op')
      .order('nombre_producto', { ascending: true });

    if (error) throw error;

    return ((data ?? []) as CostosFormulaVsRealRow[]).map((row) => ({
      producto_formula_id: row.producto_formula_id ?? '',
      nombre_producto: row.nombre_producto,
      version_formula: row.version_formula === null ? null : Number(row.version_formula),
      costo_formulado_kg: num(row.costo_formulado_kg),
      costo_formulado_ton: num(row.costo_formulado_ton),
      costo_real_kg: num(row.costo_real_kg),
      costo_real_ton: num(row.costo_real_ton),
      variacion_abs: num(row.variacion_abs),
      variacion_pct: num(row.variacion_pct),
      ultima_op: row.ultima_op,
    }));
  },

  async getInventarioResumen(): Promise<FinanzasInventarioResumen> {
    const [lotesMp, resumenPt] = await Promise.all([
      ApiService.stockMP.getAllLotes(),
      ApiService.stockPT.getResumen(),
    ]);

    const valorStockMp = sum(lotesMp.map((lote) => Number(lote.cantidad_actual ?? 0) * Number(lote.costo_unitario ?? 0)));
    const valorStockPt = sum(resumenPt.map((item) => Number(item.valor_monetario ?? 0)));
    return {
      valor_stock_mp: valorStockMp,
      valor_stock_pt: valorStockPt,
      valor_inventario_total: valorStockMp + valorStockPt,
    };
  },

  async createMovimiento(payload: CrearMovimientoPayload): Promise<void> {
    assertPermission('finanzas', 'register_financial_movement');
    const descripcion = payload.descripcion?.trim();
    if (!descripcion) {
      throw new Error('La descripción es obligatoria.');
    }
    if (!Number.isFinite(payload.monto) || payload.monto <= 0) {
      throw new Error('El monto debe ser mayor a 0.');
    }
    if (!['INGRESO', 'EGRESO', 'TRANSFERENCIA'].includes(payload.tipo)) {
      throw new Error('Tipo de movimiento inválido.');
    }
    const uniqueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `fin-${crypto.randomUUID()}`
      : `fin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const { error } = await supabaseClient.from('flujo_caja_movimientos').insert({
      legacy_uid: uniqueId,
      fecha: new Date().toISOString(),
      tipo: payload.tipo,
      descripcion,
      monto: payload.monto,
      origen_operativo: payload.origen_operativo ?? 'MANUAL',
      categoria_id: payload.categoria_id ?? null,
      centro_costo_id: payload.centro_costo_id ?? null,
      estado: payload.estado ?? 'CONFIRMADO',
      metadata: {},
    });

    if (error) throw error;
    await auditAction({
      modulo: 'finanzas',
      accion: 'register_financial_movement',
      entidad: 'flujo_caja_movimiento',
      payload: {
        tipo: payload.tipo,
        descripcion,
        monto: payload.monto,
        origen_operativo: payload.origen_operativo ?? 'MANUAL',
      },
    });
  },

  async getOperationalFallback(): Promise<{ kpis: FinanzasKPIs; reportes: FinanzasReportes; movimientos: MovimientoFinanciero[]; costosComparativos: CostosFormulaVsReal[]; inventario: FinanzasInventarioResumen }> {
    const [ordenes, lotes, formulas, resumenPt, movimientosPt] = await Promise.all([
      ApiService.ordenes.getAll(),
      ApiService.stockMP.getAllLotes(),
      ApiService.formulas.findAll(),
      ApiService.stockPT.getResumen(),
      ApiService.stockPT.getMovimientos(),
    ]);

    const costoProduccion = ordenes.reduce((acc, orden) => acc + Number(orden.costo_total_insumos ?? 0), 0);
    const valorStockMp = lotes.reduce(
      (acc, lote) => acc + Number(lote.cantidad_actual ?? 0) * Number(lote.costo_unitario ?? 0),
      0,
    );
    const valorStockPt = resumenPt.reduce((acc, item) => acc + Number(item.valor_monetario ?? 0), 0);
    const valorizacionInventario = valorStockMp + valorStockPt;

    const perdidaMerma = ordenes.reduce((acc, orden) => {
      const mermaPct = Number(orden.merma_manual ?? 0);
      const cantidadObjetivo = Number(orden.cantidad_objetivo ?? 0);
      const costoUnitEstimado = cantidadObjetivo > 0
        ? Number(orden.costo_total_insumos ?? 0) / cantidadObjetivo
        : 0;
      return acc + ((mermaPct / 100) * cantidadObjetivo * costoUnitEstimado);
    }, 0);

    const costoPorMesMap = new Map<string, number>();
    ordenes.forEach((orden) => {
      const date = new Date(orden.fecha_creacion);
      if (Number.isNaN(date.getTime())) return;
      const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      costoPorMesMap.set(mes, (costoPorMesMap.get(mes) ?? 0) + Number(orden.costo_total_insumos ?? 0));
    });
    const costoOperativoMensual = [...costoPorMesMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, monto]) => ({ mes, monto }));

    const flujoCajaMensual = costoOperativoMensual.map(({ mes, monto }) => ({
      mes,
      ingresos: 0,
      egresos: monto,
      neto: -monto,
    }));

    const formulasCostMap = new Map(
      formulas.map((f) => [f.uid, Number(f.costo_por_kg ?? 0)]),
    );
    const rentabilidadPorFormula = formulas.map((f) => {
      const kgTotal = ordenes
        .filter((orden) => orden.id_formula === f.uid || orden.nombre_producto === f.nombre_producto)
        .reduce((acc, orden) => acc + Number(orden.cantidad_objetivo ?? 0), 0);
      return {
        id_formula: f.uid,
        nombre_producto: f.nombre_producto,
        costo_total: kgTotal * Number(f.costo_por_kg ?? 0),
        kg_total: kgTotal,
        costo_promedio_kg: Number(f.costo_por_kg ?? 0),
      };
    }).filter((row) => row.costo_total > 0 || row.kg_total > 0 || formulasCostMap.get(row.id_formula));

    const reportes: FinanzasReportes = {
      ...emptyReportes,
      flujo_caja_mensual: flujoCajaMensual,
      gastos_por_categoria: [
        { categoria: 'Producción', monto: costoProduccion },
        { categoria: 'Merma', monto: perdidaMerma },
      ].filter((row) => row.monto > 0),
      ingresos_por_categoria: [],
      ingresos_pt_por_producto: buildIngresosPtPorProducto(movimientosPt),
      rentabilidad_por_formula: rentabilidadPorFormula,
      costo_operativo_mensual: costoOperativoMensual,
    };

    const kpis: FinanzasKPIs = {
      saldo_actual: 0,
      ingresos_mes: 0,
      egresos_mes: flujoCajaMensual.length > 0 ? flujoCajaMensual[flujoCajaMensual.length - 1].egresos : 0,
      flujo_neto: flujoCajaMensual.length > 0 ? flujoCajaMensual[flujoCajaMensual.length - 1].neto : 0,
      margen_operativo: 0,
      costo_produccion: costoProduccion,
      valorizacion_inventario: valorizacionInventario,
      cuentas_por_pagar: 0,
      cuentas_por_cobrar: 0,
      perdida_merma: perdidaMerma,
      valor_stock_mp: valorStockMp,
      valor_stock_pt: valorStockPt,
      valor_inventario_total: valorizacionInventario,
    };

    return {
      kpis,
      reportes,
      movimientos: [],
      costosComparativos: buildCostosFormulaVsReal(formulas, ordenes),
      inventario: {
        valor_stock_mp: valorStockMp,
        valor_stock_pt: valorStockPt,
        valor_inventario_total: valorizacionInventario,
      },
    };
  },
};
