import { useCallback, useEffect, useState } from 'react';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';
import { finanzasService } from '../services/finanzasService';
import type { CostosFormulaVsReal, FinanzasInventarioResumen, FinanzasKPIs, FinanzasReportes, FinanzasTesoreriaInsights, MovimientoFinanciero } from '../types';
import { calcularCuentasPorCobrar, calcularCuentasPorPagar, obtenerMontoPendiente } from '../utils/finanzasCalculations';

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
  ingresos_pt_por_producto: [],
  rentabilidad_por_formula: [],
  costo_operativo_mensual: [],
};

const EMPTY_TESORERIA: FinanzasTesoreriaInsights = {
  presupuestoVsReal: [],
  gastosPorRubro: [],
  variacionesPorRubro: [],
  carteraClientes: [],
  chequesEmitidos: [],
  chequesRecibidos: [],
  proyeccionFlujo: [],
  alertasTesoreria: [],
};

export const useFinanzas = () => {
  const [kpis, setKpis] = useState<FinanzasKPIs>(EMPTY_KPIS);
  const [reportes, setReportes] = useState<FinanzasReportes>(EMPTY_REPORTES);
  const [tesoreria, setTesoreria] = useState<FinanzasTesoreriaInsights>(EMPTY_TESORERIA);
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
    const useMocks = runtimeConfig.mode === 'mock';
    const [kpisResult, reportesResult, tesoreriaResult, movimientosResult, costosResult, inventarioResult] = await Promise.allSettled([
      finanzasService.getKPIs(),
      finanzasService.getReportes(),
      finanzasService.getTreasuryInsights(),
      finanzasService.getMovimientos(),
      finanzasService.getCostosComparativos(),
      finanzasService.getInventarioResumen(),
    ]);

    const finalMovimientos = movimientosResult.status === 'fulfilled' ? movimientosResult.value : [];
    let finalKpis = kpisResult.status === 'fulfilled' ? kpisResult.value : EMPTY_KPIS;
    const finalCtasCobrar = calcularCuentasPorCobrar(finalMovimientos);
    const finalCtasPagar = calcularCuentasPorPagar(finalMovimientos);
    finalKpis = {
      ...finalKpis,
      cuentas_por_cobrar: finalCtasCobrar.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0),
      cuentas_por_pagar: finalCtasPagar.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0),
    };

    setKpis(finalKpis);
    setMovimientos(finalMovimientos);

    if (reportesResult.status === 'fulfilled') setReportes(reportesResult.value);
    else setReportes(EMPTY_REPORTES);

    if (tesoreriaResult.status === 'fulfilled') setTesoreria(tesoreriaResult.value);
    else setTesoreria(EMPTY_TESORERIA);

    if (costosResult.status === 'fulfilled') setCostosComparativos(costosResult.value);
    else setCostosComparativos([]);

    if (inventarioResult.status === 'fulfilled') setInventario(inventarioResult.value);
    else setInventario({ valor_stock_mp: 0, valor_stock_pt: 0, valor_inventario_total: 0 });

    const failed = [kpisResult, reportesResult, tesoreriaResult, movimientosResult, costosResult, inventarioResult].filter((r) => r.status === 'rejected');
    let fallbackApplied = false;
    if (useMocks || failed.length > 0) {
      try {
        const fallback = await finanzasService.getOperationalFallback();
        const fallbackMovimientos = fallback.movimientos;
        const fallbackCtasCobrar = calcularCuentasPorCobrar(fallbackMovimientos);
        const fallbackCtasPagar = calcularCuentasPorPagar(fallbackMovimientos);
        const fallbackKpis = {
          ...fallback.kpis,
          cuentas_por_cobrar: fallbackCtasCobrar.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0),
          cuentas_por_pagar: fallbackCtasPagar.reduce((acc, m) => acc + obtenerMontoPendiente(m), 0),
        };

        setKpis(fallbackKpis);
        setReportes(fallback.reportes);
        setTesoreria(fallback.tesoreria);
        setCostosComparativos(fallback.costosComparativos);
        setInventario(fallback.inventario);
        setMovimientos(fallbackMovimientos);
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

  return { kpis, reportes, tesoreria, movimientos, costosComparativos, inventario, loading, loadError, infoMessage, refresh, createMovimiento: finanzasService.createMovimiento, confirmarMovimiento: finanzasService.confirmarMovimiento, updateMovimiento: finanzasService.updateMovimiento };
};
