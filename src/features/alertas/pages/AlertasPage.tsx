import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiDollarSign, FiPackage, FiSettings } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { StatusBadge } from '../../../shared/components/table';
import { useAlertas } from '../hooks/useAlertas';
import { alertaConfiguracionService } from '../services/alertaConfiguracionService';
import type { AlertaConfiguracion, AlertaOperativa, EstadoAlerta, PrioridadAlerta } from '../types/alerta';
import { getAlertCategory } from '../utils/alertasClasificacion';

const priorityLabel: Record<PrioridadAlerta, string> = { critica: 'Crítica', media: 'Media', informativa: 'Informativa' };
const estadoLabel: Record<EstadoAlerta, string> = { pendiente: 'Pendiente', 'en seguimiento': 'En seguimiento', atendida: 'Atendida', descartada: 'Descartada' };
const priorityScore: Record<PrioridadAlerta, number> = { critica: 3, media: 2, informativa: 1 };
const statusScore: Record<EstadoAlerta, number> = { pendiente: 2, 'en seguimiento': 1, atendida: 0, descartada: 0 };

const categoryMeta = {
  financiera: { title: 'Alertas Financieras', description: 'Tesorería, cheques, flujo de caja, cuentas y costos.', icon: FiDollarSign, empty: 'No hay alertas financieras activas.', pillClass: 'bg-amber-100 text-amber-800', accent: 'from-amber-400 to-yellow-500', iconBg: 'bg-amber-100 text-amber-700', border: 'border-amber-200', glow: 'shadow-[0_18px_40px_rgba(245,158,11,.12)]' },
  produccion: { title: 'Alertas de Producción', description: 'Órdenes, stock, insumos, fórmulas, lotes y trazabilidad.', icon: FiSettings, empty: 'No hay alertas de producción activas.', pillClass: 'bg-blue-100 text-blue-800', accent: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-100 text-blue-700', border: 'border-blue-200', glow: 'shadow-[0_18px_40px_rgba(59,130,246,.12)]' },
} as const;

const escapeHtml = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const toLabel = (key: string) => key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const formatDatoAsociadoHtml = (dato: AlertaOperativa['datoAsociado']) => {
  const entries = Object.entries(dato).filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (entries.length === 0) return '<p style="margin:0; color:#64748b;">Sin dato asociado.</p>';
  return entries.map(([key, value]) => `<p style="margin:0 0 6px;"><strong>${escapeHtml(toLabel(key))}:</strong> ${escapeHtml(typeof value === 'number' ? value.toLocaleString('es-AR') : String(value))}</p>`).join('');
};

const isActiveAlert = (alerta: AlertaOperativa) => alerta.estado !== 'atendida' && alerta.estado !== 'descartada';

const AlertasPage = () => {
  const { alertas, updateEstado, isLoading, loadError } = useAlertas();
  const [priorityFilter, setPriorityFilter] = useState<'todas' | PrioridadAlerta>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | EstadoAlerta>('todos');
  const [configuraciones, setConfiguraciones] = useState<AlertaConfiguracion[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadConfiguraciones = async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      setConfiguraciones(await alertaConfiguracionService.getAll());
    } catch (error) {
      console.error('Error cargando configuraciones de alerta:', error);
      setConfigError('No se pudieron cargar las configuraciones de alertas.');
      setConfiguraciones([]);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => { void loadConfiguraciones(); }, []);

  const filtered = useMemo(() => alertas
    .filter((alerta) => (priorityFilter === 'todas' || alerta.prioridad === priorityFilter) && (statusFilter === 'todos' || alerta.estado === statusFilter))
    .sort((a, b) => {
      const attendedDiff = Number(a.estado === 'atendida') - Number(b.estado === 'atendida');
      if (attendedDiff !== 0) return attendedDiff;
      const prioDiff = priorityScore[b.prioridad] - priorityScore[a.prioridad];
      if (prioDiff !== 0) return prioDiff;
      return statusScore[b.estado] - statusScore[a.estado];
    }), [alertas, priorityFilter, statusFilter]);

  useEffect(() => { setCurrentPage(1); }, [priorityFilter, statusFilter]);
  useEffect(() => { if (currentPage > Math.max(1, Math.ceil(filtered.length / pageSize))) setCurrentPage(Math.max(1, Math.ceil(filtered.length / pageSize))); }, [currentPage, filtered.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, filtered]);
  const groupedAlerts = useMemo(() => {
    const activeAlerts = alertas.filter(isActiveAlert);
    return {
      financial: activeAlerts.filter((a) => getAlertCategory(a) === 'financiera'),
      production: activeAlerts.filter((a) => getAlertCategory(a) === 'produccion'),
    };
  }, [alertas]);

  const handleFinalizar = async (alerta: AlertaOperativa) => {
    const result = await Swal.fire({ title: '¿Finalizar alerta?', text: 'La alerta quedará marcada como atendida.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, finalizar', cancelButtonText: 'Cancelar', background: '#ffffff', color: '#0f172a', confirmButtonColor: '#2563eb', cancelButtonColor: '#94a3b8' });
    if (!result.isConfirmed) return;
    await updateEstado(alerta.id, 'atendida');
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Centro de alertas</p>
        <h1 className="text-3xl font-bold mt-2">Alertas del sistema</h1>
        <p className="text-slate-500 mt-2">Separadas por impacto financiero y operativo para priorizar la respuesta.</p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {([
          { key: 'financiera', groupedKey: 'financial' },
          { key: 'produccion', groupedKey: 'production' },
        ] as const).map(({ key, groupedKey }) => {
          const meta = categoryMeta[key];
          const alerts = groupedAlerts[groupedKey];
          const criticalCount = alerts.filter((alerta) => alerta.prioridad === 'critica').length;
          const Icon = meta.icon;
          return (
            <Card key={key} className={`relative overflow-hidden border ${meta.border} ${meta.glow} bg-white`}>
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`} />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${meta.iconBg}`}>
                    <Icon className="h-7 w-7" />
                    {key === 'financiera' ? <FiBell className="absolute bottom-0 right-0 h-4 w-4 translate-x-1 translate-y-1 rounded-full bg-white p-0.5 text-amber-500 shadow-sm" /> : null}
                    {key === 'produccion' ? <FiPackage className="absolute bottom-0 right-0 h-4 w-4 translate-x-1 translate-y-1 rounded-full bg-white p-0.5 text-blue-600 shadow-sm" /> : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{meta.title}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">{alerts.length}</h2>
                    <p className="mt-1 text-sm text-slate-600">{meta.description}</p>
                  </div>
                </div>
                <div className="min-w-[92px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Activas</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{alerts.length}</p>
                  <p className="text-[11px] text-slate-500">{criticalCount > 0 ? `${criticalCount} críticas` : 'Sin críticas'}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <Card>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'todas' | PrioridadAlerta)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
            <option value="todas">Todas las prioridades</option>
            <option value="critica">Críticas</option>
            <option value="media">Medias</option>
            <option value="informativa">Informativas</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'todos' | EstadoAlerta)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en seguimiento">En seguimiento</option>
            <option value="atendida">Atendida</option>
            <option value="descartada">Descartada</option>
          </select>
        </div>

        {isLoading ? <div className="text-sm text-slate-500 py-6">Cargando alertas...</div> : null}
        {loadError ? <div className="text-sm text-red-600 py-4">{loadError}</div> : null}
        {!isLoading && !loadError && alertas.length === 0 ? <div className="text-sm text-slate-500 py-8 text-center">No hay alertas operativas registradas.</div> : null}
        {!isLoading && !loadError && alertas.length > 0 && filtered.length === 0 ? <div className="text-sm text-slate-500 py-8 text-center">No hay alertas para los filtros seleccionados.</div> : null}

        {!isLoading && filtered.length > 0 ? (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1200px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Severidad</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Alerta</th>
                  <th className="px-4 py-3">Entidad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((alerta) => (
                  <tr key={alerta.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3"><StatusBadge value={priorityLabel[alerta.prioridad]} /></td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{alerta.area}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{alerta.titulo}</div>
                      <div className="text-xs text-slate-500">{alerta.descripcion}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {alerta.datoAsociado.producto || alerta.datoAsociado.insumo || alerta.datoAsociado.cheque || alerta.datoAsociado.cliente || alerta.datoAsociado.orden || 'Sin dato'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge value={estadoLabel[alerta.estado]} /></td>
                    <td className="px-4 py-3 text-slate-600">{alerta.fechaRelativa}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => void Swal.fire({ title: alerta.titulo, html: `<div style="text-align:left;color:#0f172a;font-size:14px;"><p style="margin:0 0 8px;"><strong>Impacto operativo:</strong> ${escapeHtml(alerta.impactoOperativo)}</p><div style="margin:0 0 8px;"><strong>Dato asociado:</strong>${formatDatoAsociadoHtml(alerta.datoAsociado)}</div><p style="margin:0 0 8px;"><strong>Acción recomendada:</strong> ${escapeHtml(alerta.accionRecomendada)}</p></div>`, background: '#ffffff', color: '#0f172a', confirmButtonColor: '#2563eb', confirmButtonText: 'Cerrar', width: 760 })}>Detalle</button>
                        <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => void updateEstado(alerta.id, 'en seguimiento')}>Seguimiento</button>
                        {alerta.estado !== 'atendida' && alerta.estado !== 'descartada' ? <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500" onClick={() => void handleFinalizar(alerta)}>Finalizar</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Total de alertas: <strong className="text-slate-900">{filtered.length}</strong> · Página <strong className="text-slate-900">{currentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong></p>
            <div className="flex gap-2">
              <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Configuración de alertas</h2>
            <p className="text-sm text-slate-500">Reglas persistidas en Supabase para stock, tesorería y producción.</p>
          </div>
          <button type="button" onClick={() => void loadConfiguraciones()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Recargar</button>
        </div>
        {configError ? <p className="mt-3 text-sm text-rose-600">{configError}</p> : null}
        {configLoading ? <p className="mt-3 text-sm text-slate-500">Cargando configuraciones...</p> : null}
        {!configLoading && configuraciones.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay reglas configuradas.</p> : null}
        {!configLoading && configuraciones.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {configuraciones.map((config) => (
              <div key={config.id} className={`rounded-2xl border px-4 py-3 ${config.esta_activa ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{config.modulo} / {config.entidad_tipo}</p>
                    <h3 className="mt-1 font-semibold text-slate-900">{config.nombre}</h3>
                    <p className="mt-1 text-sm text-slate-600">{config.umbral_critico !== null ? `Crítico: ${config.umbral_critico} ${config.unidad ?? ''}` : null}{config.umbral_minimo !== null ? ` · Mínimo: ${config.umbral_minimo} ${config.unidad ?? ''}` : null}{config.dias_anticipacion !== null ? ` · Anticipación: ${config.dias_anticipacion} días` : null}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${config.esta_activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{config.esta_activa ? 'Activa' : 'Inactiva'}</span>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button type="button" onClick={async () => { await alertaConfiguracionService.toggleActive(config.id, !config.esta_activa); await loadConfiguraciones(); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">{config.esta_activa ? 'Desactivar' : 'Activar'}</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default AlertasPage;
