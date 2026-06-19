import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../shared/components/card';
import { useTesoreria } from '../hooks/useTesoreria';
import { ChequeForm } from '../components/ChequeForm';
import { EMPTY_CHEQUE_FORM } from '../components/chequeFormDefaults';
import { tesoreriaService, type ChequeTesoreriaFormValues } from '../services/tesoreriaService';
import type { ChequeTesoreriaRow, EstadoChequeTesoreria } from '../../finanzas/types';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Sin dato';

const TesoreriaPage = () => {
  const { tesoreria, error, createCheque, updateCheque, updateChequeEstado } = useTesoreria();
  const [form, setForm] = useState<ChequeTesoreriaFormValues>(EMPTY_CHEQUE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emitidosPage, setEmitidosPage] = useState(1);
  const [recibidosPage, setRecibidosPage] = useState(1);
  const [emitidos, setEmitidos] = useState<ChequeTesoreriaRow[]>([]);
  const [recibidos, setRecibidos] = useState<ChequeTesoreriaRow[]>([]);
  const [chequesLoading, setChequesLoading] = useState(true);
  const [chequesError, setChequesError] = useState<string | null>(null);
  const [filtroQuery, setFiltroQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'PENDIENTE' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'VENCIDO' | ''>('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'EMITIDO' | 'RECIBIDO' | ''>('');
  const PAGE_SIZE = 20;

  const loadCheques = useCallback(async (emitidosPageValue = emitidosPage, recibidosPageValue = recibidosPage) => {
    setChequesLoading(true);
    try {
      const [emitidosRows, recibidosRows] = await Promise.all([
        tesoreriaService.getCheques({
          tipo: filtroTipo === 'RECIBIDO' ? undefined : 'EMITIDO',
          estado: filtroEstado || undefined,
          query: filtroQuery.trim() || undefined,
          fechaDesde: filtroFechaDesde || undefined,
          fechaHasta: filtroFechaHasta || undefined,
          limit: PAGE_SIZE,
          offset: (emitidosPageValue - 1) * PAGE_SIZE,
        }),
        tesoreriaService.getCheques({
          tipo: filtroTipo === 'EMITIDO' ? undefined : 'RECIBIDO',
          estado: filtroEstado || undefined,
          query: filtroQuery.trim() || undefined,
          fechaDesde: filtroFechaDesde || undefined,
          fechaHasta: filtroFechaHasta || undefined,
          limit: PAGE_SIZE,
          offset: (recibidosPageValue - 1) * PAGE_SIZE,
        }),
      ]);
      setEmitidos(emitidosRows);
      setRecibidos(recibidosRows);
      setChequesError(null);
    } catch (err: unknown) {
      setChequesError(err instanceof Error ? err.message : 'No se pudieron cargar los cheques.');
      setEmitidos([]);
      setRecibidos([]);
    } finally {
      setChequesLoading(false);
    }
  }, [emitidosPage, recibidosPage, filtroQuery, filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroTipo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCheques();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCheques]);

  const resumen = useMemo(() => ({
    emitidos: tesoreria.chequesEmitidos.length,
    recibidos: tesoreria.chequesRecibidos.length,
    alertas: tesoreria.alertasTesoreria.length,
    proyeccion: tesoreria.proyeccionFlujo[0]?.saldo_estimado ?? 0,
  }), [tesoreria]);

  const resetForm = () => {
    setForm(EMPTY_CHEQUE_FORM);
    setEditingId(null);
    setFormError(null);
  };

  const submitCheque = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) await updateCheque(editingId, form);
      else await createCheque(form);
      await loadCheques();
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el cheque.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (cheque: ChequeTesoreriaRow) => {
    setEditingId(cheque.id);
    setForm({
      numero: cheque.numero,
      tipo: cheque.tipo,
      tercero: cheque.tercero,
      importe: cheque.importe,
      fecha_emision: cheque.fecha_emision.slice(0, 10),
      fecha_vencimiento: cheque.fecha_vencimiento.slice(0, 10),
      fecha_acreditacion: cheque.fecha_acreditacion?.slice(0, 10) ?? '',
      estado: cheque.estado,
      cliente_id: cheque.cliente_id,
      cliente_nombre: cheque.cliente_nombre,
    });
    setFormError(null);
  };

  const changeEstado = async (id: string, estado: EstadoChequeTesoreria) => {
    await updateChequeEstado(id, estado);
    void loadCheques();
  };

  const setFilterQuery = (value: string) => {
    setFiltroQuery(value);
    setEmitidosPage(1);
    setRecibidosPage(1);
  };

  const setFilterEstado = (value: typeof filtroEstado) => {
    setFiltroEstado(value);
    setEmitidosPage(1);
    setRecibidosPage(1);
  };

  const setFilterFechaDesde = (value: string) => {
    setFiltroFechaDesde(value);
    setEmitidosPage(1);
    setRecibidosPage(1);
  };

  const setFilterFechaHasta = (value: string) => {
    setFiltroFechaHasta(value);
    setEmitidosPage(1);
    setRecibidosPage(1);
  };

  const setFilterTipo = (value: typeof filtroTipo) => {
    setFiltroTipo(value);
    setEmitidosPage(1);
    setRecibidosPage(1);
  };

  const noResultados = !chequesLoading && emitidos.length === 0 && recibidos.length === 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200">Tesorería</p>
        <h1 className="mt-2 text-3xl font-semibold">Gestión de cheques</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Alta, edición y actualización de estado con datos reales de `tesoreria_cheques`.</p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {chequesError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{chequesError}</div> : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Buscar</span>
            <input className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={filtroQuery} onChange={(event) => setFilterQuery(event.target.value)} placeholder="Número o tercero" />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Estado</span>
            <select className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={filtroEstado} onChange={(event) => setFilterEstado(event.target.value as typeof filtroEstado)}>
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="DEPOSITADO">Depositado</option>
              <option value="COBRADO">Cobrado</option>
              <option value="RECHAZADO">Rechazado</option>
              <option value="VENCIDO">Vencido</option>
            </select>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha desde</span>
            <input type="date" className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={filtroFechaDesde} onChange={(event) => setFilterFechaDesde(event.target.value)} />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha hasta</span>
            <input type="date" className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={filtroFechaHasta} onChange={(event) => setFilterFechaHasta(event.target.value)} />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo</span>
            <select className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={filtroTipo} onChange={(event) => setFilterTipo(event.target.value as typeof filtroTipo)}>
              <option value="">Todos</option>
              <option value="EMITIDO">Emitido</option>
              <option value="RECIBIDO">Recibido</option>
            </select>
          </label>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Cheques emitidos</p><p className="mt-2 text-3xl font-semibold">{resumen.emitidos}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Cheques recibidos</p><p className="mt-2 text-3xl font-semibold">{resumen.recibidos}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Alertas</p><p className="mt-2 text-3xl font-semibold">{resumen.alertas}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Saldo proyectado</p><p className="mt-2 text-3xl font-semibold">{formatCurrency(resumen.proyeccion)}</p></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Cheques emitidos</h2>
          <div className="mt-4 space-y-3">
            {chequesLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
            {!chequesLoading && emitidos.map((cheque) => (
              <div key={cheque.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{cheque.numero}</p>
                    <p className="text-xs text-slate-500">{cheque.tercero} · vence {formatDate(cheque.fecha_vencimiento)}</p>
                    <p className="text-xs text-slate-500">Acreditación {formatDate(cheque.fecha_acreditacion)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="ui-input rounded-xl px-3 py-2 text-xs" value={cheque.estado} onChange={(event) => void changeEstado(cheque.id, event.target.value as EstadoChequeTesoreria)}>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="DEPOSITADO">Depositado</option>
                      <option value="COBRADO">Cobrado</option>
                      <option value="RECHAZADO">Rechazado</option>
                      <option value="VENCIDO">Vencido</option>
                    </select>
                    <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => startEdit(cheque)} type="button">Editar</button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">{formatCurrency(cheque.importe)}</p>
              </div>
            ))}
            {!chequesLoading && emitidos.length === 0 ? <p className="text-sm text-slate-500">{noResultados ? 'No hay cheques para los filtros aplicados.' : 'Sin cheques emitidos.'}</p> : null}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                disabled={emitidosPage === 1 || chequesLoading}
                onClick={() => {
                  setEmitidosPage((current) => Math.max(1, current - 1));
                }}
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">Página {emitidosPage}</span>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                disabled={emitidos.length < PAGE_SIZE || chequesLoading}
                onClick={() => {
                  setEmitidosPage((current) => current + 1);
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Cheques recibidos</h2>
          <div className="mt-4 space-y-3">
            {chequesLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
            {!chequesLoading && recibidos.map((cheque) => (
              <div key={cheque.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{cheque.numero}</p>
                    <p className="text-xs text-slate-500">{cheque.tercero} · vence {formatDate(cheque.fecha_vencimiento)}</p>
                    <p className="text-xs text-slate-500">Acreditación {formatDate(cheque.fecha_acreditacion)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="ui-input rounded-xl px-3 py-2 text-xs" value={cheque.estado} onChange={(event) => void changeEstado(cheque.id, event.target.value as EstadoChequeTesoreria)}>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="DEPOSITADO">Depositado</option>
                      <option value="COBRADO">Cobrado</option>
                      <option value="RECHAZADO">Rechazado</option>
                      <option value="VENCIDO">Vencido</option>
                    </select>
                    <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => startEdit(cheque)} type="button">Editar</button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">{formatCurrency(cheque.importe)}</p>
              </div>
            ))}
            {!chequesLoading && recibidos.length === 0 ? <p className="text-sm text-slate-500">{noResultados ? 'No hay cheques para los filtros aplicados.' : 'Sin cheques recibidos.'}</p> : null}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                disabled={recibidosPage === 1 || chequesLoading}
                onClick={() => {
                  setRecibidosPage((current) => Math.max(1, current - 1));
                }}
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">Página {recibidosPage}</span>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                disabled={recibidos.length < PAGE_SIZE || chequesLoading}
                onClick={() => {
                  setRecibidosPage((current) => current + 1);
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <ChequeForm value={form} onChange={setForm} onSubmit={() => void submitCheque()} onCancel={resetForm} submitting={submitting} error={formError} />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Plazos y vencimientos</h2>
          <div className="mt-4 space-y-3">
            {tesoreria.proyeccionFlujo.map((row) => (
              <div key={row.horizonte} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{row.horizonte}</p>
                  <p className="font-semibold text-blue-700">{formatCurrency(row.saldo_estimado)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">Vencimientos y cobertura proyectada</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Proyección de flujo de caja</h2>
          <div className="mt-4 space-y-3">
            {tesoreria.proyeccionFlujo.map((row) => (
              <div key={`flow-${row.horizonte}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.horizonte}</p>
                  <p className="text-xs text-slate-500">Ingresos {formatCurrency(row.ingresos_estimados)} · Egresos {formatCurrency(row.egresos_estimados)}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.saldo_estimado)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Alertas de descubierto</h2>
          <div className="mt-4 space-y-3">
            {tesoreria.alertasTesoreria.map((alerta) => (
              <div key={alerta.alerta_id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-amber-900">{alerta.titulo}</p>
                    <p className="text-xs text-amber-700">{alerta.tipo}</p>
                  </div>
                  <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{alerta.prioridad}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
};

export default TesoreriaPage;
