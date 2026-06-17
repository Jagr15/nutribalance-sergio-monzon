import { useCallback, useEffect, useState } from 'react';
import { finanzasService } from '../services/finanzasService';
import type { CostosFormulaVsReal, FinanzasInventarioResumen, FinanzasKPIs, FinanzasReportes, MovimientoFinanciero } from '../types';

const EMPTY_KPIS: FinanzasKPIs = {
  saldo_actual: 0,
  ingresos_mes: 0,
  egresos_mes: 0,
  flujo_neto: 0,
  margen_operativo: 0,
  costo_produccion: 0,
  valorizacion_inventario: 0,
  cuentas_por_pagar: 0,
  cuentas_por_cobrar: 0,
  perdida_merma: 0,
  valor_stock_mp: 0,
  valor_stock_pt: 0,
  valor_inventario_total: 0,
};

const EMPTY_REPORTES: FinanzasReportes = {
  flujo_caja_mensual: [],
  gastos_por_categoria: [],
  ingresos_por_categoria: [],
  rentabilidad_por_formula: [],
  costo_operativo_mensual: [],
};

export const useFinanzas = () => {
  const [kpis, setKpis] = useState<FinanzasKPIs>(EMPTY_KPIS);
  const [reportes, setReportes] = useState<FinanzasReportes>(EMPTY_REPORTES);
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [costosComparativos, setCostosComparativos] = useState<CostosFormulaVsReal[]>([]);
  const [inventario, setInventario] = useState<FinanzasInventarioResumen>({
    valor_stock_mp: 0,
    valor_stock_pt: 0,
    valor_inventario_total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setInfoMessage(null);
    const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
    const [kpisResult, reportesResult, movimientosResult, costosResult, inventarioResult] = await Promise.allSettled([
      finanzasService.getKPIs(),
      finanzasService.getReportes(),
      finanzasService.getMovimientos(),
      finanzasService.getCostosComparativos(),
      finanzasService.getInventarioResumen(),
    ]);

    if (kpisResult.status === 'fulfilled') setKpis(kpisResult.value);
    else setKpis(EMPTY_KPIS);

    if (reportesResult.status === 'fulfilled') setReportes(reportesResult.value);
    else setReportes(EMPTY_REPORTES);

    if (movimientosResult.status === 'fulfilled') setMovimientos(movimientosResult.value);
    else setMovimientos([]);

    if (costosResult.status === 'fulfilled') setCostosComparativos(costosResult.value);
    else setCostosComparativos([]);

    if (inventarioResult.status === 'fulfilled') setInventario(inventarioResult.value);
    else setInventario({ valor_stock_mp: 0, valor_stock_pt: 0, valor_inventario_total: 0 });

    const failed = [kpisResult, reportesResult, movimientosResult, costosResult, inventarioResult].filter((r) => r.status === 'rejected');
    let fallbackApplied = false;
    if (useMocks || failed.length > 0) {
      try {
        const fallback = await finanzasService.getOperationalFallback();
        setKpis(fallback.kpis);
        setReportes(fallback.reportes);
        setCostosComparativos(fallback.costosComparativos);
        setInventario(fallback.inventario);
        if (movimientosResult.status !== 'fulfilled') {
          setMovimientos(fallback.movimientos);
        }
        setInfoMessage('Datos financieros estimados desde operación local');
        fallbackApplied = true;
      } catch {
        if (failed.length > 0) {
          setLoadError('No pudimos cargar la información financiera');
        }
      }
    }
    if (!useMocks && failed.length > 0 && !fallbackApplied) {
      setLoadError('No pudimos cargar la información financiera');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return { kpis, reportes, movimientos, costosComparativos, inventario, loading, loadError, infoMessage, refresh, createMovimiento: finanzasService.createMovimiento };
};
