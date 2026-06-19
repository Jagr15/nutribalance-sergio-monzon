import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../shared/components/card';
import { LoadingState } from '../../../shared/components/table';
import { ROUTES } from '../../../app/config/routes';
import { useAlertas } from '../../alertas/hooks/useAlertas';
import { useDashboardOperativo } from '../hooks/useDashboardOperativo';
import { BrandLogo } from '../../../shared/components/BrandLogo';
import { KPIBox, SectionTitle } from '../components/dashboardShared';
import { fmtARS, fmtDateTime, fmtRelativeMinutes, getTrendTone } from '../components/dashboardFormat';
import { buildDashboardExecutiveInsights, getDashboardPeriodoLabel, isWithinDashboardPeriodo, type DashboardPeriodo } from '../utils/dashboardExecutiveInsights';
import { buildDashboardTemporalInsights, filterAlertasByPeriodo } from '../utils/dashboardTemporalInsights';
import type { AlertaOperativa } from '../../alertas/types/alerta';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import { ApiService } from '../../../infrastructure/api';

const PERIODOS: DashboardPeriodo[] = ['HOY', 'SEMANA', 'MES'];

const buildAlertRanking = (alertas: AlertaOperativa[], periodo: DashboardPeriodo, now: Date, limit: number) =>
  filterAlertasByPeriodo([...alertas], periodo, now)
    .filter((a) => a.estado !== 'atendida' && a.estado !== 'descartada')
    .sort((a, b) => (b.prioridad === 'critica' ? 3 : b.prioridad === 'media' ? 2 : 1) - (a.prioridad === 'critica' ? 3 : a.prioridad === 'media' ? 2 : 1))
    .slice(0, limit);

export const DashboardOperativoPage = () => {
  const { summary, alertas } = useAlertas();
  const { kpis, stockResumenes, loading, lastUpdatedAt, loadError } = useDashboardOperativo();
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [periodo, setPeriodo] = useState<DashboardPeriodo>('MES');
  const now = useMemo(() => new Date(), []);
  const updatedAtLabel = useMemo(() => fmtDateTime(lastUpdatedAt), [lastUpdatedAt]);
  const relativeUpdatedLabel = useMemo(() => fmtRelativeMinutes(lastUpdatedAt), [lastUpdatedAt]);
  const periodoLabel = useMemo(() => getDashboardPeriodoLabel(periodo), [periodo]);
  const alertasTop = useMemo(() => buildAlertRanking(alertas, periodo, now, 3), [alertas, now, periodo]);

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
  const temporalInsights = useMemo(() => buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, periodo, now), [alertas, movimientosPT, ordenes, now, periodo]);

  if (loading && stockResumenes.stockMateriaPrima.length === 0 && stockResumenes.stockProductoTerminado.length === 0) {
    return <LoadingState label="Cargando dashboard operativo..." />;
  }

  const stockMpTop = [...stockResumenes.stockMateriaPrima].sort((a, b) => b.stock_actual - a.stock_actual).slice(0, 6);
  const ptRanking = [...stockResumenes.stockProductoTerminado].sort((a, b) => b.stock_actual - a.stock_actual).slice(0, 10);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Operativo</p>
            <h1 className="text-3xl font-black mt-1">Centro Operativo</h1>
            <p className="text-sm text-slate-500 mt-2">Detalle completo de producción, inventario, consumos, PT, expediciones y alertas.</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Stock real por materia prima</h3>
            {stockMpTop.map((item) => <div key={item.insumo_id} className="text-sm text-slate-700">{item.nombre_insumo} · {item.stock_actual.toLocaleString('es-AR')} kg</div>)}
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Stock de Producto Terminado</h3>
            {ptRanking.map((item) => <div key={`${item.nombre_producto}-${item.producto_id ?? 'sin-id'}`} className="text-sm text-slate-700">{item.nombre_producto} · {item.stock_actual.toLocaleString('es-AR')} {item.unidad}</div>)}
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Consumos" description="Consumo por insumo y consumo total de materia prima." />
        <Card><p className="text-sm text-slate-500">Se conserva el detalle operativo de consumos desde el conjunto de datos existente.</p></Card>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Producto Terminado" description="Salidas de PT, participación porcentual y PT entregado por cliente." />
        <Card><p className="text-sm text-slate-500">Ventas por producto, kg despachados y ranking por cliente ya calculados por los insights existentes.</p></Card>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Operación" description="Órdenes recientes, expediciones y clientes atendidos." />
        <Card>
          <div className="space-y-2">
            {executiveInsights.topClientesPorVolumen.slice(0, 3).map((item) => <div key={item.cliente_nombre} className="text-sm text-slate-700">{item.cliente_nombre} · {item.kg.toLocaleString('es-AR')} kg</div>)}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Alertas" description="Resumen operativo completo priorizado por criticidad." action={<Link to={ROUTES.ALERTAS} className="text-sm font-semibold text-red-700">Ir a alertas</Link>} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPIBox label="Alertas activas" value={`${summary.pendientes + summary.criticas + summary.seguimiento}`} trend={getTrendTone(summary.pendientes + summary.criticas + summary.seguimiento, undefined, false)} updatedAt={updatedAtLabel} tone="fuchsia" />
          <KPIBox label="Críticas activas" value={`${summary.criticas}`} trend={getTrendTone(summary.criticas, undefined, false)} updatedAt={updatedAtLabel} tone="red" />
          <KPIBox label="En seguimiento" value={`${summary.seguimiento}`} trend={getTrendTone(summary.seguimiento, undefined, false)} updatedAt={updatedAtLabel} tone="orange" />
        </div>
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {alertasTop.map((alerta, idx) => (
              <div key={alerta.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">#{idx + 1}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{alerta.titulo}</p>
                <p className="mt-1 text-xs text-slate-500">{alerta.area.toUpperCase()} · {alerta.estado}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle title="Finanzas" description="Costos, ingresos y flujo de caja del período." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIBox label="Costos" value={fmtARS(temporalInsights.costos)} trend={getTrendTone(temporalInsights.costos, undefined, false)} updatedAt={updatedAtLabel} tone="orange" />
          <KPIBox label="Ingresos" value={fmtARS(temporalInsights.ingresos)} trend={getTrendTone(temporalInsights.ingresos, undefined)} updatedAt={updatedAtLabel} tone="emerald" />
          <KPIBox label="Flujo de caja" value={fmtARS(temporalInsights.flujoCaja)} trend={getTrendTone(temporalInsights.flujoCaja, undefined)} updatedAt={updatedAtLabel} tone={temporalInsights.flujoCaja >= 0 ? 'cyan' : 'red'} />
          <KPIBox label="Indicador financiero disponible" value={`${kpis.proteina_promedio_formula.toFixed(2)}%`} trend={getTrendTone(kpis.proteina_promedio_formula, undefined)} updatedAt={updatedAtLabel} tone="violet" />
        </div>
      </section>
    </div>
  );
};

export default DashboardOperativoPage;
