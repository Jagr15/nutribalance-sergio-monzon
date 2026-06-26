import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { Card } from '../../../shared/components/card';
import { useFinanzas } from '../../finanzas/hooks/useFinanzas';
import { useTesoreria } from '../hooks/useTesoreria';
import { ChequeForm } from '../components/ChequeForm';
import { EMPTY_CHEQUE_FORM } from '../components/chequeFormDefaults';
import type { ChequeTesoreriaFormValues } from '../services/tesoreriaService';
import type { ChequeTesoreriaRow, EstadoChequeTesoreria } from '../../finanzas/types';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const formatDate = (value?: string | null) => value ? formatDateDDMMYYYY(value) : 'Sin dato';
const dayMs = 24 * 60 * 60 * 1000;

const todayIso = () => new Date().toISOString().slice(0, 10);
const isDeprecatedText = (value?: string | null) => {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return true;
  return ['prueba', 'test', 'demo', 'www', 'tttt'].some((keyword) => text.includes(keyword));
};
const isDueToday = (value: string) => value.slice(0, 10) === todayIso();

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const TesoreriaPage = () => {
  const { kpis, reportes, movimientos, tesoreria: tesoreriaFinanzas } = useFinanzas();
  const { tesoreria, error, getCheques, createCheque, updateCheque, updateChequeEstado } = useTesoreria();
  const [form, setForm] = useState<ChequeTesoreriaFormValues>(EMPTY_CHEQUE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [cheques, setCheques] = useState<ChequeTesoreriaRow[]>([]);
  const [chequesError, setChequesError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'PENDIENTE' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'VENCIDO' | ''>('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'EMITIDO' | 'RECIBIDO' | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<'RECIBIDOS' | 'EMITIDOS'>('RECIBIDOS');
  const listSectionRef = useRef<HTMLElement | null>(null);
  const allChequesRef = useRef<HTMLElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [highlightedChequeId, setHighlightedChequeId] = useState<string | null>(null);

  const loadAllCheques = useCallback(async () => {
    try {
      const realCheques = await getCheques({ limit: 50 });
      setCheques(realCheques);
      console.log('[tesoreria] source cheques count', realCheques.length);
      console.log('[tesoreria] newest cheque', realCheques[0] ?? null);
      console.log('[tesoreria] all cheque ids rendered', realCheques.map((cheque) => cheque.id));
      return realCheques;
    } catch (err: unknown) {
      console.error('[tesoreria] failed loading real cheques', err);
      setChequesError(err instanceof Error ? err.message : 'No se pudieron cargar los cheques.');
      return [];
    }
  }, [getCheques]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAllCheques();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAllCheques]);

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

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  const showToast = async (icon: 'success' | 'error', title: string) => {
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      timer: 2400,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#0f172a',
    });
  };

  const submitCheque = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const savedCheque = editingId ? await updateCheque(editingId, form) : await createCheque(form);
      const refreshedCheques = await loadAllCheques();
      const foundAfterRefresh = refreshedCheques.some((cheque) => cheque.id === savedCheque.id);
      console.log('[tesoreria] created id', savedCheque.id);
      console.log('[tesoreria] fetched cheque ids', refreshedCheques.map((cheque) => cheque.id));
      console.log('[tesoreria] created found after refresh', foundAfterRefresh);
      if (!foundAfterRefresh) {
        const optimistic = [savedCheque, ...refreshedCheques.filter((cheque) => cheque.id !== savedCheque.id)];
        setCheques(optimistic);
        console.warn('[tesoreria] applied optimistic fallback for created cheque', savedCheque.id);
      } else {
        setCheques(refreshedCheques);
      }
      console.log('[tesoreria] submit success', savedCheque.id);
      setHighlightedChequeId(savedCheque.id);
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedChequeId(null);
      }, 3000);
      await showToast('success', 'Cheque registrado correctamente.');
      resetForm();
      setIsFormOpen(false);
      window.requestAnimationFrame(() => {
        allChequesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el cheque.';
      console.error('[tesoreria] error guardando cheque', err);
      setFormError(message);
      await showToast('error', message);
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
    setIsFormOpen(true);
  };

  const nextDirectState = (cheque: ChequeTesoreriaRow): EstadoChequeTesoreria | null => {
    if (cheque.tipo === 'RECIBIDO') {
      if (cheque.estado === 'DEPOSITADO' || cheque.estado === 'COBRADO') return null;
      return 'DEPOSITADO';
    }
    if (cheque.estado === 'COBRADO') return null;
    return 'DEPOSITADO';
  };

  const handleDirectStateChange = async (cheque: ChequeTesoreriaRow) => {
    const next = nextDirectState(cheque);
    if (!next) {
      await showToast('error', 'El cheque ya está procesado.');
      return;
    }
    try {
      await updateChequeEstado(cheque.id, next);
      const refreshed = await loadAllCheques();
      setCheques(refreshed);
      setHighlightedChequeId(cheque.id);
      await showToast('success', cheque.tipo === 'RECIBIDO' ? 'Cheque marcado como depositado.' : 'Cheque marcado como cubierto.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el estado.';
      await showToast('error', message);
    }
  };

  const allCheques = useMemo(
    () => [...cheques]
      .filter((cheque) => !isDeprecatedText(cheque.numero) && !isDeprecatedText(cheque.tercero))
      .sort((a, b) => new Date(b.created_at ?? b.fecha_emision).getTime() - new Date(a.created_at ?? a.fecha_emision).getTime()),
    [cheques],
  );
  const filteredCheques = useMemo(() => {
    const query = normalizeSearchText(searchInput);
    const dateFrom = filtroFechaDesde ? new Date(`${filtroFechaDesde}T00:00:00`) : null;
    const dateTo = filtroFechaHasta ? new Date(`${filtroFechaHasta}T23:59:59.999`) : null;

    return allCheques.filter((cheque) => {
      const hayQuery = !query || [
        cheque.numero,
        cheque.tercero,
        cheque.cliente_nombre ?? '',
        cheque.tipo,
        cheque.estado,
      ].some((field) => normalizeSearchText(field).includes(query));
      if (!hayQuery) return false;

      if (filtroEstado && cheque.estado !== filtroEstado) return false;
      if (filtroTipo && cheque.tipo !== filtroTipo) return false;

      const fechaEmision = new Date(cheque.fecha_emision);
      if (dateFrom && fechaEmision.getTime() < dateFrom.getTime()) return false;
      if (dateTo && fechaEmision.getTime() > dateTo.getTime()) return false;

      return true;
    });
  }, [allCheques, searchInput, filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroTipo]);

  const filteredChequesEmitidos = useMemo(() => filteredCheques.filter((cheque) => cheque.tipo === 'EMITIDO'), [filteredCheques]);
  const filteredChequesRecibidos = useMemo(() => filteredCheques.filter((cheque) => cheque.tipo === 'RECIBIDO'), [filteredCheques]);
  const getChequeStateLabel = (estado: EstadoChequeTesoreria) => ({
    PENDIENTE: 'Pendiente',
    A_DEPOSITAR: 'A depositar',
    DEPOSITADO: 'Depositado',
    COBRADO: 'Cobrado',
    RECHAZADO: 'Rechazado',
    ENDOSADO: 'Endosado',
    VENCIDO: 'Vencido',
  }[estado]);
  const getChequeStateTone = (estado: EstadoChequeTesoreria) => ({
    PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-200',
    A_DEPOSITAR: 'bg-amber-100 text-amber-800 border-amber-200',
    DEPOSITADO: 'bg-sky-100 text-sky-800 border-sky-200',
    COBRADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    RECHAZADO: 'bg-rose-100 text-rose-800 border-rose-200',
    ENDOSADO: 'bg-violet-100 text-violet-800 border-violet-200',
    VENCIDO: 'bg-slate-100 text-slate-800 border-slate-200',
  }[estado]);
  const horizonBuckets = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const buildBucket = (days: number, label: string) => {
      const limit = new Date(now.getTime() + days * dayMs);
      const inRange = (value: string) => {
        const fecha = new Date(value);
        fecha.setHours(0, 0, 0, 0);
        return fecha.getTime() >= now.getTime() && fecha.getTime() <= limit.getTime();
      };
      const recibidosPendientes = filteredCheques.filter((cheque) => cheque.tipo === 'RECIBIDO' && ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && inRange(cheque.fecha_vencimiento));
      const emitidosPendientes = filteredCheques.filter((cheque) => cheque.tipo === 'EMITIDO' && ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && inRange(cheque.fecha_vencimiento));
      const row = tesoreria.proyeccionFlujo.find((item) => item.horizonte === label);
      return {
        label,
        recibidosPendientes,
        emitidosPendientes,
        entradas: row?.ingresos_estimados ?? 0,
        salidas: row?.egresos_estimados ?? 0,
        saldo: row?.saldo_estimado ?? 0,
      };
    };
    return [buildBucket(0, 'Hoy'), buildBucket(7, '7 días'), buildBucket(15, '15 días'), buildBucket(30, '30 días')];
  }, [filteredCheques, tesoreria.proyeccionFlujo]);
  const cajasYcobranza = useMemo(() => {
    const ventasPeriodo = reportes.ingresos_pt_por_producto.reduce((acc, row) => acc + Number(row.importe_total ?? 0), 0);
    const cobrosPeriodo = movimientos
      .filter((movimiento) => movimiento.tipo === 'INGRESO' && /venta|cobranza|cobro/i.test(`${movimiento.descripcion} ${movimiento.origen_operativo ?? ''}`))
      .reduce((acc, movimiento) => acc + Number(movimiento.monto ?? 0), 0);
    const chequesRecibidosHoy = filteredCheques.filter((cheque) => cheque.tipo === 'RECIBIDO' && (cheque.estado === 'A_DEPOSITAR' || (cheque.estado === 'PENDIENTE' && isDueToday(cheque.fecha_vencimiento))));
    const chequesEmitidosHoy = filteredCheques.filter((cheque) => cheque.tipo === 'EMITIDO' && cheque.estado === 'PENDIENTE' && isDueToday(cheque.fecha_vencimiento));
    const ctasCobrar = kpis.cuentas_por_cobrar || tesoreria.carteraClientes.reduce((acc, row) => acc + row.saldo_pendiente, 0);
    const cajaDisponible = kpis.saldo_actual;

    return {
      cajaDisponible,
      ventasPeriodo,
      cobrosPeriodo,
      ctasCobrar,
      chequesRecibidosHoy,
      chequesEmitidosHoy,
    };
  }, [filteredCheques, kpis.cuentas_por_cobrar, kpis.saldo_actual, movimientos, reportes.ingresos_pt_por_producto, tesoreria.carteraClientes]);

  const alertaPrioritaria = useMemo(() => {
    const emitidoVenceHoy = filteredChequesEmitidos.find((cheque) => ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && isDueToday(cheque.fecha_vencimiento));
    if (emitidoVenceHoy) {
      return `Cheque emitido ${emitidoVenceHoy.numero} por cubrir hoy por ${formatCurrency(emitidoVenceHoy.importe)}.`;
    }
    const recibidoListoDepositar = filteredChequesRecibidos.find((cheque) => ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && isDueToday(cheque.fecha_vencimiento));
    if (recibidoListoDepositar) {
      return `Cheque recibido ${recibidoListoDepositar.numero} listo para depositar por ${formatCurrency(recibidoListoDepositar.importe)}.`;
    }
    const recibidoADepositar = filteredChequesRecibidos.find((cheque) => cheque.estado === 'A_DEPOSITAR');
    if (recibidoADepositar) {
      return `Cheque recibido ${recibidoADepositar.numero} listo para depositar por ${formatCurrency(recibidoADepositar.importe)}.`;
    }
    return null;
  }, [filteredChequesEmitidos, filteredChequesRecibidos]);
  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const setFilterQuery = (value: string) => {
    setSearchInput(value);
  };

  const setFilterEstado = (value: typeof filtroEstado) => {
    setFiltroEstado(value);
  };

  const setFilterFechaDesde = (value: string) => {
    setFiltroFechaDesde(value);
  };

  const setFilterFechaHasta = (value: string) => {
    setFiltroFechaHasta(value);
  };

  const setFilterTipo = (value: typeof filtroTipo) => {
    setFiltroTipo(value);
  };

  const clearFilters = () => {
    setSearchInput('');
    setFiltroEstado('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroTipo('');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200">Tesorería</p>
        <h1 className="mt-2 text-3xl font-semibold">Gestión de cheques</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Alta, edición y actualización de estado con datos reales de `tesoreria_cheques`.</p>
      </section>

      {alertaPrioritaria ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm">
          {alertaPrioritaria}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {chequesError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{chequesError}</div> : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Buscar</span>
            <input className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={searchInput} onChange={(event) => setFilterQuery(event.target.value)} placeholder="Número, tercero, cliente, proveedor, tipo o estado" />
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
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Limpiar filtros
          </button>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Caja disponible</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.cajaDisponible)}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ventas del período</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.ventasPeriodo)}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cobros del período</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.cobrosPeriodo)}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cuentas por cobrar</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.ctasCobrar)}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recibidos hoy</p><p className="mt-2 text-2xl font-semibold">{cajasYcobranza.chequesRecibidosHoy.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Emitidos hoy</p><p className="mt-2 text-2xl font-semibold">{cajasYcobranza.chequesEmitidosHoy.length}</p></Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-sky-200 bg-sky-50">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700">Alerta prioritaria</p>
          <p className="mt-2 text-sm text-slate-700">{alertaPrioritaria ?? 'Sin alertas prioritarias en el momento.'}</p>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Resumen</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-slate-500">Cheques recibidos</p><p className="font-semibold">{resumen.recibidos}</p></div>
            <div><p className="text-slate-500">Cheques emitidos</p><p className="font-semibold">{resumen.emitidos}</p></div>
            <div><p className="text-slate-500">Alertas activas</p><p className="font-semibold">{resumen.alertas}</p></div>
            <div><p className="text-slate-500">Saldo proyectado</p><p className="font-semibold">{formatCurrency(resumen.proyeccion)}</p></div>
          </div>
        </Card>
      </section>

      <section ref={listSectionRef} className="space-y-4 scroll-mt-32">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Cheques</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">Tabla compacta de tesorería</h2>
          </div>
          <button type="button" onClick={openCreateForm} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">+ Registrar cheque</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('RECIBIDOS')} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'RECIBIDOS' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Cheques recibidos</button>
          <button type="button" onClick={() => setActiveTab('EMITIDOS')} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'EMITIDOS' ? 'bg-rose-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Cheques emitidos</button>
        </div>
        {filteredCheques.length === 0 ? (
          <Card className="border-dashed border-slate-200">
            <p className="text-sm text-slate-500">No hay cheques que coincidan con los filtros.</p>
          </Card>
        ) : null}
        <Card className="min-w-0 overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left">Número</th>
                  <th className="px-3 py-3 text-left">Tipo</th>
                  <th className="px-3 py-3 text-left">Tercero</th>
                  <th className="px-3 py-3 text-left">{activeTab === 'RECIBIDOS' ? 'Fecha de depósito/cobro' : 'Fecha de pago'}</th>
                  <th className="px-3 py-3 text-left">Acreditación</th>
                  <th className="px-3 py-3 text-left">Estado</th>
                  <th className="px-3 py-3 text-right">Importe</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(activeTab === 'RECIBIDOS' ? filteredChequesRecibidos : filteredChequesEmitidos).map((cheque) => {
                  const isHighlighted = highlightedChequeId === cheque.id;
                  const band = cheque.tipo === 'RECIBIDO'
                    ? cheque.estado === 'COBRADO' || cheque.estado === 'DEPOSITADO'
                      ? 'bg-emerald-50'
                      : cheque.estado === 'PENDIENTE'
                        ? 'bg-amber-50'
                        : 'bg-slate-50'
                    : cheque.estado === 'DEPOSITADO' || cheque.estado === 'COBRADO'
                      ? 'bg-slate-100'
                      : cheque.estado === 'PENDIENTE'
                        ? 'bg-rose-50'
                        : 'bg-amber-50';
                  const directState = nextDirectState(cheque);
                  return (
                    <tr key={cheque.id} className={`${band} ${isHighlighted ? 'ring-2 ring-blue-400 ring-inset' : ''}`}>
                      <td className="px-3 py-2 font-semibold text-slate-900">{cheque.numero}</td>
                      <td className="px-3 py-2 text-slate-700">{cheque.tipo === 'RECIBIDO' ? 'Recibido' : 'Emitido'}</td>
                      <td className="px-3 py-2 text-slate-700">{cheque.tercero || cheque.cliente_nombre || 'Sin tercero'}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDate(cheque.fecha_vencimiento)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDate(cheque.fecha_acreditacion)}</td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getChequeStateTone(cheque.estado)}`}>{getChequeStateLabel(cheque.estado)}</span></td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(cheque.importe)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          {directState ? (
                            <button type="button" onClick={() => void handleDirectStateChange(cheque)} className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                              {cheque.tipo === 'RECIBIDO' ? 'Depositado' : 'Cubierto'}
                            </button>
                          ) : (
                            <span className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">Procesado</span>
                          )}
                          <button type="button" onClick={() => startEdit(cheque)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Editar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {horizonBuckets.map((bucket) => (
            <Card key={bucket.label} className={bucket.label === 'Hoy' ? 'border-blue-200 bg-blue-50' : 'border-slate-200'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{bucket.label}</p>
                  <h3 className="mt-1 truncate text-base font-semibold text-slate-900 sm:text-lg">Proyección de flujo</h3>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">{formatCurrency(bucket.saldo)}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Recibidos pendientes</p>
                  <p className="mt-1 truncate text-lg font-semibold text-emerald-700">{bucket.recibidosPendientes.length}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Emitidos pendientes</p>
                  <p className="mt-1 truncate text-lg font-semibold text-rose-700">{bucket.emitidosPendientes.length}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Entradas estimadas</p>
                  <p className="mt-1 truncate whitespace-nowrap text-base font-semibold text-emerald-700 sm:text-lg">{formatCurrency(bucket.entradas)}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Salidas estimadas</p>
                  <p className="mt-1 truncate whitespace-nowrap text-base font-semibold text-rose-700 sm:text-lg">{formatCurrency(bucket.salidas)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Saldo neto proyectado</p>
                <p className="mt-1 truncate whitespace-nowrap text-lg font-semibold text-slate-900 sm:text-xl">{formatCurrency(bucket.saldo)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Alertas de tesorería</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{tesoreriaFinanzas.alertasTesoreria.length}</span>
          </div>
          <div className="mt-4 grid gap-3">
            {tesoreriaFinanzas.alertasTesoreria.filter((alerta) => !isDeprecatedText(alerta.titulo) && !isDeprecatedText(alerta.tipo)).slice(0, 6).map((alerta) => (
              <div key={alerta.alerta_id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-amber-900">{alerta.titulo}</p>
                    <p className="text-xs text-amber-700">{alerta.tipo}</p>
                    <p className="mt-1 text-xs text-amber-700">
                      {String(alerta.dato_asociado?.cheque ?? 'Cheque')}
                      {' · '}
                      {formatCurrency(Number(alerta.dato_asociado?.importe ?? 0))}
                      {' · '}
                      {formatDate(String(alerta.dato_asociado?.vence ?? alerta.fecha_evento))}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{alerta.prioridad}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              resetForm();
              setIsFormOpen(false);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl shadow-slate-950/25">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cheque</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{editingId ? 'Editar cheque' : 'Registrar cheque'}</h3>
              </div>
              <button type="button" onClick={() => { resetForm(); setIsFormOpen(false); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                Cerrar
              </button>
            </div>
            <div className="p-6">
              <ChequeForm
                value={form}
                onChange={setForm}
                onSubmit={() => void submitCheque()}
                onCancel={() => { resetForm(); setIsFormOpen(false); }}
                submitting={submitting}
                error={formError}
                title={editingId ? 'Editar cheque' : 'Registrar cheque'}
                submitLabel={editingId ? 'Guardar cambios' : 'Registrar cheque'}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TesoreriaPage;
