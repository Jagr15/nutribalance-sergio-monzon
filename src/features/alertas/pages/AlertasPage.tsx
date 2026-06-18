import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { StatusBadge, TableActionButton, TableActions } from '../../../shared/components/table';
import { useAlertas } from '../hooks/useAlertas';
import type { AlertaOperativa, EstadoAlerta, PrioridadAlerta } from '../types/alerta';

const priorityLabel: Record<PrioridadAlerta, string> = {
  critica: 'Crítica',
  media: 'Media',
  informativa: 'Informativa',
};

const estadoLabel: Record<EstadoAlerta, string> = {
  pendiente: 'Pendiente',
  'en seguimiento': 'En seguimiento',
  atendida: 'Atendida',
  descartada: 'Descartada',
};

const priorityScore: Record<PrioridadAlerta, number> = {
  critica: 3,
  media: 2,
  informativa: 1,
};

const statusScore: Record<EstadoAlerta, number> = {
  pendiente: 2,
  'en seguimiento': 1,
  atendida: 0,
  descartada: 0,
};

const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toLabel = (key: string) =>
  key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatDatoAsociadoHtml = (dato: AlertaOperativa['datoAsociado']) => {
  const entries = Object.entries(dato).filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (entries.length === 0) return '<p style="margin:0; color:#64748b;">Sin dato asociado.</p>';

  return entries
    .map(([key, value]) => {
      const formatted = typeof value === 'number' ? value.toLocaleString('es-AR') : String(value);
      return `<p style="margin:0 0 6px;"><strong>${escapeHtml(toLabel(key))}:</strong> ${escapeHtml(formatted)}</p>`;
    })
    .join('');
};

const getOrigenDetalle = (alerta: AlertaOperativa) => {
  if (alerta.area === 'stock') return `Lote: ${alerta.datoAsociado.lote || 'Sin dato'} · Insumo: ${alerta.datoAsociado.insumo || 'Sin dato'} · Stock disponible bajo cobertura operativa.`;
  if (alerta.area === 'produccion') return `Orden: ${alerta.datoAsociado.orden || 'Sin dato'} · Producto: ${alerta.datoAsociado.producto || 'Sin dato'} · Merma y costo revisados.`;
  if (alerta.area === 'clientes') return `Cliente: ${alerta.datoAsociado.cliente || 'Sin dato'} · Saldo vencido y vencimiento crítico de cuenta corriente.`;
  if (alerta.area === 'costos') return `Insumo: ${alerta.datoAsociado.insumo || 'Sin dato'} · Variación de costo con impacto en margen de fórmula.`;
  if (alerta.area === 'tesoreria') return `Tesorería: ${alerta.datoAsociado.cheque || alerta.datoAsociado.cliente || 'Sin dato'} · Revisar cobertura, vencimientos y flujo proyectado.`;
  return `Producto: ${alerta.datoAsociado.producto || 'Sin dato'} · Rotación y cobertura comercial por debajo de objetivo.`;
};

const AlertasPage = () => {
  const { alertas, summary, updateEstado, isLoading, loadError } = useAlertas();
  const [priorityFilter, setPriorityFilter] = useState<'todas' | PrioridadAlerta>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | EstadoAlerta>('todos');

  const filtered = useMemo(() => {
    const rows = alertas
      .filter((alerta) => {
        const byPriority = priorityFilter === 'todas' || alerta.prioridad === priorityFilter;
        const byStatus = statusFilter === 'todos' || alerta.estado === statusFilter;
        return byPriority && byStatus;
      })
      .sort((a, b) => {
        const attendedDiff = Number(a.estado === 'atendida') - Number(b.estado === 'atendida');
        if (attendedDiff !== 0) return attendedDiff;
        const prioDiff = priorityScore[b.prioridad] - priorityScore[a.prioridad];
        if (prioDiff !== 0) return prioDiff;
        return statusScore[b.estado] - statusScore[a.estado];
      });
    return rows;
  }, [alertas, priorityFilter, statusFilter]);

  const openDetalle = (alerta: AlertaOperativa) => {
    void Swal.fire({
      title: alerta.titulo,
      html: `<div style="text-align:left; color:#0f172a; font-size:14px;"><p style="margin:0 0 8px;"><strong>Impacto operativo:</strong> ${escapeHtml(alerta.impactoOperativo)}</p><div style="margin:0 0 8px;"><strong>Dato asociado:</strong>${formatDatoAsociadoHtml(alerta.datoAsociado)}</div><p style="margin:0 0 8px;"><strong>Acción recomendada:</strong> ${escapeHtml(alerta.accionRecomendada)}</p><p style="margin:0 0 8px;"><strong>Prioridad:</strong> ${priorityLabel[alerta.prioridad]}</p><p style="margin:0 0 8px;"><strong>Estado:</strong> ${estadoLabel[alerta.estado]}</p><p style="margin:0;"><strong>Fecha:</strong> ${escapeHtml(alerta.fechaRelativa)}</p></div>`,
      background: '#ffffff', color: '#0f172a', confirmButtonColor: '#2563eb', confirmButtonText: 'Cerrar', width: 760,
    });
  };

  const openOrigen = (alerta: AlertaOperativa) => {
    void Swal.fire({
      title: `Origen · ${alerta.area}`,
      html: `<div style="text-align:left; color:#0f172a; font-size:14px;"><p style="margin:0 0 8px;">${getOrigenDetalle(alerta)}</p><p style="margin:0;"><strong>Referencia:</strong> ${alerta.descripcion}</p></div>`,
      background: '#ffffff', color: '#0f172a', confirmButtonColor: '#2563eb', confirmButtonText: 'Cerrar',
    });
  };

  const handleFinalizar = async (alerta: AlertaOperativa) => {
    const result = await Swal.fire({
      title: '¿Finalizar alerta?',
      text: 'La alerta quedará marcada como atendida.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#94a3b8',
    });
    if (!result.isConfirmed) return;
    await updateEstado(alerta.id, 'atendida');
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Centro de alertas</p>
        <h1 className="text-3xl font-bold mt-2">Alertas Operativas</h1>
        <p className="text-slate-500 mt-2">Situaciones activas que requieren seguimiento para mantener continuidad operativa.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-xs uppercase tracking-widest text-slate-500">Pendientes</p><h2 className="text-3xl font-black mt-2 text-red-300">{summary.pendientes}</h2></Card>
        <Card><p className="text-xs uppercase tracking-widest text-slate-500">Críticas activas</p><h2 className="text-3xl font-black mt-2 text-red-300">{summary.criticas}</h2></Card>
        <Card><p className="text-xs uppercase tracking-widest text-slate-500">En seguimiento</p><h2 className="text-3xl font-black mt-2 text-orange-300">{summary.seguimiento}</h2></Card>
      </section>

      <Card>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'todas' | PrioridadAlerta)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
            <option value="todas">Todas las prioridades</option><option value="critica">Críticas</option><option value="media">Medias</option><option value="informativa">Informativas</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'todos' | EstadoAlerta)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
            <option value="todos">Todos los estados</option><option value="pendiente">Pendiente</option><option value="en seguimiento">En seguimiento</option><option value="atendida">Atendida</option><option value="descartada">Descartada</option>
          </select>
        </div>

        {isLoading ? <div className="text-sm text-slate-500 py-6">Cargando alertas...</div> : null}
        {loadError ? <div className="text-sm text-red-600 py-4">{loadError}</div> : null}
        {!isLoading && !loadError && alertas.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No hay alertas operativas registradas.</div>
        ) : null}
        {!isLoading && !loadError && alertas.length > 0 && filtered.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No hay alertas para los filtros seleccionados.</div>
        ) : null}

        <div className="space-y-3">
          {filtered.map((alerta) => (
            <div key={alerta.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{alerta.titulo}</h3>
                  <p className="text-sm text-slate-500 mt-1">{alerta.descripcion}</p>
                  <p className="text-xs text-slate-500 mt-2">{alerta.fechaRelativa} · Área {alerta.area}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={priorityLabel[alerta.prioridad]} />
                  <StatusBadge value={estadoLabel[alerta.estado]} />
                </div>
              </div>

              <div className="mt-4">
                <TableActions className="justify-start">
                  <TableActionButton label="Detalle" tone="secondary" onClick={() => openDetalle(alerta)} />
                  <TableActionButton label="Origen" tone="secondary" onClick={() => openOrigen(alerta)} />
                  {alerta.estado === 'pendiente' ? <TableActionButton label="Seguimiento" tone="secondary" onClick={() => void updateEstado(alerta.id, 'en seguimiento')} /> : null}
                  {alerta.estado !== 'atendida' && alerta.estado !== 'descartada' ? <TableActionButton label="Finalizar" tone="success" onClick={() => void handleFinalizar(alerta)} /> : null}
                  {alerta.estado === 'atendida' ? <TableActionButton label="Reabrir" tone="secondary" onClick={() => void updateEstado(alerta.id, 'pendiente')} /> : null}
                </TableActions>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AlertasPage;
