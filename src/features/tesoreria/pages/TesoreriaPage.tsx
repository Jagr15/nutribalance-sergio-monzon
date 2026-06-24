import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiSettings } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { useFinanzas } from '../../finanzas/hooks/useFinanzas';
import { useTesoreria } from '../hooks/useTesoreria';
import { ChequeForm } from '../components/ChequeForm';
import { EMPTY_CHEQUE_FORM } from '../components/chequeFormDefaults';
import type { ChequeTesoreriaFormValues } from '../services/tesoreriaService';
import type { ChequeTesoreriaRow, EstadoChequeTesoreria, MovimientoFinanciero, ProyeccionFlujoRow } from '../../finanzas/types';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Sin dato';
const dayMs = 24 * 60 * 60 * 1000;

const getRangeDays = (horizonte: ProyeccionFlujoRow['horizonte']) => {
  if (horizonte === 'Hoy') return 0;
  if (horizonte === '7 días') return 7;
  if (horizonte === '15 días') return 15;
  return 30;
};

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
  const { tesoreria, error, getCheques, createCheque, updateCheque, updateChequeEstado } = useTesoreria();
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
  const [chequesLoading, setChequesLoading] = useState(true);
  const [chequesError, setChequesError] = useState<string | null>(null);
  const [filtroQuery, setFiltroQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'PENDIENTE' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'VENCIDO' | ''>('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'EMITIDO' | 'RECIBIDO' | ''>('');
  const [detalleHorizonte, setDetalleHorizonte] = useState<ProyeccionFlujoRow['horizonte']>('Hoy');
  const PAGE_SIZE = 20;

  const loadCheques = useCallback(async (emitidosPageValue = emitidosPage, recibidosPageValue = recibidosPage) => {
      setChequesLoading(true);
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
    } finally {
      setChequesLoading(false);
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

  const proyeccionSeleccionada = tesoreria.proyeccionFlujo.find((row) => row.horizonte === detalleHorizonte) ?? tesoreria.proyeccionFlujo[0] ?? null;
  const { emitidosPendientesDetalle, recibidosPendientesDetalle } = useMemo(() => {
    const days = getRangeDays(detalleHorizonte);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const limit = new Date(todayStart.getTime() + days * dayMs);
    const inRange = (value: string) => {
      const fecha = new Date(value);
      fecha.setHours(0, 0, 0, 0);
      return fecha.getTime() >= todayStart.getTime() && fecha.getTime() <= limit.getTime();
    };
    return {
      emitidosPendientesDetalle: tesoreria.chequesEmitidos.filter((cheque) => cheque.estado === 'PENDIENTE' && inRange(cheque.fecha_vencimiento)),
      recibidosPendientesDetalle: tesoreria.chequesRecibidos.filter((cheque) => cheque.estado === 'PENDIENTE' && inRange(cheque.fecha_vencimiento)),
    };
  }, [detalleHorizonte, tesoreria.chequesEmitidos, tesoreria.chequesRecibidos]);
  const detalleSinCheques = emitidosPendientesDetalle.length === 0 && recibidosPendientesDetalle.length === 0;

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

      <section className="grid gap-4 xl:grid-cols-2">
        {normalizedChequesEmitidos.length > 0 || chequesLoading ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Cheques emitidos</h2>
              <button type="button" onClick={openCreateForm} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">+ Registrar cheque</button>
            </div>
            <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {chequesLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
              {!chequesLoading && normalizedChequesEmitidos.map((cheque) => (
                <div key={cheque.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{cheque.numero}</p>
                      <p className="truncate text-xs text-slate-500">{cheque.tercero} · vence {formatDate(cheque.fecha_vencimiento)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select className="ui-input rounded-xl px-2 py-1.5 text-[11px]" value={cheque.estado} onChange={(event) => void changeEstado(cheque.id, event.target.value as EstadoChequeTesoreria)}>
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="DEPOSITADO">Depositado</option>
                        <option value="COBRADO">Cobrado</option>
                        <option value="RECHAZADO">Rechazado</option>
                        <option value="VENCIDO">Vencido</option>
                      </select>
                      <button className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100" onClick={() => startEdit(cheque)} type="button">Editar</button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(cheque.importe)}</p>
                    <div className="text-right">
                      {cheque.estado === 'PENDIENTE' && isDueToday(cheque.fecha_vencimiento) ? <p className="text-[11px] font-semibold text-red-700">Depositar hoy</p> : null}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
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
        ) : null}

        {normalizedChequesRecibidos.length > 0 || chequesLoading ? (
          <Card>
            <h2 className="text-lg font-semibold">Cheques recibidos</h2>
            <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
              {chequesLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
              {!chequesLoading && normalizedChequesRecibidos.map((cheque) => (
                <div key={cheque.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{cheque.numero}</p>
                      <p className="truncate text-xs text-slate-500">{cheque.tercero} · vence {formatDate(cheque.fecha_vencimiento)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select className="ui-input rounded-xl px-2 py-1.5 text-[11px]" value={cheque.estado} onChange={(event) => void changeEstado(cheque.id, event.target.value as EstadoChequeTesoreria)}>
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="DEPOSITADO">Depositado</option>
                        <option value="COBRADO">Cobrado</option>
                        <option value="RECHAZADO">Rechazado</option>
                        <option value="VENCIDO">Vencido</option>
                      </select>
                      <button className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100" onClick={() => startEdit(cheque)} type="button">Editar</button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(cheque.importe)}</p>
                    <div className="text-right">
                      {(cheque.estado === 'A_DEPOSITAR' || (cheque.estado === 'PENDIENTE' && isDueToday(cheque.fecha_vencimiento))) ? <p className="text-[11px] font-semibold text-amber-700">{cheque.estado === 'A_DEPOSITAR' ? 'A depositar' : 'Depositar hoy'}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
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
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <h2 className="text-lg font-semibold">Proyección de flujo de caja</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {tesoreria.proyeccionFlujo.map((row) => {
              const active = row.horizonte === detalleHorizonte;
              return (
                <button
                  key={`flow-${row.horizonte}`}
                  type="button"
                  onClick={() => setDetalleHorizonte(row.horizonte)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{row.horizonte}</p>
                    <span className="text-xs font-semibold text-blue-700">Ver detalle</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(row.saldo_estimado)}</p>
                  <p className="mt-1 text-xs text-slate-500">Ingresos {formatCurrency(row.ingresos_estimados)} · Egresos {formatCurrency(row.egresos_estimados)}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Detalle del plazo</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{detalleHorizonte}</h3>
              </div>
              {proyeccionSeleccionada ? <p className="text-lg font-semibold text-slate-900">{formatCurrency(proyeccionSeleccionada.saldo_estimado)}</p> : null}
            </div>

            {detalleSinCheques ? (
              <p className="mt-4 text-sm text-slate-600">No hay cheques pendientes en este plazo.</p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Cheques emitidos pendientes</p>
                  <div className="mt-3 space-y-2">
                    {emitidosPendientesDetalle.length > 0 ? emitidosPendientesDetalle.map((cheque) => (
                      <div key={cheque.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{cheque.numero}</span>
                          <span className="text-xs text-slate-500">{formatDate(cheque.fecha_vencimiento)}</span>
                        </div>
                        <p className="mt-1 text-slate-600">{cheque.tercero}</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatCurrency(cheque.importe)}</p>
                        <p className="mt-1 text-xs font-semibold text-red-700">Hoy hay un cheque que cubrir</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">Sin cheques emitidos pendientes en este plazo.</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Cheques recibidos pendientes</p>
                  <div className="mt-3 space-y-2">
                    {recibidosPendientesDetalle.length > 0 ? recibidosPendientesDetalle.map((cheque) => (
                      <div key={cheque.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{cheque.numero}</span>
                          <span className="text-xs text-slate-500">{formatDate(cheque.fecha_vencimiento)}</span>
                        </div>
                        <p className="mt-1 text-slate-600">{cheque.tercero}</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatCurrency(cheque.importe)}</p>
                        <p className="mt-1 text-xs font-semibold text-amber-700">Cheque recibido {cheque.numero} listo para depositar</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">Sin cheques recibidos pendientes en este plazo.</p>}
                  </div>
                </div>
              </div>
            )}
            {proyeccionSeleccionada ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ingresos</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-700">{formatCurrency(proyeccionSeleccionada.ingresos_estimados)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Egresos</p>
                  <p className="mt-2 text-lg font-semibold text-rose-700">{formatCurrency(proyeccionSeleccionada.egresos_estimados)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Saldo proyectado</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(proyeccionSeleccionada.saldo_estimado)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

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
