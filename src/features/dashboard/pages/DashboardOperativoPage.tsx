import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../shared/components/card';
import { LoadingState } from '../../../shared/components/table';
import { ROUTES } from '../../../app/config/routes';
import { useDashboardOperativo } from '../hooks/useDashboardOperativo';
import { BrandLogo } from '../../../shared/components/BrandLogo';
import { KPIBox, SectionTitle } from '../components/dashboardShared';
import { fmtARS, fmtDateTime, fmtRelativeMinutes, getTrendTone } from '../components/dashboardFormat';
import { buildDashboardExecutiveInsights, getDashboardPeriodoLabel, isWithinDashboardPeriodo, type DashboardPeriodo } from '../utils/dashboardExecutiveInsights';
import { buildDashboardTemporalInsights } from '../utils/dashboardTemporalInsights';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import { ApiService } from '../../../infrastructure/api';

const PERIODOS: DashboardPeriodo[] = ['HOY', 'SEMANA', 'MES'];

export const DashboardOperativoPage = () => {
  const { kpis, stockResumenes, loading, lastUpdatedAt, loadError } = useDashboardOperativo();
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [periodo, setPeriodo] = useState<DashboardPeriodo>('MES');
  const now = useMemo(() => new Date(), []);
  const updatedAtLabel = useMemo(() => fmtDateTime(lastUpdatedAt), [lastUpdatedAt]);
  const relativeUpdatedLabel = useMemo(() => fmtRelativeMinutes(lastUpdatedAt), [lastUpdatedAt]);
  const periodoLabel = useMemo(() => getDashboardPeriodoLabel(periodo), [periodo]);

  // Reusa la misma carga de datos operativos del dashboard ejecutivo.
  useEffect(() => {
    void Promise.allSettled([ApiService.ordenes.getAll(), ApiService.clientes.getAll(), ApiService.stockPT.getMovimientos()])
      .then(([ordenesResult, clientesResult, movimientosResult]) => {
        if (ordenesResult.status === 'fulfilled') setOrdenes(ordenesResult.value);
        if (clientesResult.status === 'fulfilled') setClientes(clientesResult.value);
        if (movimientosResult.status === 'fulfilled') setMovimientosPT(movimientosResult.value);
      });
  }, []);

  const executiveMovimientos = useMemo(() => movimientosPT.filter((mov) => isWithinDashboardPeriodo(mov.created_at, periodo, now)), [movimientosPT, now, periodo]);
  const executiveInsights = useMemo(() => buildDashboardExecutiveInsights(executiveMovimientos, clientes, periodo, now), [clientes, executiveMovimientos, now, periodo]);
  const temporalInsights = useMemo(() => buildDashboardTemporalInsights(ordenes, movimientosPT, [], periodo, now), [movimientosPT, ordenes, now, periodo]);

  if (loading && stockResumenes.stockMateriaPrima.length === 0 && stockResumenes.stockProductoTerminado.length === 0) {
    return <LoadingState label="Cargando dashboard operativo..." />;
  }

  const stockMpTop = [...stockResumenes.stockMateriaPrima].sort((a, b) => b.stock_actual - a.stock_actual).slice(0, 6);
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Operativo</p>
            <h1 className="text-3xl font-black mt-1">Centro Operativo</h1>
            <p className="text-sm text-slate-500 mt-2">Vista compacta con producción, inventario y finanzas operativas del período activo.</p>
            <p className="mt-2 text-xs text-slate-500">Periodo activo: {periodoLabel} · {relativeUpdatedLabel}</p>
          </div>
          <BrandLogo variant="full" className="max-w-[220px]" />
        </div>
      </Card>

      {loadError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div> : null}

      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold">Periodo operativo</h3>
            <p className="text-xs text-slate-500">La vista se actualiza con datos reales de salidas de PT, clientes y stock.</p>
          </div>
          <div className="flex items-center gap-2">
            {PERIODOS.map((item) => (
              <button key={item} type="button" onClick={() => setPeriodo(item)} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.2em] ${periodo === item ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {getDashboardPeriodoLabel(item)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIBox label="Órdenes pendientes" value={`${kpis.ordenes_pendientes}`} trend={getTrendTone(kpis.ordenes_pendientes, undefined, false)} updatedAt={updatedAtLabel} tone="cyan" />
          <KPIBox label="Órdenes en proceso" value={`${kpis.ordenes_en_proceso}`} trend={getTrendTone(kpis.ordenes_en_proceso, undefined, false)} updatedAt={updatedAtLabel} tone="cyan" />
          <KPIBox label="Producción total" value={`${kpis.produccion_total.toLocaleString('es-AR')} kg`} trend={getTrendTone(kpis.produccion_total, undefined)} updatedAt={updatedAtLabel} tone="emerald" />
          <KPIBox label="Clientes atendidos" value={`${executiveInsights.clientesAtendidos}`} trend={getTrendTone(executiveInsights.clientesAtendidos, undefined)} updatedAt={updatedAtLabel} tone="fuchsia" />
        </div>
      </Card>

      <section className="space-y-4">
        <SectionTitle title="Producción" description="Órdenes pendientes, en proceso, finalizadas y producción total." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIBox label="Órdenes pendientes" value={`${kpis.ordenes_pendientes}`} trend={getTrendTone(kpis.ordenes_pendientes, undefined, false)} updatedAt={updatedAtLabel} tone="cyan" />
          <KPIBox label="Órdenes en proceso" value={`${kpis.ordenes_en_proceso}`} trend={getTrendTone(kpis.ordenes_en_proceso, undefined, false)} updatedAt={updatedAtLabel} tone="cyan" />
          <KPIBox label="Órdenes finalizadas" value={`${kpis.ordenes_finalizadas}`} trend={getTrendTone(kpis.ordenes_finalizadas, undefined)} updatedAt={updatedAtLabel} tone="emerald" />
          <KPIBox label="Producción total" value={`${kpis.produccion_total.toLocaleString('es-AR')} kg`} trend={getTrendTone(kpis.produccion_total, undefined)} updatedAt={updatedAtLabel} tone="emerald" helper={`Merma total: ${kpis.merma_total.toLocaleString('es-AR')} kg`} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Inventario" description="Stock MP, stock PT, lotes críticos y stock por materia prima." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIBox label="Stock físico MP" value={`${kpis.stock_total_mp.toLocaleString('es-AR')} kg`} trend={getTrendTone(kpis.stock_total_mp, undefined)} updatedAt={updatedAtLabel} tone="cyan" />
          <KPIBox label="Stock disponible MP" value={`${kpis.stock_disponible_mp.toLocaleString('es-AR')} kg`} trend={getTrendTone(kpis.stock_disponible_mp, undefined)} updatedAt={updatedAtLabel} tone="emerald" />
          <KPIBox label="Lotes críticos" value={`${kpis.stock_critico}`} trend={getTrendTone(kpis.stock_critico, undefined, false)} updatedAt={updatedAtLabel} tone="red" />
          <KPIBox label="Stock PT total" value={`${kpis.stock_total_pt.toLocaleString('es-AR')} kg`} trend={getTrendTone(kpis.stock_total_pt, undefined)} updatedAt={updatedAtLabel} tone="fuchsia" />
        </div>
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Stock real por materia prima</h3>
              <p className="mt-1 text-xs text-slate-500">Máximo 6 insumos con mayor stock o prioridad operativa.</p>
            </div>
            <Link to={ROUTES.STOCKMATERIAPRIMA} className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
              Ver stock completo
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Materia prima</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {stockMpTop.map((item) => {
                  const critical = item.estado === 'CRITICO' || item.stock_actual <= item.umbral_alerta;
                  const low = item.estado === 'BAJO';
                  return (
                    <tr key={item.insumo_id} className={critical ? 'bg-rose-50/70' : low ? 'bg-amber-50/70' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{item.nombre_insumo}</span>
                          {critical ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">Crítico</span> : low ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Bajo</span> : null}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${critical ? 'text-rose-700' : low ? 'text-amber-700' : 'text-slate-900'}`}>
                        {item.stock_actual.toLocaleString('es-AR')} kg
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Finanzas" description="Costos, ingresos y flujo de caja del período." />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <KPIBox label="Costos" value={fmtARS(temporalInsights.costos)} trend={getTrendTone(temporalInsights.costos, undefined, false)} updatedAt={updatedAtLabel} tone="orange" />
          <KPIBox label="Ingresos" value={fmtARS(temporalInsights.ingresos)} trend={getTrendTone(temporalInsights.ingresos, undefined)} updatedAt={updatedAtLabel} tone="emerald" />
          <KPIBox label="Flujo de caja" value={fmtARS(temporalInsights.flujoCaja)} trend={getTrendTone(temporalInsights.flujoCaja, undefined)} updatedAt={updatedAtLabel} tone={temporalInsights.flujoCaja >= 0 ? 'cyan' : 'red'} />
        </div>
      </section>
    </div>
  );
};

export default DashboardOperativoPage;
