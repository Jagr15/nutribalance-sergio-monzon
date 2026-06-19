import { useEffect, useMemo, useState } from 'react';
import { finanzasService } from '../services/finanzasService';
import type { FinanzasInventarioResumen, FinanzasKPIs, FinanzasTesoreriaInsights, MovimientoFinanciero } from '../types';
import { buildEstadosFinancieros, type PeriodoFiltro, type RangoFechas } from '../utils/estadosFinancieros';
import { historicoContableService } from '../services/historicoContableService';

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

const EMPTY_INVENTARIO: FinanzasInventarioResumen = {
  valor_stock_mp: 0,
  valor_stock_pt: 0,
  valor_inventario_total: 0,
};

export const useEstadosFinancieros = () => {
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [kpis, setKpis] = useState<FinanzasKPIs>(EMPTY_KPIS);
  const [tesoreria, setTesoreria] = useState<FinanzasTesoreriaInsights>(EMPTY_TESORERIA);
  const [inventario, setInventario] = useState<FinanzasInventarioResumen>(EMPTY_INVENTARIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('MES_ACTUAL');
  const [rangoCustom, setRangoCustom] = useState<RangoFechas>({ desde: '', hasta: '' });

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [movs, kpiData, treasuryData, inventarioData] = await Promise.all([
        finanzasService.getMovimientos(),
        finanzasService.getKPIs(),
        finanzasService.getTreasuryInsights(),
        finanzasService.getInventarioResumen(),
      ]);
      const historicalRows = await historicoContableService.refreshRows();
      const historical = historicalRows.map((row) => ({
        uid: row.legacy_uid ?? `${row.fecha}-${row.descripcion}`,
        fecha: row.fecha,
        tipo: row.tipo,
        origen_operativo: row.origen_operativo,
        descripcion: row.descripcion,
        monto: row.monto,
        categoria: undefined,
        centro_costo: undefined,
        estado: row.estado ?? 'CONFIRMADO',
      }));
      setMovimientos([...movs, ...historical]);
      setKpis(kpiData);
      setTesoreria(treasuryData);
      setInventario(inventarioData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los estados financieros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const data = useMemo(() => buildEstadosFinancieros({ movimientos, kpis, tesoreria, inventario, periodo, rangoCustom }), [inventario, kpis, movimientos, periodo, rangoCustom, tesoreria]);

  return { loading, error, data, periodo, setPeriodo, rangoCustom, setRangoCustom, refresh };
};
