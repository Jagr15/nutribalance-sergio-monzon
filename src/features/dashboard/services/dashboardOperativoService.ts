import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { ApiService } from '../../../infrastructure/api';
import { EstadoOrden } from '../../ordenes/types';
import { buildStockMPResumen } from '../../insumos/utils/stockResumen';
import { buildStockPTResumen } from '../../productos/utils/stockPtResumen';
import { buildProductoTerminadoInsights } from '../utils/productoTerminadoInsights';
import { buildOrdenesExpedicionInsights } from '../utils/ordenesExpedicionInsights';
import type {
  AlertaOperativaRaw,
  ConsumoMensualInsumo,
  DashboardOperativoKPIs,
  DashboardExpedicionInsights,
  DashboardProductoTerminadoInsights,
  DashboardStockResumenes,
  FormulaComposicion,
  TrazabilidadVisualRow,
} from '../types/operativo';

const num = (v: unknown) => Number(v ?? 0);
type DashboardStockResumenRow = {
  stock_total_mp: unknown;
  stock_critico: unknown;
  valor_inventario_mp: unknown;
  stock_total_pt: unknown;
  valor_inventario_pt: unknown;
};
type DashboardStockLotesRow = {
  cantidad_actual: unknown;
  cantidad_comprometida: unknown;
};
type DashboardProduccionResumenRow = {
  ordenes_pendientes: unknown;
  ordenes_en_proceso: unknown;
  ordenes_finalizadas: unknown;
  produccion_total: unknown;
  costo_promedio_produccion: unknown;
  merma_total: unknown;
};
type DashboardCostosProteinaRow = { proteina_promedio_formula: unknown };
type DashboardFormulaItem = { id_formula?: unknown; nombre_producto?: unknown; total_pct?: unknown; proteina_pct?: unknown };
type DashboardConsumoItem = { mes?: unknown; insumo?: unknown; consumo_kg?: unknown };
type DashboardCostosResumenPayloadRow = { formulas?: unknown; consumo_mensual?: unknown };

const monthKey = (isoLike: string | Date) => {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
};

const settledValue = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

const buildFallbackDashboard = async () => {
  const [stockLotes, stockPT, insumos, ordenes, formulas] = await Promise.all([
    ApiService.stockMP.getAllLotes(),
    ApiService.stockPT.getResumen(),
    ApiService.insumos.getAllInsumos(),
    ApiService.ordenes.getAll(),
    ApiService.formulas.findAll(),
  ]);

  const insumoById = new Map(insumos.map((i) => [i.uid, i]));
  const stockTotalMp = stockLotes.reduce((acc, lote) => acc + num(lote.cantidad_actual), 0);
  const stockComprometidoMp = stockLotes.reduce((acc, lote) => acc + num(lote.cantidad_comprometida), 0);
  const stockDisponibleMp = Math.max(0, stockTotalMp - stockComprometidoMp);
  const stockCritico = stockLotes.filter((lote) => {
    const umbral = num(insumoById.get(lote.id_insumo)?.umbral_alerta);
    const disponible = num(lote.cantidad_actual) - num(lote.cantidad_comprometida);
    return umbral > 0 && disponible <= umbral;
  }).length;
  const valorInventarioMp = stockLotes.reduce((acc, lote) => acc + num(lote.cantidad_actual) * num(lote.costo_unitario), 0);
  const stockTotalPt = stockPT.reduce((acc, lote) => acc + num((lote as { stock_actual?: unknown }).stock_actual), 0);

  const ordenesPendientes = ordenes.filter((o) => o.estado === EstadoOrden.PENDIENTE).length;
  const ordenesEnProceso = ordenes.filter((o) => o.estado === EstadoOrden.EN_PROCESO).length;
  const ordenesFinalizadas = ordenes.filter((o) => o.estado === EstadoOrden.FINALIZADO).length;
  const produccionTotal = ordenes
    .filter((o) => o.estado === EstadoOrden.FINALIZADO)
    .reduce((acc, o) => acc + num(o.cantidad_real ?? o.cantidad_objetivo), 0);
  const mermaTotal = ordenes.reduce((acc, o) => acc + num(o.merma_manual), 0);
  const costoPromedio = ordenes.length > 0
    ? ordenes.reduce((acc, o) => acc + num(o.costo_total_insumos), 0) / ordenes.length
    : 0;
  const valorInventarioPt = stockPT.reduce((acc, lote) => acc + num((lote as { valor_monetario?: unknown }).valor_monetario), 0);

  const formulaComposicion: FormulaComposicion[] = formulas
    .filter((f) => f.esta_activa)
    .flatMap((f) => f.ingredientes.map((ing) => ({
      id_formula: f.uid,
      nombre_producto: ing.nombre_insumo,
      total_pct: num(ing.porcentaje),
      proteina_pct: num(ing.aporte_proteina_pct),
    })))
    .sort((a, b) => b.total_pct - a.total_pct);

  const consumoMensual = ordenes.flatMap((o) =>
    (o.detalle_insumos ?? []).map((d) => ({
      mes: monthKey(o.fecha_creacion),
      insumo: d.nombre_insumo,
      consumo_kg: num(d.cantidad_usada),
    }))
  );

  const proteinRows = formulas
    .map((f) => num(f.proteina_calculada_pct))
    .filter((v) => v > 0);
  const proteinaPromedio = proteinRows.length > 0 ? proteinRows.reduce((a, b) => a + b, 0) / proteinRows.length : 0;

  return {
    kpis: {
      stock_total_mp: stockTotalMp,
      stock_comprometido_mp: stockComprometidoMp,
      stock_disponible_mp: stockDisponibleMp,
      stock_critico: stockCritico,
      ordenes_pendientes: ordenesPendientes,
      ordenes_en_proceso: ordenesEnProceso,
      ordenes_finalizadas: ordenesFinalizadas,
      produccion_total: produccionTotal,
      costo_promedio_produccion: costoPromedio,
      merma_total: mermaTotal,
      valor_inventario_mp: valorInventarioMp,
      stock_total_pt: stockTotalPt,
      valor_inventario_pt: valorInventarioPt,
      proteina_promedio_formula: proteinaPromedio,
    } satisfies DashboardOperativoKPIs,
    formulas: formulaComposicion,
    consumoMensual,
  };
};

const buildFallbackStockResumenes = async (): Promise<DashboardStockResumenes> => {
  const [stockLotes, stockPT, insumos, movimientosPT] = await Promise.allSettled([
    ApiService.stockMP.getAllLotes(),
    ApiService.stockPT.getAll(),
    ApiService.insumos.getAllInsumos(),
    ApiService.stockPT.getMovimientos(),
  ]);

  const lotes = settledValue(stockLotes, []);
  const pt = settledValue(stockPT, []);
  const insumosList = settledValue(insumos, []);
  const movimientosList = settledValue(movimientosPT, []);

  return {
    stockMateriaPrima: buildStockMPResumen(lotes, insumosList),
    stockProductoTerminado: buildStockPTResumen(pt, movimientosList),
  };
};

const buildFallbackProductoTerminadoInsights = async (): Promise<DashboardProductoTerminadoInsights> => {
  const [stockPT, movimientosPT, clientes] = await Promise.allSettled([
    ApiService.stockPT.getResumen(),
    ApiService.stockPT.getMovimientos(),
    ApiService.clientes.getAll(),
  ]);

  return buildProductoTerminadoInsights(
    settledValue(stockPT, []),
    settledValue(movimientosPT, []),
    settledValue(clientes, []),
  );
};

const buildFallbackExpedicionInsights = async (): Promise<DashboardExpedicionInsights> => {
  const [expediciones, clientes] = await Promise.allSettled([
    ApiService.ordenesExpedicion.getAll(),
    ApiService.clientes.getAll(),
  ]);

  return buildOrdenesExpedicionInsights(
    settledValue(expediciones, []),
    settledValue(clientes, []),
  );
};

export const dashboardOperativoService = {
  async getStockResumenes(): Promise<DashboardStockResumenes> {
    try {
      const [stockMateriaPrima, stockProductoTerminado] = await Promise.all([
        ApiService.stockMP.getResumen(),
        ApiService.stockPT.getResumen(),
      ]);

      return {
        stockMateriaPrima,
        stockProductoTerminado,
      };
    } catch {
      return buildFallbackStockResumenes();
    }
  },

  async getKPIs(): Promise<DashboardOperativoKPIs> {
    try {
      const [stockR, prodR, costR] = await Promise.all([
        supabaseClient.from('vw_dashboard_stock_resumen').select('*').single<DashboardStockResumenRow>(),
        supabaseClient.from('vw_dashboard_produccion_resumen').select('*').single<DashboardProduccionResumenRow>(),
        supabaseClient.from('vw_dashboard_costos_resumen').select('proteina_promedio_formula').single<DashboardCostosProteinaRow>(),
      ]);

      const stockLotsQuery = await supabaseClient
        .from('stock_lotes_mp')
        .select('cantidad_actual,cantidad_comprometida')
        .is('deleted_at', null);

      if (stockR.error) throw stockR.error;
      if (prodR.error) throw prodR.error;
      if (costR.error) throw costR.error;
      if (stockLotsQuery.error) throw stockLotsQuery.error;

      const stockLots = (stockLotsQuery.data ?? []) as DashboardStockLotesRow[];
      const stockComprometidoMp = stockLots.reduce((acc, lote) => acc + num(lote.cantidad_comprometida), 0);
      const stockTotalMp = stockLots.reduce((acc, lote) => acc + num(lote.cantidad_actual), 0);
      const stockDisponibleMp = Math.max(0, stockTotalMp - stockComprometidoMp);

      return {
        stock_total_mp: stockTotalMp,
        stock_comprometido_mp: stockComprometidoMp,
        stock_disponible_mp: stockDisponibleMp,
        stock_critico: num(stockR.data.stock_critico),
        valor_inventario_mp: num(stockR.data.valor_inventario_mp),
        stock_total_pt: num(stockR.data.stock_total_pt),
        valor_inventario_pt: num(stockR.data.valor_inventario_pt),
        ordenes_pendientes: num(prodR.data.ordenes_pendientes),
        ordenes_en_proceso: num(prodR.data.ordenes_en_proceso),
        ordenes_finalizadas: num(prodR.data.ordenes_finalizadas),
        produccion_total: num(prodR.data.produccion_total),
        costo_promedio_produccion: num(prodR.data.costo_promedio_produccion),
        merma_total: num(prodR.data.merma_total),
        proteina_promedio_formula: num(costR.data.proteina_promedio_formula),
      };
    } catch {
      const fallback = await buildFallbackDashboard();
      return fallback.kpis;
    }
  },

  async getComposicionYConsumo(): Promise<{ formulas: FormulaComposicion[]; consumoMensual: ConsumoMensualInsumo[] }> {
    try {
      const { data, error } = await supabaseClient
        .from('vw_dashboard_costos_resumen')
        .select('formulas,consumo_mensual')
        .single<DashboardCostosResumenPayloadRow>();

      if (error) throw error;

      const formulas = Array.isArray(data.formulas) ? data.formulas : [];
      const consumoMensual = Array.isArray(data.consumo_mensual) ? data.consumo_mensual : [];

      return {
        formulas: formulas.map((f) => {
          const row = f as DashboardFormulaItem;
          return {
            id_formula: String(row.id_formula ?? ''),
            nombre_producto: String(row.nombre_producto ?? 'Sin nombre'),
            total_pct: num(row.total_pct),
            proteina_pct: num(row.proteina_pct),
          };
        }),
        consumoMensual: consumoMensual.map((c) => {
          const row = c as DashboardConsumoItem;
          return {
            mes: String(row.mes ?? ''),
            insumo: String(row.insumo ?? 'Sin insumo'),
            consumo_kg: num(row.consumo_kg),
          };
        }),
      };
    } catch {
      const fallback = await buildFallbackDashboard();
      return {
        formulas: fallback.formulas,
        consumoMensual: fallback.consumoMensual,
      };
    }
  },

  async getProductoTerminadoInsights(): Promise<DashboardProductoTerminadoInsights> {
    try {
      const [stockPT, movimientosPT, clientes] = await Promise.all([
        ApiService.stockPT.getResumen(),
        ApiService.stockPT.getMovimientos(),
        ApiService.clientes.getAll(),
      ]);

      return buildProductoTerminadoInsights(stockPT, movimientosPT, clientes);
    } catch {
      return buildFallbackProductoTerminadoInsights();
    }
  },

  async getExpedicionInsights(): Promise<DashboardExpedicionInsights> {
    try {
      const [expediciones, clientes] = await Promise.all([
        ApiService.ordenesExpedicion.getAll(),
        ApiService.clientes.getAll(),
      ]);

      return buildOrdenesExpedicionInsights(expediciones, clientes);
    } catch {
      return buildFallbackExpedicionInsights();
    }
  },

  async getAlertasOperativas(): Promise<AlertaOperativaRaw[]> {
    try {
      const { data, error } = await supabaseClient
        .from('vw_dashboard_alertas_operativas')
        .select('*')
        .order('fecha_evento', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AlertaOperativaRaw[];
    } catch {
      const [stockLotes, insumos, ordenes] = await Promise.all([
        ApiService.stockMP.getAllLotes(),
        ApiService.insumos.getAllInsumos(),
        ApiService.ordenes.getAll(),
      ]);
      const insumoById = new Map(insumos.map((i) => [i.uid, i]));
      const stockAlerts: AlertaOperativaRaw[] = stockLotes
        .filter((l) => num(insumoById.get(l.id_insumo)?.umbral_alerta) > 0 && num(l.cantidad_actual) <= num(insumoById.get(l.id_insumo)?.umbral_alerta))
        .slice(0, 3)
        .map((l) => ({
          alerta_id: `stock-${l.uid}`,
          tipo: 'Stock por debajo del umbral',
          prioridad: num(l.cantidad_actual) <= num(insumoById.get(l.id_insumo)?.umbral_alerta) * 0.5 ? 'critica' : 'media',
          area: 'stock',
          titulo: `${insumoById.get(l.id_insumo)?.nombre ?? l.id_insumo} en nivel bajo`,
          dato_asociado: { lote: l.lote, disponible_kg: l.cantidad_actual, umbral_kg: insumoById.get(l.id_insumo)?.umbral_alerta ?? 0 },
          fecha_evento: new Date().toISOString(),
        }));
      const ordenAlerts: AlertaOperativaRaw[] = ordenes
        .filter((o) => o.estado === EstadoOrden.PENDIENTE || o.estado === EstadoOrden.EN_PROCESO)
        .slice(0, 2)
        .map((o) => ({
          alerta_id: `orden-${o.id}`,
          tipo: 'Seguimiento de orden activa',
          prioridad: o.estado === EstadoOrden.EN_PROCESO ? 'media' : 'informativa',
          area: 'produccion',
          titulo: `${o.lote} ${o.estado.toLowerCase()}`,
          dato_asociado: { lote: o.lote, estado: o.estado, cantidad_objetivo: o.cantidad_objetivo },
          fecha_evento: new Date().toISOString(),
        }));
      return [...stockAlerts, ...ordenAlerts];
    }
  },

  async getTrazabilidad(): Promise<TrazabilidadVisualRow[]> {
    try {
      const { data, error } = await supabaseClient
        .from('vw_dashboard_trazabilidad')
        .select('*')
        .order('fecha_evento', { ascending: false });

      if (error) throw error;
      return (data ?? []) as TrazabilidadVisualRow[];
    } catch {
      return [];
    }
  },
};
