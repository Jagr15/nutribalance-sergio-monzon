import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../shared/components/card';
import { useDashboardOperativo } from '../hooks/useDashboardOperativo';
import { BrandLogo } from '../../../shared/components/BrandLogo';
import { fmtARS, fmtDateTime } from '../components/dashboardFormat';
import { KPIBox } from '../components/dashboardShared';
import { buildDashboardExecutiveInsights, getDashboardPeriodoLabel, isWithinDashboardPeriodo } from '../utils/dashboardExecutiveInsights';
import { buildDashboardTemporalInsights } from '../utils/dashboardTemporalInsights';
import { useAlertas } from '../../alertas/hooks/useAlertas';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import type { AlertaOperativa } from '../../alertas/types/alerta';

type AreaEstado = 'OK' | 'Atención' | 'Riesgo';

const stateStyles: Record<AreaEstado, string> = {
  OK: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Atención: 'border-amber-200 bg-amber-50 text-amber-800',
  Riesgo: 'border-rose-200 bg-rose-50 text-rose-800',
};

const priorityScore = (value: AlertaOperativa['prioridad']) => (value === 'critica' ? 3 : value === 'media' ? 2 : 1);

const DashboardExecutivePage = () => {
  const { alertas } = useAlertas();
  const { kpis, stockResumenes, loading, lastUpdatedAt } = useDashboardOperativo();
  const dashboardNow = useMemo(() => new Date(), []);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);

  useEffect(() => {
    void Promise.allSettled([
      import('../../../infrastructure/api').then((m) => m.ApiService.ordenes.getAll()),
      import('../../../infrastructure/api').then((m) => m.ApiService.clientes.getAll()),
      import('../../../infrastructure/api').then((m) => m.ApiService.stockPT.getMovimientos()),
    ]).then(([ordenesResult, clientesResult, movimientosResult]) => {
      if (ordenesResult.status === 'fulfilled') setOrdenes(ordenesResult.value);
      if (clientesResult.status === 'fulfilled') setClientes(clientesResult.value);
      if (movimientosResult.status === 'fulfilled') setMovimientosPT(movimientosResult.value);
    });
  }, []);

  const executiveMovimientos = useMemo(() => movimientosPT.filter((mov) => isWithinDashboardPeriodo(mov.created_at, 'MES', dashboardNow)), [dashboardNow, movimientosPT]);
  const executiveInsights = useMemo(() => buildDashboardExecutiveInsights(executiveMovimientos, clientes, 'MES', dashboardNow), [clientes, dashboardNow, executiveMovimientos]);
  const temporalInsights = useMemo(() => buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, 'MES', dashboardNow), [alertas, dashboardNow, movimientosPT, ordenes]);
  const periodLabel = getDashboardPeriodoLabel('MES');
  const updatedAtLabel = fmtDateTime(lastUpdatedAt);
  const productionState: AreaEstado = kpis.ordenes_pendientes === 0 && kpis.ordenes_en_proceso > 0 ? 'OK' : kpis.ordenes_pendientes > 10 ? 'Riesgo' : 'Atención';
  const inventoryState: AreaEstado = kpis.stock_critico > 15 ? 'Riesgo' : kpis.stock_critico > 0 ? 'Atención' : 'OK';
  const financeState: AreaEstado = temporalInsights.flujoCaja < 0 ? 'Riesgo' : temporalInsights.flujoCaja === 0 ? 'Atención' : 'OK';
  const salesState: AreaEstado = executiveInsights.totalImporte > 0 && executiveInsights.clientesAtendidos > 0 ? 'OK' : executiveInsights.totalImporte === 0 ? 'Riesgo' : 'Atención';

  const areaMatrix = [
    {
      label: 'Producción',
      state: productionState,
      detail: kpis.ordenes_pendientes === 0
        ? 'Sin órdenes pendientes relevantes.'
        : `${kpis.ordenes_pendientes} órdenes pendientes y ${kpis.ordenes_en_proceso} en proceso.`,
    },
    {
      label: 'Inventario',
      state: inventoryState,
      detail: kpis.stock_critico === 0
        ? 'Sin stock crítico detectado.'
        : `${kpis.stock_critico} insumos críticos.`,
    },
    {
      label: 'Finanzas',
      state: financeState,
      detail: temporalInsights.flujoCaja >= 0
        ? `Flujo de caja positivo (${fmtARS(temporalInsights.flujoCaja)}).`
        : `Flujo de caja negativo (${fmtARS(temporalInsights.flujoCaja)}).`,
    },
    {
      label: 'Ventas',
      state: salesState,
      detail: executiveInsights.clientesAtendidos > 0
        ? `${executiveInsights.clientesAtendidos} clientes atendidos y ${fmtARS(executiveInsights.totalImporte)} vendidos.`
        : 'Sin ventas suficientes en el período actual.',
    },
  ];

  const alertasPriorizadas = [
    ...alertas
      .filter((item) => item.estado !== 'atendida' && item.estado !== 'descartada')
      .sort((a, b) => priorityScore(b.prioridad) - priorityScore(a.prioridad)),
    ...(temporalInsights.flujoCaja < 0 ? [{
      id: 'derived-flujo',
      titulo: 'Flujo de caja negativo',
      descripcion: 'La proyección financiera del período está en negativo.',
      prioridad: 'critica' as const,
      area: 'tesoreria' as const,
      estado: 'pendiente' as const,
      fechaEvento: new Date().toISOString(),
      fechaRelativa: 'Ahora',
      datoAsociado: {},
      accionRecomendada: 'Revisar cobranzas y egresos del período.',
      impactoOperativo: 'Puede afectar pagos y reposición de insumos.',
    }] : []),
    ...(kpis.stock_critico > 0 ? [{
      id: 'derived-stock',
      titulo: 'Stock crítico',
      descripcion: `${kpis.stock_critico} insumos críticos requieren atención.`,
      prioridad: 'media' as const,
      area: 'stock' as const,
      estado: 'pendiente' as const,
      fechaEvento: new Date().toISOString(),
      fechaRelativa: 'Ahora',
      datoAsociado: { disponible_kg: kpis.stock_critico },
      accionRecomendada: 'Reponer inventario crítico.',
      impactoOperativo: 'Puede frenar producción o despachos.',
    }] : []),
    ...(kpis.ordenes_pendientes > 0 ? [{
      id: 'derived-orders',
      titulo: 'Órdenes pendientes',
      descripcion: `${kpis.ordenes_pendientes} órdenes aún no finalizadas.`,
      prioridad: kpis.ordenes_pendientes > 10 ? 'media' as const : 'informativa' as const,
      area: 'produccion' as const,
      estado: 'pendiente' as const,
      fechaEvento: new Date().toISOString(),
      fechaRelativa: 'Ahora',
      datoAsociado: { cantidad_objetivo: kpis.ordenes_pendientes },
      accionRecomendada: 'Priorizar el cierre de órdenes abiertas.',
      impactoOperativo: 'Reduce el tiempo de ciclo y libera capacidad.',
    }] : []),
  ]
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => priorityScore(b.prioridad) - priorityScore(a.prioridad))
    .slice(0, 5);

  const accionesRecomendadas = [
    temporalInsights.flujoCaja < 0 ? 'Revisar compras de materia prima y egresos del período.' : null,
    kpis.ordenes_pendientes > 0 ? 'Gestionar las órdenes pendientes para liberar capacidad.' : null,
    kpis.stock_critico > 0 ? 'Reponer inventario crítico antes de afectar producción.' : null,
    alertas.some((item) => item.area === 'tesoreria' && item.estado !== 'atendida' && item.estado !== 'descartada') ? 'Revisar cheques próximos a vencer y cobranzas pendientes.' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const handleExportPdf = () => {
    void import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const width = doc.internal.pageSize.getWidth();
      let y = 18;
      const line = (label: string, value: string) => { doc.setFontSize(10); doc.setTextColor(100,116,139); doc.text(label, 14, y); doc.setTextColor(15,23,42); doc.setFont('helvetica', 'bold'); doc.text(value, 76, y); y += 6; };
      const section = (title: string) => { y += 2; doc.setFontSize(13); doc.setTextColor(15,23,42); doc.text(title, 14, y); y += 5; doc.setDrawColor(226,232,240); doc.line(14, y, width - 14, y); y += 5; };
      doc.setFillColor(14, 165, 233);
      doc.rect(0, 0, width, 24, 'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('DITMON AGRO', 14, 14);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte Ejecutivo DITMON AGRO', 14, 20);
      doc.text(new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()), width - 14, 20, { align: 'right' });
      y = 34;
      section('Salud general del negocio');
      line('Producción', productionState);
      line('Inventario', inventoryState);
      line('Finanzas', financeState);
      line('Ventas', salesState);
      section('KPIs principales');
      line('Producción total', `${kpis.produccion_total.toLocaleString('es-AR')} kg`);
      line('Stock disponible MP', `${kpis.stock_disponible_mp.toLocaleString('es-AR')} kg`);
      line('Ingresos', fmtARS(temporalInsights.ingresos));
      line('Costos', fmtARS(temporalInsights.costos));
      line('Flujo de caja', fmtARS(temporalInsights.flujoCaja));
      section('Alertas prioritarias');
      alertasPriorizadas.slice(0, 5).forEach((item) => line(item.titulo, item.descripcion));
      section('Acciones recomendadas');
      accionesRecomendadas.forEach((item) => line('Acción', item));
      section('Producto terminado / clientes principales');
      executiveInsights.ventasPorProducto.slice(0, 3).forEach((item) => line(item.producto_nombre, `${item.kg.toLocaleString('es-AR')} kg`));
      executiveInsights.topClientesPorVolumen.slice(0, 3).forEach((item) => line(item.cliente_nombre, `${item.kg.toLocaleString('es-AR')} kg`));
      doc.save(`Reporte Ejecutivo DITMON AGRO-${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  };

  if (loading && stockResumenes.stockMateriaPrima.length === 0 && stockResumenes.stockProductoTerminado.length === 0) {
    return <div className="space-y-6"><Card><p className="text-sm text-slate-500">Cargando dashboard ejecutivo...</p></Card></div>;
  }

  const productionItems = [
    { label: 'Pendientes', value: kpis.ordenes_pendientes, tone: 'bg-cyan-500' },
    { label: 'En proceso', value: kpis.ordenes_en_proceso, tone: 'bg-blue-500' },
    { label: 'Finalizadas', value: kpis.ordenes_finalizadas, tone: 'bg-emerald-500' },
  ];
  const inventoryItems = [
    { label: 'Disponible MP', value: kpis.stock_disponible_mp, tone: 'bg-emerald-500' },
    { label: 'Comprometido MP', value: kpis.stock_comprometido_mp, tone: 'bg-orange-500' },
    { label: 'Lotes críticos', value: kpis.stock_critico, tone: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Ejecutivo</p>
            <h1 className="text-3xl font-black mt-1">Centro Ejecutivo de Dirección</h1>
            <p className="text-sm text-slate-500 mt-2">Vista compacta con señales clave del negocio hoy.</p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <BrandLogo variant="full" className="max-w-[280px] self-start md:self-center" />
            <button type="button" onClick={handleExportPdf} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white">Exportar PDF</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Periodo: {periodLabel} · Actualizado: {updatedAtLabel}</p>
      </Card>
      <Card className="overflow-hidden">
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Salud General del Negocio</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">Resumen ejecutivo accionable</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {areaMatrix.map((item) => (
                <div key={item.label} className={`rounded-3xl border p-4 shadow-sm ${stateStyles[item.state]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.24em]">{item.label}</p>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em]">{item.state}</span>
                  </div>
                  <p className="mt-2 text-lg font-black text-slate-900">{item.state}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Alertas prioritarias</p>
                <div className="mt-3 space-y-2">
                  {alertasPriorizadas.length > 0 ? alertasPriorizadas.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                      <p className="text-xs text-slate-500">{item.descripcion}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">Sin alertas prioritarias activas.</p>}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Acciones recomendadas</p>
                <div className="mt-3 space-y-2">
                  {accionesRecomendadas.length > 0 ? accionesRecomendadas.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{item}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">No hay acciones prioritarias por ahora.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card><h3 className="font-semibold mb-3">Producción por estado</h3>{productionItems.map((item) => <div key={item.label} className="mb-3"><div className="flex justify-between text-xs mb-1"><span>{item.label}</span><span>{item.value}</span></div><div className="h-3 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full rounded-full ${item.tone}`} style={{ width: `${Math.max(10, (item.value / Math.max(1, kpis.ordenes_pendientes, kpis.ordenes_en_proceso, kpis.ordenes_finalizadas)) * 100)}%` }} /></div></div>)}</Card>
        <Card><h3 className="font-semibold mb-3">Inventario crítico</h3>{inventoryItems.map((item) => <div key={item.label} className="mb-3"><div className="flex justify-between text-xs mb-1"><span>{item.label}</span><span>{item.value.toLocaleString('es-AR')}</span></div><div className="h-3 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full rounded-full ${item.tone}`} style={{ width: `${Math.max(10, (item.value / Math.max(1, kpis.stock_disponible_mp, kpis.stock_comprometido_mp, kpis.stock_critico)) * 100)}%` }} /></div></div>)}</Card>
        <Card><h3 className="font-semibold mb-3">Finanzas rápidas</h3><KPIBox label="Ingresos" value={fmtARS(temporalInsights.ingresos)} trend="unknown" updatedAt={updatedAtLabel} tone="emerald" /><div className="h-2" /><KPIBox label="Costos" value={fmtARS(temporalInsights.costos)} trend="unknown" updatedAt={updatedAtLabel} tone="orange" /><div className="h-2" /><KPIBox label="Flujo de caja" value={fmtARS(temporalInsights.flujoCaja)} trend="unknown" updatedAt={updatedAtLabel} tone={temporalInsights.flujoCaja >= 0 ? 'cyan' : 'red'} /></Card>
        <Card><h3 className="font-semibold mb-3">Producto terminado / ventas</h3>{executiveInsights.ventasPorProducto.slice(0, 3).map((item) => <div key={`${item.producto_nombre}-${item.producto_id ?? 'x'}`} className="mb-3"><div className="flex justify-between text-xs mb-1"><span className="truncate">{item.producto_nombre}</span><span>{item.kg.toLocaleString('es-AR')} kg</span></div><div className="h-3 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500" style={{ width: `${Math.max(10, (item.kg / Math.max(1, executiveInsights.ventasPorProducto[0]?.kg ?? 1)) * 100)}%` }} /></div></div>)}{executiveInsights.topClientesPorVolumen.slice(0, 3).map((item) => <div key={item.cliente_nombre} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><span className="truncate">{item.cliente_nombre}</span><span className="font-semibold text-cyan-700">{item.kg.toLocaleString('es-AR')} kg</span></div>)}</Card>
      </section>
    </div>
  );
};

export default DashboardExecutivePage;
