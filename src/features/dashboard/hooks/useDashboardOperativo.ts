import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardOperativoService } from '../services/dashboardOperativoService';
import type {
  ConsumoMensualInsumo,
  DashboardExpedicionInsights,
  DashboardOperativoKPIs,
  DashboardProductoTerminadoInsights,
  DashboardStockResumenes,
  FormulaComposicion,
} from '../types/operativo';

const EMPTY_KPI: DashboardOperativoKPIs = {
  stock_total_mp: 0,
  stock_comprometido_mp: 0,
  stock_disponible_mp: 0,
  stock_critico: 0,
  ordenes_pendientes: 0,
  ordenes_en_proceso: 0,
  ordenes_finalizadas: 0,
  produccion_total: 0,
  costo_promedio_produccion: 0,
  merma_total: 0,
  valor_inventario_mp: 0,
  stock_total_pt: 0,
  valor_inventario_pt: 0,
  proteina_promedio_formula: 0,
};

const EMPTY_RESUMENES: DashboardStockResumenes = {
  stockMateriaPrima: [],
  stockProductoTerminado: [],
};

const EMPTY_PT_INSIGHTS: DashboardProductoTerminadoInsights = {
  salidasPorProducto: [],
  participacionStock: [],
  entregasPorCliente: [],
};

const EMPTY_EXPEDICION_INSIGHTS: DashboardExpedicionInsights = {
  resumen: {
    expediciones_registradas: 0,
    expediciones_pendientes: 0,
    kg_expedidos: 0,
    clientes_atendidos: 0,
    producto_mas_expedido: 'Sin dato',
    kg_producto_mas_expedido: 0,
  },
  porProducto: [],
  porCliente: [],
};

export const useDashboardOperativo = () => {
  const [kpis, setKpis] = useState<DashboardOperativoKPIs>(EMPTY_KPI);
  const [formulas, setFormulas] = useState<FormulaComposicion[]>([]);
  const [consumoMensual, setConsumoMensual] = useState<ConsumoMensualInsumo[]>([]);
  const [stockResumenes, setStockResumenes] = useState<DashboardStockResumenes>(EMPTY_RESUMENES);
  const [ptInsights, setPtInsights] = useState<DashboardProductoTerminadoInsights>(EMPTY_PT_INSIGHTS);
  const [expedicionInsights, setExpedicionInsights] = useState<DashboardExpedicionInsights>(EMPTY_EXPEDICION_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setLoading(true);
      setLoadError(null);
      const [kpiData, extra, resumenes, ptInsightsData, expedicionInsightsData] = await Promise.all([
        dashboardOperativoService.getKPIs(),
        dashboardOperativoService.getComposicionYConsumo(),
        dashboardOperativoService.getStockResumenes(),
        dashboardOperativoService.getProductoTerminadoInsights(),
        dashboardOperativoService.getExpedicionInsights(),
      ]);
      setKpis(kpiData);
      setFormulas(extra.formulas);
      setConsumoMensual(extra.consumoMensual);
      setStockResumenes(resumenes);
      setPtInsights(ptInsightsData);
      setExpedicionInsights(expedicionInsightsData);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Error cargando dashboard operativo:', error);
      setLoadError('No se pudo cargar el dashboard ejecutivo.');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    const handleAlertasUpdated = () => {
      void reload();
    };

    const interval = window.setInterval(() => {
      void reload();
    }, 120000);

    window.addEventListener('alertas-updated', handleAlertasUpdated);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('alertas-updated', handleAlertasUpdated);
    };
  }, [reload]);

  return { kpis, formulas, consumoMensual, stockResumenes, ptInsights, expedicionInsights, loading, reload, lastUpdatedAt, loadError };
};
