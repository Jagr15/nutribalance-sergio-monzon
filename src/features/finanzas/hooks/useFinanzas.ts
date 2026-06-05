import { useCallback, useEffect, useState } from 'react';
import { finanzasService } from '../services/finanzasService';
import type { FinanzasKPIs, FinanzasReportes, MovimientoFinanciero } from '../types';

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setInfoMessage(null);
    const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
    const [kpisResult, reportesResult, movimientosResult] = await Promise.allSettled([
      finanzasService.getKPIs(),
      finanzasService.getReportes(),
      finanzasService.getMovimientos(),
    ]);

    if (kpisResult.status === 'fulfilled') setKpis(kpisResult.value);
    else setKpis(EMPTY_KPIS);

    if (reportesResult.status === 'fulfilled') setReportes(reportesResult.value);
    else setReportes(EMPTY_REPORTES);

    if (movimientosResult.status === 'fulfilled') setMovimientos(movimientosResult.value);
    else setMovimientos([]);

    const failed = [kpisResult, reportesResult, movimientosResult].filter((r) => r.status === 'rejected');
    let fallbackApplied = false;
    if (useMocks || failed.length > 0) {
      try {
        const fallback = await finanzasService.getOperationalFallback();
        setKpis(fallback.kpis);
        setReportes(fallback.reportes);
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

  return { kpis, reportes, movimientos, loading, loadError, infoMessage, refresh, createMovimiento: finanzasService.createMovimiento };
};
