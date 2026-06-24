import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiSettings } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { useFinanzas } from '../../finanzas/hooks/useFinanzas';
import { useTesoreria } from '../hooks/useTesoreria';
import { ChequeForm } from '../components/ChequeForm';
import { EMPTY_CHEQUE_FORM } from '../components/chequeFormDefaults';
import type { ChequeTesoreriaFormValues } from '../services/tesoreriaService';
import type { ChequeTesoreriaRow, EstadoChequeTesoreria, MovimientoFinanciero } from '../../finanzas/types';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Sin dato';
const dayMs = 24 * 60 * 60 * 1000;

const todayIso = () => new Date().toISOString().slice(0, 10);
const isDeprecatedText = (value?: string | null) => {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return true;
  return ['prueba', 'test', 'demo', 'www', 'tttt'].some((keyword) => text.includes(keyword));
};
const isDueToday = (value: string) => value.slice(0, 10) === todayIso();

const formatMovementLabel = (movement: MovimientoFinanciero) => {
  const base = movement.descripcion || 'Movimiento financiero';
  if (movement.tipo === 'INGRESO') return `Ingreso por ${base}`;
  if (movement.tipo === 'EGRESO') return `Egreso por ${base}`;
  return `Transferencia: ${base}`;
};

const TesoreriaPage = () => {
  const { kpis, reportes, movimientos, tesoreria: tesoreriaFinanzas } = useFinanzas();
  const { tesoreria, error, getCheques, createCheque, updateCheque } = useTesoreria();
  const [todayKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<ChequeTesoreriaFormValues>(EMPTY_CHEQUE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [emitidosPage, setEmitidosPage] = useState(1);
  const [recibidosPage, setRecibidosPage] = useState(1);
  const [emitidos, setEmitidos] = useState<ChequeTesoreriaRow[]>([]);
  const [recibidos, setRecibidos] = useState<ChequeTesoreriaRow[]>([]);
  const [chequesError, setChequesError] = useState<string | null>(null);
  const [filtroQuery, setFiltroQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'PENDIENTE' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'VENCIDO' | ''>('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'EMITIDO' | 'RECIBIDO' | ''>('');
  const PAGE_SIZE = 20;

  const loadCheques = useCallback(async (emitidosPageValue = emitidosPage, recibidosPageValue = recibidosPage) => {
    try {
      const [emitidosRows, recibidosRows] = await Promise.all([
        getCheques({
          tipo: filtroTipo === 'RECIBIDO' ? undefined : 'EMITIDO',
          estado: filtroEstado || undefined,
          query: filtroQuery.trim() || undefined,
          fechaDesde: filtroFechaDesde || undefined,
          fechaHasta: filtroFechaHasta || undefined,
          limit: PAGE_SIZE,
          offset: (emitidosPageValue - 1) * PAGE_SIZE,
        }),
        getCheques({
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
    }
  }, [emitidosPage, recibidosPage, filtroQuery, filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroTipo, getCheques]);

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
      setIsFormOpen(false);
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
    setIsFormOpen(true);
  };

  const normalizedChequesEmitidos = useMemo(() => emitidos.filter((cheque) => !isDeprecatedText(cheque.numero) && !isDeprecatedText(cheque.tercero)), [emitidos]);
  const normalizedChequesRecibidos = useMemo(() => recibidos.filter((cheque) => !isDeprecatedText(cheque.numero) && !isDeprecatedText(cheque.tercero)), [recibidos]);
  const allCheques = useMemo(
    () => [...tesoreria.chequesEmitidos, ...tesoreria.chequesRecibidos].filter((cheque) => !isDeprecatedText(cheque.numero) && !isDeprecatedText(cheque.tercero)),
    [tesoreria.chequesEmitidos, tesoreria.chequesRecibidos],
  );
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
  const chequeCards = useMemo(() => {
    const buckets = [
      { key: 'emitidos', title: 'Cheques emitidos', items: allCheques.filter((cheque) => cheque.tipo === 'EMITIDO') },
      { key: 'recibidos', title: 'Cheques recibidos', items: allCheques.filter((cheque) => cheque.tipo === 'RECIBIDO') },
      { key: 'pendientes', title: 'Cheques pendientes', items: allCheques.filter((cheque) => cheque.estado === 'PENDIENTE') },
      { key: 'depositados', title: 'Cheques depositados', items: allCheques.filter((cheque) => cheque.estado === 'DEPOSITADO') },
      { key: 'cobrados', title: 'Cheques cobrados', items: allCheques.filter((cheque) => cheque.estado === 'COBRADO') },
      { key: 'rechazados', title: 'Cheques rechazados', items: allCheques.filter((cheque) => cheque.estado === 'RECHAZADO') },
      { key: 'vencidos', title: 'Cheques vencidos', items: allCheques.filter((cheque) => cheque.estado === 'VENCIDO') },
    ];
    return buckets.map((bucket) => ({
      ...bucket,
      total: bucket.items.reduce((acc, cheque) => acc + cheque.importe, 0),
      sample: bucket.items.slice(0, 3),
    }));
  }, [allCheques]);
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
      const recibidosPendientes = tesoreria.chequesRecibidos.filter((cheque) => ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && inRange(cheque.fecha_vencimiento));
      const emitidosPendientes = tesoreria.chequesEmitidos.filter((cheque) => ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && inRange(cheque.fecha_vencimiento));
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
  }, [tesoreria.chequesEmitidos, tesoreria.chequesRecibidos, tesoreria.proyeccionFlujo]);
  const cajasYcobranza = useMemo(() => {
    const ventasPeriodo = reportes.ingresos_pt_por_producto.reduce((acc, row) => acc + Number(row.importe_total ?? 0), 0);
    const cobrosPeriodo = movimientos
      .filter((movimiento) => movimiento.tipo === 'INGRESO' && /venta|cobranza|cobro/i.test(`${movimiento.descripcion} ${movimiento.origen_operativo ?? ''}`))
      .reduce((acc, movimiento) => acc + Number(movimiento.monto ?? 0), 0);
    const chequesRecibidosHoy = tesoreria.chequesRecibidos.filter((cheque) => cheque.estado === 'A_DEPOSITAR' || (cheque.estado === 'PENDIENTE' && isDueToday(cheque.fecha_vencimiento)));
    const chequesEmitidosHoy = tesoreria.chequesEmitidos.filter((cheque) => cheque.estado === 'PENDIENTE' && isDueToday(cheque.fecha_vencimiento));
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
  }, [kpis.cuentas_por_cobrar, kpis.saldo_actual, movimientos, reportes.ingresos_pt_por_producto, tesoreria.carteraClientes, tesoreria.chequesEmitidos, tesoreria.chequesRecibidos]);

  const movimientosCajaRecientes = useMemo(() => {
    const chequesCobradoRecibidos = tesoreria.chequesRecibidos
      .filter((cheque) => cheque.estado === 'COBRADO')
      .map((cheque) => ({
        id: `cobrado-${cheque.id}`,
        fecha: cheque.fecha_acreditacion ?? cheque.fecha_vencimiento,
        titulo: `Cheque cobrado ${cheque.numero}`,
        detalle: `${cheque.tercero} · ${formatCurrency(cheque.importe)}`,
        tipo: 'Cheque cobrado',
      }));
    const chequesDepositados = tesoreria.chequesRecibidos
      .filter((cheque) => cheque.estado === 'DEPOSITADO' || cheque.estado === 'A_DEPOSITAR')
      .map((cheque) => ({
        id: `depositado-${cheque.id}`,
        fecha: cheque.fecha_acreditacion ?? cheque.fecha_vencimiento,
        titulo: `Cheque depositado ${cheque.numero}`,
        detalle: `${cheque.tercero} · ${formatCurrency(cheque.importe)}`,
        tipo: 'Cheque depositado',
      }));
    const chequeEmitidoCubierto = tesoreria.chequesEmitidos
      .filter((cheque) => cheque.estado === 'DEPOSITADO')
      .map((cheque) => ({
        id: `pagado-${cheque.id}`,
        fecha: cheque.fecha_acreditacion ?? cheque.fecha_vencimiento,
        titulo: `Cheque emitido cubierto ${cheque.numero}`,
        detalle: `${cheque.tercero} · ${formatCurrency(cheque.importe)}`,
        tipo: 'Cheque emitido',
      }));
    const movimientosIngresos = movimientos
      .filter((movimiento) => movimiento.tipo === 'INGRESO')
      .slice(0, 8)
      .map((movement) => ({
        id: `mov-${movement.uid}`,
        fecha: movement.fecha,
        titulo: formatMovementLabel(movement),
        detalle: `${movement.categoria || 'Sin categoría'} · ${formatCurrency(movement.monto)}`,
        tipo: 'Movimiento',
      }));
    return [...movimientosIngresos, ...chequesDepositados, ...chequesCobradoRecibidos, ...chequeEmitidoCubierto]
      .filter((item) => !isDeprecatedText(item.titulo) && !isDeprecatedText(item.detalle))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 8);
  }, [movimientos, tesoreria.chequesEmitidos, tesoreria.chequesRecibidos]);
  const alertaPrioritaria = useMemo(() => {
    const emitidoVenceHoy = normalizedChequesEmitidos.find((cheque) => ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && isDueToday(cheque.fecha_vencimiento));
    if (emitidoVenceHoy) {
      return `Hoy hay un cheque que cubrir: ${emitidoVenceHoy.numero}`;
    }
    const recibidoListoDepositar = normalizedChequesRecibidos.find((cheque) => ['PENDIENTE', 'A_DEPOSITAR'].includes(cheque.estado) && isDueToday(cheque.fecha_vencimiento));
    if (recibidoListoDepositar) {
      return `Cheque recibido ${recibidoListoDepositar.numero} listo para depositar`;
    }
    const recibidoADepositar = normalizedChequesRecibidos.find((cheque) => cheque.estado === 'A_DEPOSITAR');
    if (recibidoADepositar) {
      return `Cheque recibido ${recibidoADepositar.numero} listo para depositar`;
    }
    return null;
  }, [normalizedChequesEmitidos, normalizedChequesRecibidos]);
  const campanaFinanciera = useMemo(() => {
    const vencidos = tesoreria.chequesEmitidos.filter((cheque) => cheque.estado === 'VENCIDO' || (cheque.estado === 'PENDIENTE' && cheque.fecha_vencimiento.slice(0, 10) < todayKey));
    const depositados = tesoreria.chequesRecibidos.filter((cheque) => cheque.estado === 'DEPOSITADO' || cheque.estado === 'COBRADO');
    return {
      count: vencidos.length + depositados.length,
      label: vencidos.length > 0 ? `Hay ${vencidos.length} cheques vencidos.` : 'Sin vencimientos financieros críticos.',
    };
  }, [todayKey, tesoreria.chequesEmitidos, tesoreria.chequesRecibidos]);
  const campanaOperativa = useMemo(() => {
    const porAcreditar = tesoreria.chequesRecibidos.filter((cheque) => cheque.estado === 'PENDIENTE' || cheque.estado === 'RECHAZADO');
    const porCubrir = tesoreria.chequesEmitidos.filter((cheque) => cheque.estado === 'PENDIENTE');
    return {
      count: porAcreditar.length + porCubrir.length,
      label: porCubrir.length > 0 ? `Hay ${porCubrir.length} cheques por cubrir.` : 'Sin pendientes operativos urgentes.',
    };
  }, [tesoreria.chequesEmitidos, tesoreria.chequesRecibidos]);
  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
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

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Caja y cobranza</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Caja disponible</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.cajaDisponible)}</p></Card>
            <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ventas del período</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.ventasPeriodo)}</p></Card>
            <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cobros del período</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.cobrosPeriodo)}</p></Card>
            <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cuentas por cobrar</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(cajasYcobranza.ctasCobrar)}</p></Card>
            <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cheques recibidos hoy</p><p className="mt-2 text-2xl font-semibold">{cajasYcobranza.chequesRecibidosHoy.length}</p></Card>
            <Card><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cheques emitidos hoy</p><p className="mt-2 text-2xl font-semibold">{cajasYcobranza.chequesEmitidosHoy.length}</p></Card>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Cheques emitidos</p><p className="mt-2 text-3xl font-semibold">{resumen.emitidos}</p></Card>
          <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Cheques recibidos</p><p className="mt-2 text-3xl font-semibold">{resumen.recibidos}</p></Card>
          <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Alertas activas</p><p className="mt-2 text-3xl font-semibold">{resumen.alertas}</p></Card>
          <Card><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Saldo proyectado</p><p className="mt-2 text-3xl font-semibold">{formatCurrency(resumen.proyeccion)}</p></Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-sky-200 bg-sky-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700">Campana financiera</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Alertas de flujo y vencimientos</h2>
            </div>
            <div className="rounded-2xl bg-white p-3 text-sky-700 shadow-sm">
              <FiBell size={18} />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-700">{campanaFinanciera.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{campanaFinanciera.count}</p>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Campana operativa</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Seguimiento de cheques y acción</h2>
            </div>
            <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
              <FiSettings size={18} />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-700">{campanaOperativa.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{campanaOperativa.count}</p>
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Movimientos de caja recientes</h2>
        </div>
        {movimientosCajaRecientes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No hay movimientos recientes para mostrar.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {movimientosCajaRecientes.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">{item.tipo}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.titulo}</p>
                <p className="mt-1 truncate text-xs text-slate-600">{item.detalle}</p>
                <p className="mt-2 text-[11px] text-slate-500">{formatDate(item.fecha)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Cheques</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Organización por zona y estado</h2>
          </div>
          <button type="button" onClick={openCreateForm} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">+ Registrar cheque</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {chequeCards.map((bucket) => (
            <Card key={bucket.key} className="border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{bucket.title}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{bucket.items.length}</p>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{formatCurrency(bucket.total)}</span>
              </div>
              <div className="mt-4 space-y-2">
                {bucket.sample.length > 0 ? bucket.sample.map((cheque) => (
                  <div key={cheque.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{cheque.numero}</p>
                        <p className="truncate text-xs text-slate-500">{cheque.tercero} · {formatDate(cheque.fecha_vencimiento)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getChequeStateTone(cheque.estado)}`}>{getChequeStateLabel(cheque.estado)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">{formatCurrency(cheque.importe)}</p>
                      <button type="button" onClick={() => startEdit(cheque)} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Editar</button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                    Sin registros en esta categoría.
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {horizonBuckets.map((bucket) => (
            <Card key={bucket.label} className={bucket.label === 'Hoy' ? 'border-blue-200 bg-blue-50' : 'border-slate-200'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{bucket.label}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Proyección de flujo</h3>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">{formatCurrency(bucket.saldo)}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Recibidos pendientes</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-700">{bucket.recibidosPendientes.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Emitidos pendientes</p>
                  <p className="mt-1 text-lg font-semibold text-rose-700">{bucket.emitidosPendientes.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Entradas estimadas</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(bucket.entradas)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Salidas estimadas</p>
                  <p className="mt-1 text-lg font-semibold text-rose-700">{formatCurrency(bucket.salidas)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Saldo neto proyectado</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(bucket.saldo)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

        <Card>
          <h2 className="text-lg font-semibold">Alertas de tesorería</h2>
          <div className="mt-4 space-y-3">
            {tesoreriaFinanzas.alertasTesoreria.filter((alerta) => !isDeprecatedText(alerta.titulo) && !isDeprecatedText(alerta.tipo)).map((alerta) => (
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
                showAcreditacion={Boolean(editingId)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TesoreriaPage;
