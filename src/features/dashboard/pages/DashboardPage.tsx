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
  const { kpis, formulas, consumoMensual, loading } = useDashboardOperativo();
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

  const costoLine = useMemo(() => {
    const map = new Map<string, { total: number; cnt: number }>();
    consumoMensual.forEach((c) => {
      const m = map.get(c.mes) ?? { total: 0, cnt: 0 };
      map.set(c.mes, { total: m.total + c.consumo_kg, cnt: m.cnt + 1 });
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([mes, v]) => ({ mes, value: v.total / Math.max(1, v.cnt) }));
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

  const recientes = useMemo(() => ordenes.slice().sort((a, b) => +new Date(b.fecha_creacion) - +new Date(a.fecha_creacion)).slice(0, 5), [ordenes]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Operativo</p>
        <h1 className="text-3xl font-black mt-1">Centro Ejecutivo de Producción</h1>
        <p className="text-sm text-slate-500 mt-2">Métricas reales de stock, producción, costos y trazabilidad.</p>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card><p className="text-xs text-slate-500">Stock total MP</p><p className="text-3xl font-black mt-2 text-cyan-300">{kpis.stock_total_mp.toLocaleString('es-AR')} kg</p></Card>
        <Card><p className="text-xs text-slate-500">Stock crítico</p><p className="text-3xl font-black mt-2 text-red-300">{kpis.stock_critico}</p></Card>
        <Card><p className="text-xs text-slate-500">Órdenes (Pend / Proc / Fin)</p><p className="text-2xl font-black mt-2 text-blue-300">{kpis.ordenes_pendientes} / {kpis.ordenes_en_proceso} / {kpis.ordenes_finalizadas}</p></Card>
        <Card><p className="text-xs text-slate-500">Producción total</p><p className="text-3xl font-black mt-2 text-emerald-300">{kpis.produccion_total.toLocaleString('es-AR')} kg</p></Card>
        <Card><p className="text-xs text-slate-500">Costo promedio producción</p><p className="text-2xl font-black mt-2 text-amber-300">{fmtARS(kpis.costo_promedio_produccion)}</p></Card>
        <Card><p className="text-xs text-slate-500">Merma total</p><p className="text-3xl font-black mt-2 text-orange-300">{kpis.merma_total.toLocaleString('es-AR')} kg</p></Card>
        <Card><p className="text-xs text-slate-500">Valor inventario MP</p><p className="text-2xl font-black mt-2 text-violet-300">{fmtARS(kpis.valor_inventario_mp)}</p></Card>
        <Card><p className="text-xs text-slate-500">Valor inventario PT</p><p className="text-2xl font-black mt-2 text-fuchsia-300">{fmtARS(kpis.valor_inventario_pt)}</p></Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Composición de insumos (donut)</h3>
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
          <h3 className="font-semibold mb-3">Consumo mensual por insumo (barras)</h3>
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
          <h3 className="font-semibold mb-3">Evolución costos (línea)</h3>
          {costoLine.length === 0 ? <p className="text-sm text-slate-700">Sin histórico suficiente para graficar costos.</p> : (
          <div className="flex items-end gap-2 h-44">
            {costoLine.map((p) => (
              <div key={p.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full max-w-8 bg-emerald-500/70 rounded-t" style={{ height: `${Math.max(8, p.value / Math.max(1, Math.max(...costoLine.map((x) => x.value))) * 140)}px` }} />
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
            <p className="text-sm text-slate-500 mt-1">Pendientes: {summary.pendientes} · Críticas: {summary.criticas}</p>
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
