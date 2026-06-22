import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiPlus, FiPower, FiRotateCcw, FiX } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { ROUTES } from '../../../app/config/routes';
import { useFinanzas } from '../hooks/useFinanzas';
import { FlujoCharts } from '../components/FlujoCharts';
import { KpiGrid } from '../components/KpiGrid';
import { MovimientosTable } from '../components/MovimientosTable';
import { RegistrarMovimientoForm } from '../components/RegistrarMovimientoForm';
import { usePermissions } from '../../auth/usePermissions';
import {
  enrichIngresosPtPorProducto,
  RUBRO_AREA_DEFAULT,
  RUBRO_AREA_OPTIONS,
  normalizeRubroFinancieroInput,
  sortIngresosPtPorProducto,
  type IngresoPtSortMode,
  type RubroFinancieroAdmin,
  type RubroFinancieroFormValues,
  type RubroFinancieroTipo,
} from '../utils/finanzasDashboard';
import { finanzasService } from '../services/finanzasService';
import type { PresupuestoMensualGestionRow } from '../types';

const rubroTipoLabels: Record<RubroFinancieroTipo, string> = {
  FIJO: 'Fijo',
  VARIABLE: 'Variable',
  MIXTO: 'Mixto',
};

const variacionesSortOptions = [
  { value: 'desviacion', label: 'Mayor desviación' },
  { value: 'menor_desviacion', label: 'Menor desviación' },
  { value: 'mayor_gasto', label: 'Mayor gasto' },
  { value: 'menor_gasto', label: 'Menor gasto' },
] as const;

const ingresosSortOptions: Array<{ value: IngresoPtSortMode; label: string }> = [
  { value: 'venta_real', label: 'Mayor venta real' },
  { value: 'variacion', label: 'Mayor variación' },
  { value: 'alfabetico', label: 'Alfabético' },
];

const rubroTipoOptions: Array<{ value: 'INGRESO' | 'EGRESO'; label: string }> = [
  { value: 'INGRESO', label: 'Ingreso' },
  { value: 'EGRESO', label: 'Egreso' },
];

const toFormularioTipo = (tipo: RubroFinancieroTipo): 'INGRESO' | 'EGRESO' => (tipo === 'FIJO' ? 'INGRESO' : 'EGRESO');
const toRubroTipo = (tipo: 'INGRESO' | 'EGRESO' | ''): RubroFinancieroTipo => (tipo === 'INGRESO' ? 'FIJO' : 'VARIABLE');

const chartColors = ['#2563eb', '#0f766e', '#ea580c', '#7c3aed', '#d97706', '#db2777', '#64748b'];
const PAGE_NOW = new Date().getTime();

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const formatPct = (value: number) => `${value.toFixed(1)}%`;
const DEPRECATED_KEYWORDS = ['prueba', 'test', 'demo', 'www', 'tttt'];

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin dato';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const statusClassByPresupuesto = (estado: 'En control' | 'Atención' | 'Excedido') => {
  if (estado === 'Excedido') return 'border-red-200 bg-red-50 text-red-700';
  if (estado === 'Atención') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const presupuestoEstadoCustom = (real: number, presupuesto: number) => {
  if (presupuesto <= 0) return 'En control';
  const ratio = (real / presupuesto) * 100;
  if (ratio <= 80) return 'En control';
  if (ratio <= 100) return 'Atención';
  return 'Excedido';
};

const isRubrorVisible = (rubro: string) => {
  const normalized = rubro.trim().toLowerCase();
  if (!normalized) return false;
  if (DEPRECATED_KEYWORDS.includes(normalized)) return false;
  return true;
};

const hasDeprecatedText = (value?: string | null) => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return true;
  return DEPRECATED_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const isRubroFinancieroVisible = (rubro: RubroFinancieroAdmin) => !hasDeprecatedText(rubro.nombre);

const estadoLabelByClient = (diasAtraso: number | null, proximoVencimiento: string | null) => {
  if (diasAtraso && diasAtraso > 0) return 'Vencida';
  if (proximoVencimiento) return 'Próxima';
  return 'Al día';
};

const FinanzasPage = () => {
  const { kpis, reportes, tesoreria, movimientos, costosComparativos, loading, loadError, infoMessage, refresh, createMovimiento } = useFinanzas();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();

  const [variacionesSort, setVariacionesSort] = useState<(typeof variacionesSortOptions)[number]['value']>('desviacion');
  const [ingresosSort, setIngresosSort] = useState<IngresoPtSortMode>('venta_real');
  const [movimientosQuery, setMovimientosQuery] = useState('');
  const [rubrosFinancieros, setRubrosFinancieros] = useState<RubroFinancieroAdmin[]>([]);
  const [rubroForm, setRubroForm] = useState<RubroFinancieroFormValues>({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
  const [editingRubroId, setEditingRubroId] = useState<string | null>(null);
  const [rubroError, setRubroError] = useState<string | null>(null);
  const [rubrosSavedMessage, setRubrosSavedMessage] = useState<string | null>(null);
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isRubrosModalOpen, setIsRubrosModalOpen] = useState(false);
  const [isPresupuestoModalOpen, setIsPresupuestoModalOpen] = useState(false);
  const [presupuestosMensuales, setPresupuestosMensuales] = useState<PresupuestoMensualGestionRow[]>([]);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetMessage, setBudgetMessage] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState<{ mes: number; anio: number; rubro_id: string; presupuesto: string }>({
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    rubro_id: '',
    presupuesto: '',
  });

  useEffect(() => {
    void finanzasService.getRubrosFinancieros().then((rows) => {
      setRubrosFinancieros(rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        tipo: row.tipo === 'INGRESO' ? 'FIJO' : 'VARIABLE',
        activo: row.activo,
        editable: true,
        origen: 'personalizado',
        area: row.area ?? null,
        categoria_financiera_id: row.id,
      })));
    });
    void finanzasService.getPresupuestosMensuales().then(setPresupuestosMensuales).catch((error) => {
      console.error(error);
    });
  }, []);

  const ingresosPtPorProducto = useMemo(
    () => sortIngresosPtPorProducto(
      enrichIngresosPtPorProducto(reportes.ingresos_pt_por_producto, costosComparativos),
      ingresosSort,
    ),
    [costosComparativos, ingresosSort, reportes.ingresos_pt_por_producto],
  );

  const variacionesOrdenadas = useMemo(
    () => [...tesoreria.variacionesPorRubro]
      .filter((row) => isRubrorVisible(row.rubro))
      .sort((a, b) => {
      if (variacionesSort === 'desviacion') return Math.abs(b.variacion_pct) - Math.abs(a.variacion_pct);
      if (variacionesSort === 'menor_desviacion') return Math.abs(a.variacion_pct) - Math.abs(b.variacion_pct);
      if (variacionesSort === 'mayor_gasto') return b.real - a.real;
      return a.real - b.real;
      }),
    [tesoreria.variacionesPorRubro, variacionesSort],
  );

  const cxcResumen = useMemo(() => {
    const total = tesoreria.carteraClientes.reduce((acc, row) => acc + row.saldo_pendiente, 0);
    const vencidas = tesoreria.carteraClientes.filter((row) => (row.dias_atraso ?? 0) > 0).length;
    const proximas = tesoreria.carteraClientes.filter((row) => {
      if (!row.proximo_vencimiento) return false;
      const diff = new Date(row.proximo_vencimiento).getTime() - PAGE_NOW;
      return diff >= 0 && diff <= 7 * 86400000;
    }).length;
    return { total, vencidas, proximas };
  }, [tesoreria.carteraClientes]);

  const presupuestoRows = tesoreria.presupuestoVsReal;
  const presupuestosGenerados = presupuestoRows.some((row) => row.generado);
  const presupuestoRowsVisibles = useMemo(() => (
    [...presupuestoRows]
      .filter((row) => isRubrorVisible(row.rubro))
      .filter((row) => row.presupuesto !== 0 || row.real !== 0)
      .sort((a, b) => Math.abs(b.variacion_abs) - Math.abs(a.variacion_abs))
  ), [presupuestoRows]);
  const presupuestoPeriodoActual = useMemo(() => {
    const now = new Date();
    return {
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
    };
  }, []);
  const presupuestosGestionVisibles = useMemo(() => (
    presupuestosMensuales.filter((row) => row.mes === budgetForm.mes && row.anio === budgetForm.anio)
  ), [budgetForm.anio, budgetForm.mes, presupuestosMensuales]);
  const presupuestoRowsGestion = useMemo(() => (
    presupuestoRowsVisibles.map((row) => ({
      rubro: row.rubro,
      presupuesto: row.presupuesto,
      ejecutado: row.real,
      disponible: row.presupuesto - row.real,
      porcentaje: row.presupuesto > 0 ? (row.real / row.presupuesto) * 100 : 0,
      estado: presupuestoEstadoCustom(row.real, row.presupuesto) as 'En control' | 'Atención' | 'Excedido',
    }))
  ), [presupuestoRowsVisibles]);
  const gastosPorRubroVisibles = useMemo(
    () => tesoreria.gastosPorRubro.filter((row) => isRubrorVisible(row.rubro)),
    [tesoreria.gastosPorRubro],
  );
  const topGastosPorRubro = useMemo(
    () => [...gastosPorRubroVisibles].sort((a, b) => b.monto - a.monto).slice(0, 5),
    [gastosPorRubroVisibles],
  );
  const hasTopGastos = topGastosPorRubro.length >= 2;
  const gastoDominante = topGastosPorRubro[0] ?? null;
  const gastoDominantePct = gastoDominante && topGastosPorRubro.length > 0
    ? (gastoDominante.monto / topGastosPorRubro.reduce((acc, row) => acc + row.monto, 0)) * 100
    : 0;
  const ingresosPtVisibles = useMemo(
    () => ingresosPtPorProducto.filter((row) => !hasDeprecatedText(row.producto) && row.importe_total > 0),
    [ingresosPtPorProducto],
  );
  const rubrosFinancierosVisibles = useMemo(
    () => rubrosFinancieros.filter(isRubroFinancieroVisible),
    [rubrosFinancieros],
  );
  const carteraClientesVisibles = useMemo(
    () => tesoreria.carteraClientes.filter((row) => row.saldo_pendiente > 0 && !hasDeprecatedText(row.cliente_nombre)),
    [tesoreria.carteraClientes],
  );
  const chequesEmitidosVisibles = useMemo(
    () => tesoreria.chequesEmitidos.filter((row) => row.importe > 0 && !hasDeprecatedText(row.tercero) && !hasDeprecatedText(row.numero)),
    [tesoreria.chequesEmitidos],
  );
  const chequesRecibidosVisibles = useMemo(
    () => tesoreria.chequesRecibidos.filter((row) => row.importe > 0 && !hasDeprecatedText(row.tercero) && !hasDeprecatedText(row.numero)),
    [tesoreria.chequesRecibidos],
  );
  const alertasTesoreriaVisibles = useMemo(
    () => tesoreria.alertasTesoreria.filter((row) => !hasDeprecatedText(row.titulo) && !hasDeprecatedText(row.tipo)),
    [tesoreria.alertasTesoreria],
  );
  const hasUsefulIngresosPt = ingresosPtVisibles.length > 0;
  const hasUsefulCartera = carteraClientesVisibles.length > 0;
  const hasUsefulCheques = chequesEmitidosVisibles.length > 0 || chequesRecibidosVisibles.length > 0;
  const hasUsefulAlertas = alertasTesoreriaVisibles.length > 0;
  const hasReportes =
    reportes.flujo_caja_mensual.length > 0 ||
    reportes.gastos_por_categoria.length > 0 ||
    reportes.ingresos_por_categoria.length > 0 ||
    reportes.ingresos_pt_por_producto.length > 0 ||
    reportes.rentabilidad_por_formula.length > 0 ||
    reportes.costo_operativo_mensual.length > 0 ||
    costosComparativos.length > 0 ||
    tesoreria.presupuestoVsReal.length > 0 ||
    tesoreria.carteraClientes.length > 0 ||
    tesoreria.chequesEmitidos.length > 0 ||
    tesoreria.chequesRecibidos.length > 0 ||
    tesoreria.proyeccionFlujo.length > 0 ||
    tesoreria.alertasTesoreria.length > 0;

  const movimientosQuick = useMemo(() => {
    const query = movimientosQuery.trim().toLowerCase();
    return [...movimientos]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .filter((row) => {
        const haystack = `${row.descripcion} ${row.categoria ?? ''} ${row.tipo} ${row.estado}`.toLowerCase();
        if (hasDeprecatedText(row.descripcion) || hasDeprecatedText(row.categoria) || hasDeprecatedText(row.origen_operativo)) return false;
        if (!query) return true;
        return haystack.includes(query);
      })
      .slice(0, 10);
  }, [movimientos, movimientosQuery]);
  const hasMoreThanTenMovimientos = movimientos.length > 10;

  const handleRubroSubmit = async () => {
    setRubroError(null);
    setRubrosSavedMessage(null);
    try {
      const normalized = normalizeRubroFinancieroInput(rubroForm);
      if (!normalized.nombre) throw new Error('El nombre del rubro es obligatorio.');
      if (!normalized.tipo) throw new Error('Selecciona ingreso o egreso.');
      const saved = await finanzasService.saveRubroFinanciero({
        id: editingRubroId ?? undefined,
        nombre: normalized.nombre,
        tipo: normalized.tipo,
        activo: normalized.activo,
        area: normalized.area,
      });
      setRubrosFinancieros((current) => {
        const row = {
          id: saved.id,
          nombre: saved.nombre,
          tipo: toRubroTipo(saved.tipo),
          activo: saved.activo,
          editable: true,
          origen: 'personalizado',
          area: saved.area ?? null,
          categoria_financiera_id: saved.id,
        } satisfies RubroFinancieroAdmin;
        return current.some((item) => item.id === saved.id) ? current.map((item) => (item.id === saved.id ? row : item)) : [...current, row];
      });
      setRubrosSavedMessage(editingRubroId ? 'Rubro actualizado correctamente.' : 'Rubro creado correctamente.');
      setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
      setEditingRubroId(null);
    } catch (error: unknown) {
      setRubroError(error instanceof Error ? error.message : 'No se pudo guardar el rubro.');
    }
  };

  const handleCloseRubrosModal = () => {
    setIsRubrosModalOpen(false);
    setEditingRubroId(null);
    setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
    setRubroError(null);
    setRubrosSavedMessage(null);
  };

  const handleEditRubro = (rubro: RubroFinancieroAdmin) => {
    setEditingRubroId(rubro.id);
    setRubroForm({
      nombre: rubro.nombre,
      tipo: toFormularioTipo(rubro.tipo),
      activo: rubro.activo,
      area: rubro.area ?? RUBRO_AREA_DEFAULT,
    });
    setRubroError(null);
    setRubrosSavedMessage(null);
  };

  const handleToggleRubro = (rubro: RubroFinancieroAdmin) => {
    if (!rubro.activo && !window.confirm(`¿Activar el rubro ${rubro.nombre}?`)) return;
    if (rubro.activo && !window.confirm(`¿Seguro que deseas desactivar el rubro ${rubro.nombre}?`)) return;
    void finanzasService.toggleRubroFinanciero(rubro.id, !rubro.activo).then(() => {
      setRubrosFinancieros((current) => current.map((item) => (item.id === rubro.id ? { ...item, activo: !rubro.activo } : item)));
    });
    setRubrosSavedMessage(rubro.activo ? `Rubro ${rubro.nombre} desactivado.` : `Rubro ${rubro.nombre} activado.`);
  };

  const handleEditBudget = (row?: PresupuestoMensualGestionRow) => {
    if (row) {
      setEditingBudgetId(row.id);
      setBudgetForm({ mes: row.mes, anio: row.anio, rubro_id: row.rubro_id, presupuesto: String(row.presupuesto) });
    } else {
      setEditingBudgetId(null);
      setBudgetForm({
        mes: presupuestoPeriodoActual.mes,
        anio: presupuestoPeriodoActual.anio,
        rubro_id: '',
        presupuesto: '',
      });
    }
    setBudgetError(null);
    setBudgetMessage(null);
    setIsPresupuestoModalOpen(true);
  };

  const handleDeleteBudget = async (id: string) => {
    setBudgetError(null);
    if (!window.confirm('¿Eliminar este presupuesto mensual?')) return;
    try {
      await finanzasService.deletePresupuestoMensual(id);
      setPresupuestosMensuales((current) => current.filter((row) => row.id !== id));
      setBudgetMessage('Presupuesto eliminado correctamente.');
    } catch (error: unknown) {
      setBudgetError(error instanceof Error ? error.message : 'No se pudo eliminar el presupuesto.');
    }
  };

  const handleSaveBudget = async () => {
    setBudgetError(null);
    setBudgetMessage(null);
    try {
      const presupuesto = Number(budgetForm.presupuesto);
      if (!budgetForm.rubro_id) throw new Error('Selecciona un rubro.');
      if (!Number.isFinite(presupuesto) || presupuesto < 0) throw new Error('El presupuesto debe ser mayor o igual a 0.');
      const saved = await finanzasService.savePresupuestoMensual({
        id: editingBudgetId ?? undefined,
        rubro_id: budgetForm.rubro_id,
        mes: budgetForm.mes,
        anio: budgetForm.anio,
        presupuesto,
      });
      setPresupuestosMensuales((current) => {
        const next = current.filter((row) => row.id !== saved.id);
        return [saved, ...next].sort((a, b) => b.anio - a.anio || b.mes - a.mes || a.rubro_nombre.localeCompare(b.rubro_nombre, 'es'));
      });
      setBudgetMessage(editingBudgetId ? 'Presupuesto actualizado correctamente.' : 'Presupuesto creado correctamente.');
      setEditingBudgetId(saved.id);
    } catch (error: unknown) {
      setBudgetError(error instanceof Error ? error.message : 'No se pudo guardar el presupuesto.');
    }
  };

  const ingresosPtMax = Math.max(1, ...ingresosPtPorProducto.map((row) => row.importe_total));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200">Centro Ejecutivo de Producción</p>
        <h1 className="mt-2 text-3xl font-semibold">Finanzas / Costos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Control de presupuesto, gastos reales, ventas y rentabilidad.
        </p>
      </section>

      {loadError ? (
        <Card className="border-red-200 bg-red-50 text-red-700">
          No pudimos cargar la información financiera.
        </Card>
      ) : null}

      {isRubrosModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
          onClick={handleCloseRubrosModal}
          role="presentation"
        >
          <div
            className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="configurar-rubros-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Costos</p>
                <h3 id="configurar-rubros-title" className="mt-1 text-xl font-semibold text-slate-900">
                  Configurar rubros
                </h3>
                <p className="mt-1 text-sm text-slate-500">Gestiona rubros activos e inactivos desde un solo lugar.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseRubrosModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar modal"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Listado de rubros</h4>
                    <p className="text-sm text-slate-500">Activos e inactivos, sin datos de prueba o demo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRubroId(null);
                      setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
                      setRubroError(null);
                      setRubrosSavedMessage(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <FiPlus size={14} />
                    Nuevo rubro
                  </button>
                </div>

                <div className="space-y-3">
                  {rubrosFinancierosVisibles.map((rubro) => (
                    <div key={rubro.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{rubro.nombre}</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {rubroTipoLabels[rubro.tipo]}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${rubro.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                              {rubro.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{rubro.origen === 'base' ? 'Rubro base del sistema' : 'Rubro personalizado'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditRubro(rubro)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            <FiEdit2 size={13} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleRubro(rubro)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                              rubro.activo
                                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <FiPower size={13} />
                            {rubro.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleRubroSubmit();
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {editingRubroId ? 'Editar rubro' : 'Crear rubro'}
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-slate-900">
                      {editingRubroId ? 'Modificar rubro financiero' : 'Nuevo rubro financiero'}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRubroId(null);
                      setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
                      setRubroError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <FiRotateCcw size={13} />
                    Limpiar
                  </button>
                </div>

                {rubroError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {rubroError}
                  </div>
                ) : null}

                {rubrosSavedMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {rubrosSavedMessage}
                  </div>
                ) : null}

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nombre</span>
                    <input
                      value={rubroForm.nombre}
                      onChange={(event) => setRubroForm((current) => ({ ...current, nombre: event.target.value }))}
                      className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                      placeholder="Ej: Materia prima"
                    />
                  </label>

                  <label className="block">
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo</span>
                    <select
                      value={rubroForm.tipo}
                      onChange={(event) => setRubroForm((current) => ({ ...current, tipo: event.target.value as 'INGRESO' | 'EGRESO' | '' }))}
                      className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                    >
                      <option value="">Seleccionar tipo</option>
                      {rubroTipoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Área</span>
                    <select
                      value={rubroForm.area}
                      onChange={(event) => setRubroForm((current) => ({ ...current, area: event.target.value }))}
                      className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                    >
                      {RUBRO_AREA_OPTIONS.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={rubroForm.activo}
                      onChange={(event) => setRubroForm((current) => ({ ...current, activo: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-slate-700">Rubro activo</span>
                  </label>

                  <div className="flex justify-end gap-3">
                    <button
                      type="submit"
                      className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                    >
                      {editingRubroId ? 'Guardar cambios' : 'Crear rubro'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {!loadError && infoMessage ? (
        <Card className="border-slate-200 bg-slate-50 text-slate-700">
          {infoMessage}
        </Card>
      ) : null}

      {canAccess('finanzas', 'register_financial_movement') ? (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Movimientos financieros</h3>
                <p className="text-sm text-slate-500">Registra ingresos, egresos y transferencias desde un modal.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.MOVIMIENTOS_FINANCIEROS)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Ver historial completo
                </button>
                <button
                  type="button"
                  onClick={() => setIsRubrosModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Configurar rubros
                </button>
                <button
                  type="button"
                  onClick={() => handleEditBudget()}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Editar presupuesto
                </button>
                <button
                  type="button"
                  onClick={() => setIsMovimientoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                >
                  <FiPlus size={14} />
                  + Registrar movimiento
                </button>
              </div>
            </div>
          </Card>
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Vista rápida</p>
                <p className="mt-1 text-sm text-slate-500">Mostrando los últimos 10 movimientos. Utilice 'Ver historial completo' para consultar todos los registros.</p>
              </div>
              <label className="block w-full sm:max-w-sm">
                <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Buscar</span>
                <input
                  value={movimientosQuery}
                  onChange={(event) => setMovimientosQuery(event.target.value)}
                  className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  placeholder="Descripción, categoría, tipo o estado"
                />
              </label>
            </div>
            {hasMoreThanTenMovimientos ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Mostrando los últimos 10 movimientos. Utilice 'Ver historial completo' para consultar todos los registros.
              </div>
            ) : null}
            <div className="mt-4">
              <MovimientosTable movimientos={movimientosQuick} limit={10} />
            </div>
          </Card>
        </div>
      ) : null}

      {isPresupuestoModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" onClick={() => setIsPresupuestoModalOpen(false)} role="presentation">
          <div
            className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-presupuesto-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Control presupuestal</p>
                <h3 id="editar-presupuesto-title" className="mt-1 text-xl font-semibold text-slate-900">Editar presupuesto</h3>
                <p className="mt-1 text-sm text-slate-500">Gestión mensual por rubro con límite máximo editable.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPresupuestoModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <FiX size={16} />
              </button>
            </div>

            {budgetError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{budgetError}</div> : null}
            {budgetMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{budgetMessage}</div> : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <form className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSaveBudget(); }}>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Mes</span>
                    <select value={budgetForm.mes} onChange={(event) => setBudgetForm((current) => ({ ...current, mes: Number(event.target.value) }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Año</span>
                    <input type="number" value={budgetForm.anio} onChange={(event) => setBudgetForm((current) => ({ ...current, anio: Number(event.target.value) }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" />
                  </label>
                </div>
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Rubro</span>
                  <select value={budgetForm.rubro_id} onChange={(event) => setBudgetForm((current) => ({ ...current, rubro_id: event.target.value }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
                    <option value="">Seleccionar rubro</option>
                    {rubrosFinancierosVisibles.map((rubro) => <option key={rubro.id} value={rubro.id}>{rubro.nombre}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Presupuesto mensual máximo</span>
                  <input type="number" step="0.01" value={budgetForm.presupuesto} onChange={(event) => setBudgetForm((current) => ({ ...current, presupuesto: event.target.value }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" placeholder="Ej: 250000" />
                </label>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setIsPresupuestoModalOpen(false)} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
                  <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20">Guardar presupuesto</button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Presupuestos del período</h4>
                    <p className="text-sm text-slate-500">{budgetForm.mes}/{budgetForm.anio}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{presupuestosGestionVisibles.length} rubros</span>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Rubro</th>
                        <th className="px-4 py-3 text-right">Presupuesto</th>
                        <th className="px-4 py-3 text-right">Editar</th>
                        <th className="px-4 py-3 text-right">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {presupuestosGestionVisibles.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{row.rubro_nombre}</div>
                            <div className="text-xs text-slate-500">{row.mes}/{row.anio}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.presupuesto)}</td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => handleEditBudget(row)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Editar</button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => void handleDeleteBudget(row.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Eliminar</button>
                          </td>
                        </tr>
                      ))}
                      {presupuestosGestionVisibles.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aún no hay presupuestos cargados para este período.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isMovimientoModalOpen && canAccess('finanzas', 'register_financial_movement') ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
          onClick={() => setIsMovimientoModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="registrar-movimiento-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Movimientos financieros</p>
                <h3 id="registrar-movimiento-title" className="mt-1 text-xl font-semibold text-slate-900">
                  Registrar movimiento financiero
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMovimientoModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar modal"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="mt-6">
              <RegistrarMovimientoForm
                rubros={rubrosFinancieros.filter((rubro) => rubro.activo).map((rubro) => ({
                  id: rubro.id,
                  nombre: rubro.nombre,
                  tipo: toFormularioTipo(rubro.tipo),
                  activo: rubro.activo,
                  area: rubro.area ?? null,
                }))}
                onSubmit={async (payload) => {
                  await createMovimiento(payload);
                  await refresh();
                }}
                onSuccess={() => setIsMovimientoModalOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`kpi-skel-${index}`} className="h-24 animate-pulse bg-slate-100 border-slate-200">
              <div />
            </Card>
          ))}
        </section>
      ) : (
        <KpiGrid kpis={kpis} />
      )}

      {loading ? (
        <Card className="h-80 animate-pulse bg-slate-100 border-slate-200">
          <div />
        </Card>
      ) : (
        <FlujoCharts reportes={reportes} />
      )}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Control presupuestal</h3>
              <p className="text-sm text-slate-500">Compara el presupuesto estimado contra lo realmente ejecutado por rubro.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {presupuestosGenerados ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                  Presupuesto estimado
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleEditBudget()}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                <FiEdit2 size={14} />
                Editar presupuesto
              </button>
            </div>
          </div>
          {presupuestoRowsGestion.some((row) => row.estado !== 'En control') ? (
            <div className="mb-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Alertas presupuestarias</p>
              <ul className="space-y-1 text-sm">
                {presupuestoRowsGestion.filter((row) => row.estado !== 'En control').map((row) => (
                  <li key={`alert-${row.rubro}`}>
                    {row.rubro}: {row.estado === 'Excedido' ? 'supera el presupuesto mensual' : 'supera el 80% del presupuesto'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 text-left font-semibold">Rubro</th>
                  <th className="py-2 text-right font-semibold">Presupuesto</th>
                  <th className="py-2 text-right font-semibold">Ejecutado</th>
                  <th className="py-2 text-right font-semibold">Disponible</th>
                  <th className="py-2 text-right font-semibold">Avance %</th>
                  <th className="py-2 text-right font-semibold">Estado</th>
                  <th className="py-2 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presupuestoRowsGestion.map((row) => {
                  const avancePct = row.porcentaje;
                  return (
                    <tr key={row.rubro} className="align-top">
                      <td className="py-2 font-medium text-slate-900">{row.rubro}</td>
                      <td className="py-2 text-right text-slate-700">{formatCurrency(row.presupuesto)}</td>
                      <td className="py-2 text-right text-slate-700">{formatCurrency(row.ejecutado)}</td>
                      <td className={`py-2 text-right font-semibold ${row.disponible < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(row.disponible)}
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-700">
                        {formatPct(avancePct)}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClassByPresupuesto(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleEditBudget(presupuestosMensuales.find((item) => item.mes === budgetForm.mes && item.anio === budgetForm.anio && item.rubro_nombre === row.rubro))}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {presupuestoRowsGestion.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">Sin datos de presupuesto.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3">
            {presupuestoRowsGestion.map((row) => {
              const progresso = row.porcentaje;
              return (
                <div key={`bar-${row.rubro}`}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.rubro}</span>
                    <span>{formatCurrency(row.presupuesto)} vs {formatCurrency(row.ejecutado)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${progresso <= 80 ? 'bg-emerald-500' : progresso <= 100 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                    <span>Presupuesto {formatCurrency(row.presupuesto)}</span>
                    <span>Avance {formatPct(progresso)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Rubros financieros</h3>
              <p className="text-sm text-slate-500">Crear, editar y activar o desactivar rubros operativos.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRubroId(null);
                setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
                setRubroError(null);
                setRubrosSavedMessage(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <FiPlus size={14} />
              Nuevo rubro
            </button>
          </div>

          {rubroError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {rubroError}
            </div>
          ) : null}

          {rubrosSavedMessage ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {rubrosSavedMessage}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-3">
              {rubrosFinancieros.map((rubro) => (
                <div key={rubro.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{rubro.nombre}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {rubroTipoLabels[rubro.tipo]}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${rubro.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                          {rubro.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{rubro.origen === 'base' ? 'Rubro base del sistema' : 'Rubro personalizado'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditRubro(rubro)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <FiEdit2 size={13} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleRubro(rubro)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          rubro.activo
                            ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        <FiPower size={13} />
                        {rubro.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                handleRubroSubmit();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {editingRubroId ? 'Editar rubro' : 'Crear rubro'}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-slate-900">
                    {editingRubroId ? 'Modificar rubro financiero' : 'Nuevo rubro financiero'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRubroId(null);
                    setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
                    setRubroError(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <FiRotateCcw size={13} />
                  Limpiar
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nombre</span>
                  <input
                    value={rubroForm.nombre}
                    onChange={(event) => setRubroForm((current) => ({ ...current, nombre: event.target.value }))}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                    placeholder="Ej: Materia prima"
                  />
                </label>

                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo</span>
                  <select
                    value={rubroForm.tipo}
                    onChange={(event) => setRubroForm((current) => ({ ...current, tipo: event.target.value as 'INGRESO' | 'EGRESO' | '' }))}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  >
                    <option value="">Seleccionar tipo</option>
                    {rubroTipoOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Área</span>
                  <select
                    value={rubroForm.area}
                    onChange={(event) => setRubroForm((current) => ({ ...current, area: event.target.value }))}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  >
                    {RUBRO_AREA_OPTIONS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={rubroForm.activo}
                    onChange={(event) => setRubroForm((current) => ({ ...current, activo: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-slate-700">Rubro activo</span>
                </label>

                <div className="flex justify-end gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                  >
                    {editingRubroId ? 'Guardar cambios' : 'Crear rubro'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Rubros base cargados: Materia prima, Producción, Nómina, Servicios, Logística, Marketing y Otros.
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {hasTopGastos ? (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Top gastos por rubro</h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[170px_1fr] items-center">
                <div
                  className="mx-auto h-36 w-36 rounded-full border border-slate-200 shadow-inner"
                  style={{
                    background: `conic-gradient(${topGastosPorRubro
                      .map((row, index) => {
                        const start = topGastosPorRubro.slice(0, index).reduce((acc, item) => acc + item.monto, 0);
                        const end = start + row.monto;
                        return `${chartColors[index % chartColors.length]} ${((start / topGastosPorRubro.reduce((acc, item) => acc + item.monto, 0)) * 100).toFixed(2)}% ${((end / topGastosPorRubro.reduce((acc, item) => acc + item.monto, 0)) * 100).toFixed(2)}%`;
                      })
                      .join(', ')})`,
                  }}
                />
                <div className="space-y-2">
                  {topGastosPorRubro.map((row, index) => (
                    <div key={row.rubro} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="font-semibold text-slate-900">{row.rubro}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(row.monto)} · {formatPct(row.porcentaje)}</p>
                      </div>
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    </div>
                  ))}
                </div>
              </div>
              {gastoDominante && gastoDominantePct > 80 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {gastoDominante.rubro} concentra el {formatPct(gastoDominantePct)} del gasto mostrado en esta vista.
                </div>
              ) : null}
            </Card>
          ) : null}

          {hasUsefulIngresosPt ? (
            <Card>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Ingresos por producto vendido</h3>
                  <p className="text-sm text-slate-500">Ventas reales de producto terminado con clientes atendidos.</p>
                </div>
                <select
                  value={ingresosSort}
                  onChange={(event) => setIngresosSort(event.target.value as IngresoPtSortMode)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {ingresosSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {ingresosPtVisibles.map((row) => (
                  <div key={row.producto} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.producto}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.cantidad_kg.toLocaleString('es-AR')} kg · {row.clientes_count} clientes atendidos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(row.importe_total)}</p>
                        <p className="text-xs text-slate-500">
                          {row.variacion_pct !== null ? `Variación ${formatPct(row.variacion_pct)}` : 'Sin variación disponible'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(row.importe_total / ingresosPtMax) * 100}%` }} />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Último movimiento: {formatDate(row.ultima_fecha)}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {hasUsefulCartera ? (
            <Card>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Cartera de clientes</h3>
                  <p className="text-sm text-slate-500">Saldo pendiente, última venta y atraso por cliente.</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Total por cobrar: <span className="font-semibold text-lime-700">{formatCurrency(cxcResumen.total)}</span></p>
                  <p>Clientes con deuda: <span className="font-semibold text-slate-900">{carteraClientesVisibles.length}</span></p>
                  <p>Vencidas: <span className="font-semibold text-red-600">{cxcResumen.vencidas}</span> · Próximas: <span className="font-semibold text-amber-600">{cxcResumen.proximas}</span></p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 text-left font-semibold">Cliente</th>
                      <th className="py-2 text-right font-semibold">Saldo pendiente</th>
                      <th className="py-2 text-left font-semibold">Última venta</th>
                      <th className="py-2 text-left font-semibold">Estado</th>
                      <th className="py-2 text-right font-semibold">Días de atraso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {carteraClientesVisibles.map((row) => (
                      <tr key={row.cliente_id ?? row.cliente_nombre}>
                        <td className="py-2 font-medium text-slate-900">{row.cliente_nombre}</td>
                        <td className="py-2 text-right">{formatCurrency(row.saldo_pendiente)}</td>
                        <td className="py-2 text-slate-700">{formatDate(row.ultima_compra)}</td>
                        <td className="py-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                            {estadoLabelByClient(row.dias_atraso, row.proximo_vencimiento)}
                          </span>
                        </td>
                        <td className="py-2 text-right">{row.dias_atraso !== null ? row.dias_atraso : '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {variacionesOrdenadas.length > 0 ? (
            <Card>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Variaciones por rubro</h3>
                  <p className="text-sm text-slate-500">Ranking ordenable por desviación o gasto.</p>
                </div>
                <select
                  value={variacionesSort}
                  onChange={(event) => setVariacionesSort(event.target.value as typeof variacionesSort)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {variacionesSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 text-left font-semibold">Rubro</th>
                      <th className="py-2 text-right font-semibold">Presupuesto</th>
                      <th className="py-2 text-right font-semibold">Real</th>
                      <th className="py-2 text-right font-semibold">Variación $</th>
                      <th className="py-2 text-right font-semibold">Variación %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variacionesOrdenadas.map((row) => (
                      <tr key={`var-${row.rubro}`}>
                        <td className="py-2 font-medium text-slate-900">{row.rubro}</td>
                        <td className="py-2 text-right">{formatCurrency(row.presupuesto)}</td>
                        <td className="py-2 text-right">{formatCurrency(row.real)}</td>
                        <td className={`py-2 text-right font-semibold ${row.variacion_abs > 0 ? 'text-red-600' : row.variacion_abs < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {formatCurrency(row.variacion_abs)}
                        </td>
                        <td className={`py-2 text-right font-semibold ${row.variacion_pct > 0 ? 'text-red-600' : row.variacion_pct < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {formatPct(row.variacion_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {hasUsefulCheques || hasUsefulAlertas ? (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Tesorería / Cheques</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {chequesEmitidosVisibles.length > 0 ? (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Cheques emitidos</p>
                    <div className="space-y-2">
                      {chequesEmitidosVisibles.map((row) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-semibold text-slate-900">{row.numero}</span>
                            <span className="text-slate-600">{formatCurrency(row.importe)}</span>
                          </div>
                          <p className="text-xs text-slate-500">{row.tercero} · vence {formatDate(row.fecha_vencimiento)} · {row.estado}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {chequesRecibidosVisibles.length > 0 ? (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Cheques recibidos</p>
                      <div className="space-y-2">
                        {chequesRecibidosVisibles.map((row) => (
                          <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="font-semibold text-slate-900">{row.numero}</span>
                              <span className="text-slate-600">{formatCurrency(row.importe)}</span>
                            </div>
                            <p className="text-xs text-slate-500">{row.tercero} · vence {formatDate(row.fecha_vencimiento)} · {row.estado}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {hasUsefulAlertas ? (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Alertas de tesorería</p>
                      <div className="space-y-2">
                        {alertasTesoreriaVisibles.map((alerta) => (
                          <div key={alerta.alerta_id} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            <p className="font-semibold">{alerta.titulo}</p>
                            <p className="text-xs text-red-700">{alerta.tipo}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </section>

      {!loading && !hasReportes ? (
        <Card className="text-slate-600">
          <p className="font-semibold">Sin reportes financieros disponibles.</p>
        </Card>
      ) : null}

      {loading ? <p className="text-sm text-gray-500">Cargando finanzas…</p> : null}
    </div>
  );
};

export default FinanzasPage;
