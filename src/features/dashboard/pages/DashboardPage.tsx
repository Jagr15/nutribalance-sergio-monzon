import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { ROUTES } from '../../../app/config/routes';
import { useAlertas } from '../../alertas/hooks/useAlertas';
import { useDashboardOperativo } from '../hooks/useDashboardOperativo';
import { ApiService } from '../../../infrastructure/api';
import type { OrdenProduccion } from '../../ordenes/types';
import { DataTable, EmptyState, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';

const fmtARS = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '0.00');

export const DashboardPage = () => {
  const { summary, alertas } = useAlertas();
  const { kpis, formulas, consumoMensual, stockResumenes, loading } = useDashboardOperativo();
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void ApiService.ordenes.getAll().then(setOrdenes).catch((e) => console.error('Error órdenes:', e));
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

  const formulaPie = useMemo(() => formulas.slice(0, 5), [formulas]);
  const totalPie = Math.max(1, formulaPie.reduce((a, b) => a + b.total_pct, 0));
  const formulaRingStyle = useMemo(() => {
    if (formulaPie.length === 0) return undefined;
    const colors = ['#0ea5e9', '#14b8a6', '#f59e0b', '#818cf8', '#64748b'];
    let acc = 0;
    const segments = formulaPie.map((item, idx) => {
      const start = (acc / totalPie) * 360;
      acc += item.total_pct;
      const end = (acc / totalPie) * 360;
      return `${colors[idx % colors.length]} ${start}deg ${end}deg`;
    });
    return { background: `conic-gradient(${segments.join(',')})` };
  }, [formulaPie, totalPie]);

  const stockMpResumen = stockResumenes.stockMateriaPrima;
  const stockPtResumen = stockResumenes.stockProductoTerminado;

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

  const alertasTop = useMemo(() => {
    const priorityScore = (priority: string) => (priority === 'critica' ? 3 : priority === 'media' ? 2 : 1);
    const stateScore = (state: string) => (state === 'pendiente' ? 3 : state === 'en seguimiento' ? 2 : state === 'atendida' ? 1 : 0);

    return [...alertas]
      .filter((a) => a.estado !== 'atendida' && a.estado !== 'descartada')
      .sort((a, b) => {
        const priorityDelta = priorityScore(b.prioridad) - priorityScore(a.prioridad);
        if (priorityDelta !== 0) return priorityDelta;
        return stateScore(b.estado) - stateScore(a.estado);
      })
      .slice(0, 3);
  }, [alertas]);

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

  const recientes = useMemo(() => ordenes.slice().sort((a, b) => +new Date(b.fecha_creacion) - +new Date(a.fecha_creacion)).slice(0, 5), [ordenes]);
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
        <h2 className="text-lg font-bold text-slate-900 mb-3">Materia Prima</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card><p className="text-xs text-slate-500">Stock físico MP</p><p className="text-3xl font-black mt-2 text-cyan-300">{kpis.stock_total_mp.toLocaleString('es-AR')} kg</p></Card>
          <Card><p className="text-xs text-slate-500">Stock comprometido MP</p><p className="text-3xl font-black mt-2 text-orange-300">{kpis.stock_comprometido_mp.toLocaleString('es-AR')} kg</p></Card>
          <Card><p className="text-xs text-slate-500">Stock disponible MP</p><p className="text-3xl font-black mt-2 text-emerald-300">{kpis.stock_disponible_mp.toLocaleString('es-AR')} kg</p></Card>
          <Card><p className="text-xs text-slate-500">Lotes críticos</p><p className="text-3xl font-black mt-2 text-red-300">{kpis.stock_critico}</p></Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Producción</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card><p className="text-xs text-slate-500">OP pendientes</p><p className="text-3xl font-black mt-2 text-blue-300">{kpis.ordenes_pendientes}</p></Card>
          <Card><p className="text-xs text-slate-500">OP en proceso</p><p className="text-3xl font-black mt-2 text-sky-300">{kpis.ordenes_en_proceso}</p></Card>
          <Card><p className="text-xs text-slate-500">OP finalizadas</p><p className="text-3xl font-black mt-2 text-emerald-300">{kpis.ordenes_finalizadas}</p></Card>
          <Card>
            <p className="text-xs text-slate-500">Producción total</p>
            <p className="text-3xl font-black mt-2 text-amber-300">{kpis.produccion_total.toLocaleString('es-AR')} kg</p>
            <p className="text-xs text-slate-400 mt-2">
              Merma total: {kpis.merma_total.toLocaleString('es-AR')} kg · Costo prom.: {fmtARS(kpis.costo_promedio_produccion)}
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Producto Terminado</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><p className="text-xs text-slate-500">Stock PT total</p><p className="text-3xl font-black mt-2 text-fuchsia-300">{kpis.stock_total_pt.toLocaleString('es-AR')} kg</p></Card>
          <Card>
            <p className="text-xs text-slate-500">Valor inventario PT</p>
            <p className="text-3xl font-black mt-2 text-violet-300">{valorInventarioPtLabel}</p>
            <p className="text-xs text-slate-400 mt-2">Base estimada desde órdenes finalizadas con costo real disponible.</p>
          </Card>
        </div>
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
          <h3 className="font-semibold mb-3">Composición de fórmula: top insumos</h3>
          {formulaPie.length === 0 ? (
            <div className="h-48 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              Sin composición disponible todavía.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative h-44 w-44 md:h-48 md:w-48 mx-auto shrink-0">
                <div className="absolute inset-0 rounded-full" style={formulaRingStyle} />
                <div className="absolute inset-[22%] rounded-full bg-white border border-slate-100 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Top</p>
                    <p className="text-xs font-semibold text-slate-700">{formulaPie.length} insumos</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                {formulaPie.map((item, idx) => (
                  <div key={`${item.id_formula}-${item.nombre_producto}-${idx}`} className="flex items-center gap-2 text-slate-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ['#0ea5e9', '#14b8a6', '#f59e0b', '#818cf8', '#64748b'][idx % 5] }} />
                    <span>{item.nombre_producto}</span>
                    <span className="font-semibold ml-auto">{item.total_pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3">Proteína promedio fórmulas: <strong>{fmtPct(kpis.proteina_promedio_formula)}%</strong></p>
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
    </div>
  );
};

export default DashboardPage;
