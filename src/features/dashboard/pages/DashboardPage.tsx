import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { ROUTES } from '../../../app/config/routes';
import { useAlertas } from '../../alertas/hooks/useAlertas';
import { useDashboardOperativo } from '../hooks/useDashboardOperativo';
import { ApiService } from '../../../infrastructure/api';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import OrdenExpedicionModal from '../../ordenes/components/OrdenExpedicionModal';
import { DataTable, EmptyState, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';
import {
  buildDashboardExecutiveInsights,
  getDashboardPeriodoLabel,
  isWithinDashboardPeriodo,
  type DashboardPeriodo,
} from '../utils/dashboardExecutiveInsights';
import { buildDashboardTemporalInsights, filterAlertasByPeriodo } from '../utils/dashboardTemporalInsights';

const fmtARS = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

const PERIODOS: DashboardPeriodo[] = ['HOY', 'SEMANA', 'MES'];

export const DashboardPage = () => {
  const { summary, alertas } = useAlertas();
  const { kpis, consumoMensual, stockResumenes, ptInsights, expedicionInsights, loading, reload } = useDashboardOperativo();
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [periodo, setPeriodo] = useState<DashboardPeriodo>('MES');
  const [isExpedicionOpen, setIsExpedicionOpen] = useState(false);
  const navigate = useNavigate();
  const dashboardNow = useMemo(() => new Date(), []);

  useEffect(() => {
    void Promise.allSettled([
      ApiService.ordenes.getAll(),
      ApiService.clientes.getAll(),
      ApiService.stockPT.getMovimientos(),
    ])
      .then(([ordenesResult, clientesResult, movimientosResult]) => {
        if (ordenesResult.status === 'fulfilled') setOrdenes(ordenesResult.value);
        if (clientesResult.status === 'fulfilled') setClientes(clientesResult.value);
        if (movimientosResult.status === 'fulfilled') setMovimientosPT(movimientosResult.value);
      })
      .catch((e) => console.error('Error cargando datos ejecutivos:', e));
  }, []);

  useEffect(() => {
    const seenKey = 'nutribalance_alerts_seen_session';
    if (sessionStorage.getItem(seenKey) === 'true') return;
    const crit = alertas.filter((a) => a.prioridad === 'critica' && a.estado !== 'atendida');
    if (crit.length === 0) return;
    sessionStorage.setItem(seenKey, 'true');
    void Swal.fire({
      title: 'Atención operativa',
      text: `Hay ${crit.length} alertas críticas activas.`,
      background: '#ffffff',
      color: '#0f172a',
      showCancelButton: true,
      confirmButtonText: 'Ver alertas operativas',
      cancelButtonText: 'Continuar al panel',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#334155',
    }).then((r) => r.isConfirmed && navigate(ROUTES.ALERTAS));
  }, [alertas, navigate]);

  const consumoTop = useMemo(() => {
    const map = new Map<string, number>();
    consumoMensual.forEach((c) => map.set(c.insumo, (map.get(c.insumo) ?? 0) + c.consumo_kg));
    const arr = [...map.entries()].map(([insumo, total]) => ({ insumo, total }));
    const max = Math.max(1, ...arr.map((x) => x.total));
    return arr.sort((a, b) => b.total - a.total).slice(0, 6).map((x) => ({ ...x, pct: (x.total / max) * 100 }));
  }, [consumoMensual]);

  const consumoLine = useMemo(() => {
    const map = new Map<string, number>();
    consumoMensual.forEach((c) => {
      map.set(c.mes, (map.get(c.mes) ?? 0) + c.consumo_kg);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([mes, total]) => ({ mes, value: total }));
  }, [consumoMensual]);

  const stockMpResumen = stockResumenes.stockMateriaPrima;
  const stockPtResumen = stockResumenes.stockProductoTerminado;
  const stockMpTop = useMemo(() => {
    return [...stockMpResumen]
      .sort((a, b) => b.stock_actual - a.stock_actual)
      .slice(0, 6);
  }, [stockMpResumen]);
  const stockMpMax = Math.max(1, ...stockMpTop.map((item) => item.stock_actual));

  const estadoMateriaPrima = useMemo(() => {
    const total = Math.max(1, kpis.stock_total_mp);
    const comprometido = Math.max(0, Math.min(kpis.stock_comprometido_mp, total));
    const disponible = Math.max(0, Math.min(kpis.stock_disponible_mp, total));
    const committedPct = Math.max(0, Math.min(100, (comprometido / total) * 100));
    const availablePct = Math.max(0, Math.min(100, (disponible / total) * 100));

    return [
      { label: 'Comprometido', value: comprometido, pct: committedPct, color: 'bg-orange-500' },
      { label: 'Disponible', value: disponible, pct: availablePct, color: 'bg-emerald-500' },
    ];
  }, [kpis.stock_comprometido_mp, kpis.stock_disponible_mp, kpis.stock_total_mp]);

  const ptRanking = useMemo(() => {
    return [...stockPtResumen]
      .sort((a, b) => b.stock_actual - a.stock_actual)
      .slice(0, 10);
  }, [stockPtResumen]);

  const executiveMovimientos = useMemo(() => {
    return movimientosPT.filter((mov) => isWithinDashboardPeriodo(mov.created_at, periodo, dashboardNow));
  }, [dashboardNow, movimientosPT, periodo]);

  const executiveInsights = useMemo(
    () => buildDashboardExecutiveInsights(executiveMovimientos, clientes, periodo, dashboardNow),
    [clientes, dashboardNow, executiveMovimientos, periodo],
  );

  const temporalInsights = useMemo(
    () => buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, periodo, dashboardNow),
    [alertas, dashboardNow, movimientosPT, ordenes, periodo],
  );

  const ordenesRecientes = useMemo(
    () => ordenes.filter((orden) => isWithinDashboardPeriodo(orden.fecha_creacion, periodo, dashboardNow)),
    [dashboardNow, ordenes, periodo],
  );

  const recientes = useMemo(
    () => ordenesRecientes
      .slice()
      .sort((a, b) => +new Date(b.fecha_creacion) - +new Date(a.fecha_creacion))
      .slice(0, 5),
    [ordenesRecientes],
  );

  const handleExportPdf = () => {
    const lines = [
      `Dashboard ejecutivo - ${getDashboardPeriodoLabel(periodo)}`,
      `Ventas por producto terminado: ${executiveInsights.ventasPorProducto.map((item) => `${item.producto_nombre} (${item.kg.toLocaleString('es-AR')} kg / ${fmtARS(item.importe)})`).join(' | ') || 'Sin datos'}`,
      `Kg despachados por producto: ${executiveInsights.kgDespachadosPorProducto.map((item) => `${item.producto_nombre} (${item.kg.toLocaleString('es-AR')} kg)`).join(' | ') || 'Sin datos'}`,
      `Clientes atendidos: ${executiveInsights.clientesAtendidos}`,
      `Top clientes: ${executiveInsights.topClientesPorVolumen.map((item) => `${item.cliente_nombre} (${item.kg.toLocaleString('es-AR')} kg)`).join(' | ') || 'Sin datos'}`,
    ];
    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>Dashboard ejecutivo</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 12px; }
            p { margin: 0 0 8px; line-height: 1.5; }
            .muted { color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Dashboard ejecutivo - ${getDashboardPeriodoLabel(periodo)}</h1>
          ${lines.map((line) => `<p>${line}</p>`).join('')}
          <p class="muted">Usá la opción de imprimir/guardar como PDF del navegador.</p>
          <script>window.onload = () => setTimeout(() => { window.print(); }, 250);</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const alertasTop = useMemo(() => {
    const priorityScore = (priority: string) => (priority === 'critica' ? 3 : priority === 'media' ? 2 : 1);
    const stateScore = (state: string) => (state === 'pendiente' ? 3 : state === 'en seguimiento' ? 2 : state === 'atendida' ? 1 : 0);

    return filterAlertasByPeriodo([...alertas], periodo, dashboardNow)
      .filter((a) => a.estado !== 'atendida' && a.estado !== 'descartada')
      .sort((a, b) => {
        const priorityDelta = priorityScore(b.prioridad) - priorityScore(a.prioridad);
        if (priorityDelta !== 0) return priorityDelta;
        return stateScore(b.estado) - stateScore(a.estado);
      })
      .slice(0, 3);
  }, [alertas, dashboardNow, periodo]);

  const formatDatoAsociado = (dato: Record<string, unknown>) => {
    const parts: string[] = [];
    if (typeof dato.insumo === 'string' && dato.insumo.trim()) parts.push(dato.insumo);
    if (typeof dato.producto === 'string' && dato.producto.trim()) parts.push(dato.producto);
    if (typeof dato.lote === 'string' && dato.lote.trim()) parts.push(`Lote ${dato.lote}`);
    if (typeof dato.orden === 'string' && dato.orden.trim()) parts.push(`OP ${dato.orden}`);
    if (typeof dato.disponible_kg === 'number') parts.push(`Disponible ${dato.disponible_kg.toLocaleString('es-AR')} kg`);
    if (typeof dato.umbral_kg === 'number') parts.push(`Umbral ${dato.umbral_kg.toLocaleString('es-AR')} kg`);
    if (typeof dato.cantidad_objetivo === 'number') parts.push(`Objetivo ${dato.cantidad_objetivo.toLocaleString('es-AR')} kg`);
    return parts.length > 0 ? parts.join(' · ') : 'Sin dato asociado';
  };

  const valorInventarioPtLabel = kpis.stock_total_pt > 0
    ? (kpis.valor_inventario_pt > 0 ? fmtARS(kpis.valor_inventario_pt) : 'Sin costo confiable')
    : 'Sin stock PT';

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Operativo</p>
        <h1 className="text-3xl font-black mt-1">Centro Ejecutivo de Producción</h1>
        <p className="text-sm text-slate-500 mt-2">Métricas reales de stock, producción, costos y trazabilidad.</p>
      </Card>

      <section>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Dashboard ejecutivo</p>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Ventas y clientes por período</h2>
            <p className="text-sm text-slate-500 mt-2">La vista se actualiza con datos reales de salidas de PT, clientes y stock.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriodo(item)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
                  periodo === item
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getDashboardPeriodoLabel(item)}
              </button>
            ))}
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-slate-800"
            >
              Exportar PDF
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Ventas por producto terminado</h3>
            <p className="text-xs text-slate-500 mb-3">Monto y kg vendidos en {executiveInsights.periodoLabel.toLowerCase()}.</p>
            {executiveInsights.ventasPorProducto.length === 0 ? (
              <p className="text-sm text-slate-500">Sin ventas de producto terminado.</p>
            ) : (
              <div className="space-y-3">
                {executiveInsights.ventasPorProducto.map((item, idx) => {
                  const max = Math.max(1, executiveInsights.ventasPorProducto[0]?.importe ?? 1);
                  const width = Math.max(8, (item.importe / max) * 100);
                  return (
                    <div key={`${item.producto_id ?? item.producto_nombre}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.producto_nombre}</p>
                          <p className="text-slate-500">{item.kg.toLocaleString('es-AR')} kg · {item.clientes_atendidos} clientes</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-emerald-700">{fmtARS(item.importe)}</p>
                          <p className="text-slate-500">{item.movimientos} movimientos</p>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Kg despachados por producto</h3>
            <p className="text-xs text-slate-500 mb-3">Volumen total de salidas de PT en el período.</p>
            {executiveInsights.kgDespachadosPorProducto.length === 0 ? (
              <p className="text-sm text-slate-500">Sin despachos de producto terminado.</p>
            ) : (
              <div className="space-y-3">
                {executiveInsights.kgDespachadosPorProducto.map((item, idx) => {
                  const max = Math.max(1, executiveInsights.kgDespachadosPorProducto[0]?.kg ?? 1);
                  const width = Math.max(8, (item.kg / max) * 100);
                  return (
                    <div key={`${item.producto_id ?? item.producto_nombre}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.producto_nombre}</p>
                          <p className="text-slate-500">{item.movimientos} salidas · Último {item.ultima_fecha ? new Date(item.ultima_fecha).toLocaleDateString('es-AR') : 'Sin dato'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-cyan-700">{item.kg.toLocaleString('es-AR')} kg</p>
                          <p className="text-slate-500">{fmtARS(item.importe)}</p>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Clientes atendidos</h3>
            <p className="text-xs text-slate-500 mb-3">Clientes con salidas de PT durante el período seleccionado.</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Clientes únicos</p>
              <p className="text-3xl font-black text-violet-700 mt-2">{executiveInsights.clientesAtendidos}</p>
              <p className="mt-3 text-sm text-slate-600">Kg totales: <strong>{executiveInsights.totalKgDespachados.toLocaleString('es-AR')}</strong></p>
              <p className="text-sm text-slate-600">Importe estimado: <strong>{fmtARS(executiveInsights.totalImporte)}</strong></p>
            </div>
            <div className="mt-4 space-y-2">
              {executiveInsights.topClientesPorVolumen.slice(0, 3).map((item) => (
                <div key={`${item.cliente_nombre}-${item.ultima_fecha ?? 'sin-fecha'}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{item.cliente_nombre}</p>
                    <p className="truncate text-xs text-slate-500">{item.movimientos} movimientos · {item.importe > 0 ? fmtARS(item.importe) : 'Sin importe'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-violet-700">{item.kg.toLocaleString('es-AR')} kg</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">{item.ultima_fecha ? new Date(item.ultima_fecha).toLocaleDateString('es-AR') : 'Sin fecha'}</p>
                  </div>
                </div>
              ))}
              {executiveInsights.topClientesPorVolumen.length === 0 ? (
                <p className="text-sm text-slate-500">Sin clientes atendidos en el período.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">Top clientes por volumen</h3>
            <p className="text-xs text-slate-500 mb-3">Ranking de clientes por kg despachados.</p>
            {executiveInsights.topClientesPorVolumen.length === 0 ? (
              <p className="text-sm text-slate-500">Sin volumen para mostrar.</p>
            ) : (
              <div className="space-y-2">
                {executiveInsights.topClientesPorVolumen.map((item, idx) => {
                  const max = Math.max(1, executiveInsights.topClientesPorVolumen[0]?.kg ?? 1);
                  const width = Math.max(8, (item.kg / max) * 100);
                  return (
                    <div key={`${item.cliente_id ?? item.cliente_nombre}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.cliente_nombre}</p>
                          <p className="text-slate-500">{item.movimientos} salidas · {fmtARS(item.importe)}</p>
                        </div>
                        <p className="font-semibold text-fuchsia-700 shrink-0">{item.kg.toLocaleString('es-AR')} kg</p>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Costos</p>
            <p className="mt-2 text-3xl font-black text-orange-500">{fmtARS(temporalInsights.costos)}</p>
            <p className="mt-2 text-xs text-slate-500">Costos de órdenes finalizadas en {getDashboardPeriodoLabel(periodo).toLowerCase()}.</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Ingresos</p>
            <p className="mt-2 text-3xl font-black text-emerald-500">{fmtARS(temporalInsights.ingresos)}</p>
            <p className="mt-2 text-xs text-slate-500">Ventas PT con cliente en {getDashboardPeriodoLabel(periodo).toLowerCase()}.</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Flujo de caja</p>
            <p className={`mt-2 text-3xl font-black ${temporalInsights.flujoCaja >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
              {fmtARS(temporalInsights.flujoCaja)}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ingresos menos costos operativos del período.</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Alertas</p>
            <p className="mt-2 text-3xl font-black text-fuchsia-600">{temporalInsights.alertas.length}</p>
            <p className="mt-2 text-xs text-slate-500">Alertas operativas dentro de {getDashboardPeriodoLabel(periodo).toLowerCase()}.</p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Materia Prima</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card><p className="text-xs text-slate-500">Stock físico MP</p><p className="text-3xl font-black mt-2 text-cyan-300">{kpis.stock_total_mp.toLocaleString('es-AR')} kg</p></Card>
          <Card><p className="text-xs text-slate-500">Stock comprometido MP</p><p className="text-3xl font-black mt-2 text-orange-300">{kpis.stock_comprometido_mp.toLocaleString('es-AR')} kg</p></Card>
          <Card><p className="text-xs text-slate-500">Stock disponible MP</p><p className="text-3xl font-black mt-2 text-emerald-300">{kpis.stock_disponible_mp.toLocaleString('es-AR')} kg</p></Card>
          <Card><p className="text-xs text-slate-500">Lotes críticos</p><p className="text-3xl font-black mt-2 text-red-300">{kpis.stock_critico}</p></Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Resumen de Producto Terminado</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><p className="text-xs text-slate-500">Stock PT total</p><p className="text-3xl font-black mt-2 text-fuchsia-300">{kpis.stock_total_pt.toLocaleString('es-AR')} kg</p></Card>
          <Card>
            <p className="text-xs text-slate-500">Valor inventario PT</p>
            <p className="text-3xl font-black mt-2 text-violet-300">{valorInventarioPtLabel}</p>
            <p className="text-xs text-slate-400 mt-2">Base estimada desde órdenes finalizadas con costo real disponible.</p>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Órdenes de Producción</h2>
              <p className="text-sm text-slate-500">Fabricación de producto terminado.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.ORDENES}?crear=1`)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-blue-500"
            >
              Nueva orden de producción
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Pendientes</p>
              <p className="mt-2 text-3xl font-black text-blue-300">{kpis.ordenes_pendientes}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">En proceso</p>
              <p className="mt-2 text-3xl font-black text-sky-300">{kpis.ordenes_en_proceso}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Finalizadas</p>
              <p className="mt-2 text-3xl font-black text-emerald-300">{kpis.ordenes_finalizadas}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Producción total</p>
              <p className="mt-2 text-2xl font-black text-amber-300">{kpis.produccion_total.toLocaleString('es-AR')} kg</p>
              <p className="mt-2 text-xs text-slate-500">
                Merma total: {kpis.merma_total.toLocaleString('es-AR')} kg · Costo prom.: {fmtARS(kpis.costo_promedio_produccion)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Órdenes de Expedición</h2>
              <p className="text-sm text-slate-500">Salida y despacho de producto terminado hacia clientes.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpedicionOpen(true)}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-cyan-500"
            >
              Nueva orden de expedición
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Registradas</p>
              <p className="mt-2 text-3xl font-black text-cyan-700">{expedicionInsights.resumen.expediciones_registradas}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Kg expedidos</p>
              <p className="mt-2 text-3xl font-black text-cyan-700">{expedicionInsights.resumen.kg_expedidos.toLocaleString('es-AR')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Clientes atendidos</p>
              <p className="mt-2 text-3xl font-black text-cyan-700">{expedicionInsights.resumen.clientes_atendidos}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Producto más expedido</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{expedicionInsights.resumen.producto_mas_expedido}</p>
              <p className="mt-2 text-xs text-slate-500">{expedicionInsights.resumen.kg_producto_mas_expedido.toLocaleString('es-AR')} kg</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {expedicionInsights.porCliente.slice(0, 3).map((item) => (
              <div key={`${item.fecha}-${item.producto_nombre}-${item.cliente_nombre}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.cliente_nombre}</p>
                  <p className="truncate text-xs text-slate-500">{item.producto_nombre} · {item.presentacion.replace('_', ' ').toLowerCase()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-cyan-700">{item.kg.toLocaleString('es-AR')} kg</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">{new Date(item.fecha).toLocaleDateString('es-AR')}</p>
                </div>
              </div>
            ))}
            {expedicionInsights.porCliente.length === 0 ? (
              <p className="text-sm text-slate-500">Sin expediciones registradas todavía.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Estado de Materia Prima</h3>
          <p className="text-xs text-slate-500 mb-3">Stock total con desglose entre comprometido y disponible.</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Stock total MP</p>
                <p className="text-2xl font-black text-cyan-300">{kpis.stock_total_mp.toLocaleString('es-AR')} kg</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Comprometido: <span className="font-semibold text-orange-600">{kpis.stock_comprometido_mp.toLocaleString('es-AR')} kg</span></p>
                <p>Disponible: <span className="font-semibold text-emerald-600">{kpis.stock_disponible_mp.toLocaleString('es-AR')} kg</span></p>
              </div>
            </div>
            <div className="h-4 rounded-full bg-slate-200 overflow-hidden flex">
              <div className="bg-orange-500 transition-all duration-300" style={{ width: `${estadoMateriaPrima[0].pct}%` }} title={`Comprometido: ${estadoMateriaPrima[0].value.toLocaleString('es-AR')} kg`} />
              <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${estadoMateriaPrima[1].pct}%` }} title={`Disponible: ${estadoMateriaPrima[1].value.toLocaleString('es-AR')} kg`} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-widest text-slate-500">
              {estadoMateriaPrima.map((segment) => (
                <span key={segment.label} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} />
                  {segment.label}
                </span>
              ))}
            </div>
          </div>
          {stockMpResumen.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Insumos con menor disponibilidad</p>
              {stockMpResumen
                .slice()
                .sort((a, b) => a.stock_disponible - b.stock_disponible)
                .slice(0, 3)
                .map((item) => (
                  <div key={item.insumo_id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.nombre_insumo}</p>
                      <p className="text-xs text-slate-500">{item.estado} · Umbral {item.umbral_alerta.toLocaleString('es-AR')} {item.unidad}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{item.stock_disponible.toLocaleString('es-AR')} {item.unidad}</p>
                  </div>
                ))}
            </div>
          ) : null}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Stock de Producto Terminado por Producto</h3>
          <p className="text-xs text-slate-500 mb-3">Top 10 productos con mayor saldo consolidado.</p>
          {ptRanking.length === 0 ? (
            <p className="text-sm text-slate-700">Sin producto terminado consolidado todavía.</p>
          ) : (
            <div className="space-y-3">
              {ptRanking.map((item) => {
                const max = Math.max(1, ptRanking[0]?.stock_actual ?? 1);
                const pct = (item.stock_actual / max) * 100;
                return (
                  <div key={`${item.nombre_producto}-${item.producto_id ?? 'sin-id'}`}>
                    <div className="flex items-start justify-between gap-3 text-xs mb-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.nombre_producto}</p>
                        <p className="text-slate-500">
                          {item.estado} · {item.cantidad_lotes} lotes
                          {item.version_formula ? ` · v${item.version_formula}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-violet-700">{item.stock_actual.toLocaleString('es-AR')} {item.unidad}</p>
                        <p className="text-slate-500">{fmtARS(item.valor_monetario)}</p>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold">Top 3 alertas críticas</h3>
              <p className="text-xs text-slate-500">Alertas reales ordenadas por prioridad operativa.</p>
            </div>
            <Link to={ROUTES.ALERTAS} className="text-sm font-semibold text-red-700 hover:text-red-800">
              Ir a alertas
            </Link>
          </div>
          {alertasTop.length === 0 ? (
            <p className="text-sm text-slate-700">No hay alertas operativas activas en este momento.</p>
          ) : (
            <div className="space-y-3">
              {alertasTop.map((alerta) => (
                <div key={alerta.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{alerta.titulo}</p>
                      <p className="text-xs text-slate-500 mt-1">{alerta.area.toUpperCase()} · {alerta.estado}</p>
                    </div>
                    <span className={`text-[11px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${
                      alerta.prioridad === 'critica'
                        ? 'bg-red-100 text-red-700'
                        : alerta.prioridad === 'media'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {alerta.prioridad}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{formatDatoAsociado(alerta.datoAsociado as Record<string, unknown>)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Stock real por materia prima</h3>
          <p className="text-xs text-slate-500 mb-3">Top insumos por stock físico real, consolidado desde `stock_mp_resumen`.</p>
          {stockMpTop.length === 0 ? (
            <div className="h-48 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              Sin stock de materia prima disponible todavía.
            </div>
          ) : (
            <div className="space-y-3">
              {stockMpTop.map((item, idx) => {
                const width = Math.max(8, (item.stock_actual / stockMpMax) * 100);
                return (
                  <div key={item.insumo_id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.nombre_insumo}</p>
                        <p className="text-slate-500">
                          Disponible {item.stock_disponible.toLocaleString('es-AR')} kg · Comprometido {item.stock_comprometido.toLocaleString('es-AR')} kg
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-cyan-700">{item.stock_actual.toLocaleString('es-AR')} kg</p>
                        <p className="text-slate-400 uppercase tracking-widest text-[10px]">#{idx + 1}</p>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 transition-all duration-300"
                        style={{ width: `${width}%` }}
                        title={`${item.nombre_insumo}: ${item.stock_actual.toLocaleString('es-AR')} kg`}
                      />
                    </div>
                  </div>
                );
              })}
              </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Consumo mensual por insumo</h3>
          {consumoTop.length === 0 ? <p className="text-sm text-slate-700">Sin consumo mensual disponible todavía.</p> : (
          <div className="space-y-2">
            {consumoTop.map((c) => (
              <div key={c.insumo}>
                <div className="flex justify-between text-xs"><span>{c.insumo}</span><span>{c.total.toLocaleString('es-AR')} kg</span></div>
                <div className="h-2 bg-slate-200 rounded-full"><div className="h-2 bg-cyan-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${c.pct}%` }} /></div>
              </div>
            ))}
          </div>)}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Consumo mensual total de MP</h3>
          {consumoLine.length === 0 ? <p className="text-sm text-slate-700">Sin histórico suficiente para graficar consumo.</p> : (
          <div className="flex items-end gap-2 h-44">
            {consumoLine.map((p) => (
              <div key={p.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full max-w-8 bg-emerald-500/70 rounded-t" style={{ height: `${Math.max(8, p.value / Math.max(1, Math.max(...consumoLine.map((x) => x.value))) * 140)}px` }} />
                <span className="text-[10px] text-slate-500">{p.mes.slice(5)}</span>
              </div>
            ))}
          </div>)}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Producto Terminado</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Salidas de producto terminado</h3>
            <p className="text-xs text-slate-500 mb-3">Egresos consolidados por producto terminado en kg.</p>
            {ptInsights.salidasPorProducto.length === 0 ? (
              <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin salidas registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {ptInsights.salidasPorProducto.map((item, idx) => {
                  const max = Math.max(1, ptInsights.salidasPorProducto[0]?.kg_salidos ?? 1);
                  const width = Math.max(8, (item.kg_salidos / max) * 100);
                  return (
                    <div key={`${item.producto_id}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.nombre_producto}</p>
                          <p className="text-slate-500">{item.cantidad_movimientos} movimientos · Última salida {item.ultima_salida ? new Date(item.ultima_salida).toLocaleDateString('es-AR') : 'Sin dato'}</p>
                        </div>
                        <p className="font-semibold text-blue-700 shrink-0">{item.kg_salidos.toLocaleString('es-AR')} kg</p>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">% de producto terminado</h3>
            <p className="text-xs text-slate-500 mb-3">Participación del stock PT actual por producto.</p>
            {ptInsights.participacionStock.length === 0 ? (
              <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin stock de producto terminado para calcular participación.
              </div>
            ) : (
              <div className="space-y-3">
                {ptInsights.participacionStock.map((item, idx) => {
                  const max = Math.max(1, ptInsights.participacionStock[0]?.stock_actual ?? 1);
                  const width = Math.max(8, (item.stock_actual / max) * 100);
                  return (
                    <div key={`${item.producto_id ?? item.nombre_producto}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.nombre_producto}</p>
                          <p className="text-slate-500">{item.stock_actual.toLocaleString('es-AR')} kg · {item.porcentaje.toFixed(1)}%</p>
                        </div>
                        <p className="font-semibold text-violet-700 shrink-0">{item.porcentaje.toFixed(1)}%</p>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">PT entregado por cliente</h3>
            <p className="text-xs text-slate-500 mb-3">Últimas salidas con cliente asociado, producto y fecha.</p>
            {ptInsights.entregasPorCliente.length === 0 ? (
              <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin movimientos de clientes para mostrar.
              </div>
            ) : (
              <div className="space-y-2">
                {ptInsights.entregasPorCliente.map((item, idx) => (
                  <div key={`${item.producto_nombre}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.cliente_nombre}</p>
                        <p className="text-xs text-slate-500 truncate">{item.producto_nombre} · {new Date(item.fecha).toLocaleDateString('es-AR')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-700">{item.kg.toLocaleString('es-AR')} kg</p>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">{item.referencia ?? 'Sin referencia'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      <Card className="border-red-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Alertas operativas</h2>
            <p className="text-sm text-slate-500 mt-1">Pendientes detectadas: {summary.pendientes} · Críticas activas: {summary.criticas}</p>
            <p className="text-xs text-slate-400 mt-1">La auditoría operativa real vive en el módulo Trazabilidad; aquí solo ves el estado resumido de alertas.</p>
          </div>
          <Link to={ROUTES.ALERTAS} className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-700 text-sm font-semibold">Ver alertas operativas</Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-3">Órdenes recientes</h2>
        <DataTable minWidthClassName="min-w-[680px]">
          <TableHeader><tr><TableCell header>Lote</TableCell><TableCell header>Producto</TableCell><TableCell header>Responsable</TableCell><TableCell header>Objetivo</TableCell><TableCell header>Estado</TableCell></tr></TableHeader>
          <TableBody>
            {recientes.map((o) => <TableRow key={o.id}><TableCell>{o.lote}</TableCell><TableCell>{o.nombre_producto}</TableCell><TableCell>{o.usuario_responsable}</TableCell><TableCell>{o.cantidad_objetivo.toLocaleString('es-AR')} kg</TableCell><TableCell><StatusBadge value={o.estado} /></TableCell></TableRow>)}
            {recientes.length === 0 ? <EmptyState colSpan={5} message="Todavía no hay órdenes para mostrar." /> : null}
          </TableBody>
        </DataTable>
      </Card>

      {loading ? <p className="text-sm text-gray-500">Cargando métricas…</p> : null}
      {isExpedicionOpen ? (
        <OrdenExpedicionModal
          onClose={() => setIsExpedicionOpen(false)}
          onSuccess={reload}
        />
      ) : null}
    </div>
  );
};

export default DashboardPage;
