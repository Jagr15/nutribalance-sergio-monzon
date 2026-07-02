import { useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiPlus, FiPower, FiRotateCcw, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../shared/components/card';
import { useFinanzas } from '../hooks/useFinanzas';
import { FlujoCharts } from '../components/FlujoCharts';
import { KpiGrid } from '../components/KpiGrid';
import { MovimientosTable } from '../components/MovimientosTable';
import { RegistrarMovimientoForm } from '../components/RegistrarMovimientoForm';
import { usePermissions } from '../../auth/usePermissions';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { ROUTES } from '../../../app/config/routes';
import { normalizeNumericInputChange, parseNumericInput } from '../../../shared/utils/formatters';
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
const BUDGET_CONFIG_KEY = 'finanzas_control_presupuestal_v2';
const BUDGET_CONFIG_LEGACY_KEY = 'finanzas_control_presupuestal_v1';

type MovimientosHistoryFilter = 'ALL' | 'CONFIRMADO' | 'PENDIENTE' | 'ANULADO';
type BudgetPeriodicidad = 'semanal' | 'quincenal' | 'mensual';
type BudgetConfig = {
  id: string;
  nombre: string;
  periodicidad: BudgetPeriodicidad;
  rubros: string[];
  monto_maximo: number | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin dato';
  return formatDateDDMMYYYY(date);
};

const statusClassByPresupuesto = (estado: 'En control' | 'Atención' | 'Excedido') => {
  if (estado === 'Excedido') return 'border-red-200 bg-red-50 text-red-700';
  if (estado === 'Atención') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const estadoLabelByClient = (diasAtraso: number | null, proximoVencimiento: string | null) => {
  if (diasAtraso && diasAtraso > 0) return 'Vencida';
  if (proximoVencimiento) return 'Próxima';
  return 'Al día';
};

const createDefaultBudgetConfig = (name = 'Presupuesto principal'): BudgetConfig => ({
  id: `budget-${Date.now()}`,
  nombre: name,
  periodicidad: 'mensual',
  rubros: [],
  monto_maximo: null,
});

const readBudgetConfigs = (): BudgetConfig[] => {
  const fallback = [createDefaultBudgetConfig()];
  const legacyFallback = createDefaultBudgetConfig();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(BUDGET_CONFIG_KEY) ?? window.localStorage.getItem(BUDGET_CONFIG_LEGACY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    const parseOne = (value: unknown, index: number): BudgetConfig | null => {
      if (!value || typeof value !== 'object') return null;
      const candidate = value as Partial<BudgetConfig>;
      const periodicidad = candidate.periodicidad === 'semanal' || candidate.periodicidad === 'quincenal' || candidate.periodicidad === 'mensual'
        ? candidate.periodicidad
        : 'mensual';
      return {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `budget-${Date.now()}-${index}`,
        nombre: typeof candidate.nombre === 'string' && candidate.nombre.trim() ? candidate.nombre.trim() : `Presupuesto ${index + 1}`,
        periodicidad,
        rubros: Array.isArray(candidate.rubros) ? candidate.rubros.filter((item): item is string => typeof item === 'string') : [],
        monto_maximo: typeof candidate.monto_maximo === 'number' && Number.isFinite(candidate.monto_maximo) ? candidate.monto_maximo : null,
      };
    };
    if (Array.isArray(parsed)) {
      const normalized = parsed.map(parseOne).filter((item): item is BudgetConfig => Boolean(item));
      return normalized.length > 0 ? normalized : fallback;
    }
    const single = parseOne(parsed, 0) ?? legacyFallback;
    return [single];
  } catch {
    return fallback;
  }
};

const writeBudgetConfigs = (config: BudgetConfig[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BUDGET_CONFIG_KEY, JSON.stringify(config));
};

const FinanzasPage = () => {
  const { kpis, reportes, tesoreria, movimientos, costosComparativos, loading, loadError, infoMessage, refresh, createMovimiento } = useFinanzas();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const [variacionesSort, setVariacionesSort] = useState<(typeof variacionesSortOptions)[number]['value']>('desviacion');
  const [ingresosSort, setIngresosSort] = useState<IngresoPtSortMode>('venta_real');
  const [movimientosQuery, setMovimientosQuery] = useState('');
  const [movimientosHistoryFilter, setMovimientosHistoryFilter] = useState<MovimientosHistoryFilter>('ALL');
  const [rubrosFinancieros, setRubrosFinancieros] = useState<RubroFinancieroAdmin[]>([]);
  const [rubroForm, setRubroForm] = useState<RubroFinancieroFormValues>({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
  const [editingRubroId, setEditingRubroId] = useState<string | null>(null);
  const [rubroError, setRubroError] = useState<string | null>(null);
  const [rubrosSavedMessage, setRubrosSavedMessage] = useState<string | null>(null);
  const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
  const [isRubrosModalOpen, setIsRubrosModalOpen] = useState(false);
  const [isRubrosFullModalOpen, setIsRubrosFullModalOpen] = useState(false);
  const [isBudgetEditorOpen, setIsBudgetEditorOpen] = useState(false);
  const [budgetConfigs, setBudgetConfigs] = useState<BudgetConfig[]>(() => readBudgetConfigs());
  const [budgetDraft, setBudgetDraft] = useState<BudgetConfig>(() => createDefaultBudgetConfig());
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetFeedback, setBudgetFeedback] = useState<string | null>(null);
  const [budgetSavedMessage, setBudgetSavedMessage] = useState<string | null>(null);
  const rubroFormRef = useRef<HTMLFormElement | null>(null);

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
  const gastosPorRubroVisibles = useMemo(
    () => tesoreria.gastosPorRubro,
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
    () => ingresosPtPorProducto.filter((row) => row.importe_total > 0),
    [ingresosPtPorProducto],
  );
  const rubrosActivos = useMemo(() => rubrosFinancieros.filter((rubro) => rubro.activo), [rubrosFinancieros]);
  const rubrosFinancierosVisibles = useMemo(() => rubrosFinancieros, [rubrosFinancieros]);
  const rubrosFinancierosPreview = useMemo(() => rubrosFinancierosVisibles.slice(0, 5), [rubrosFinancierosVisibles]);
  const rubrosInactivosEnPresupuesto = useMemo(() => {
    const activeIds = new Set(rubrosActivos.map((rubro) => rubro.id));
    return budgetDraft.rubros
      .map((id) => rubrosFinancieros.find((rubro) => rubro.id === id))
      .filter((rubro): rubro is RubroFinancieroAdmin => Boolean(rubro && !activeIds.has(rubro.id)));
  }, [budgetDraft.rubros, rubrosActivos, rubrosFinancieros]);
  const budgetRubrosOptions = useMemo(
    () => rubrosActivos.map((rubro) => ({
      id: rubro.nombre,
      label: rubro.nombre,
      activo: rubro.activo,
    })),
    [rubrosActivos],
  );
  const budgetRows = useMemo(() => budgetConfigs.map((config) => {
    const rubrosSeleccionados = config.rubros.length > 0
      ? tesoreria.gastosPorRubro.filter((row) => config.rubros.includes(row.rubro))
      : tesoreria.gastosPorRubro;
    const ejecutado = rubrosSeleccionados.reduce((acc, row) => acc + row.monto, 0);
    const disponible = config.monto_maximo !== null ? config.monto_maximo - ejecutado : null;
    const avance = config.monto_maximo && config.monto_maximo > 0 ? (ejecutado / config.monto_maximo) * 100 : 0;
    const estado: 'En control' | 'Atención' | 'Excedido' = config.monto_maximo !== null && config.monto_maximo > 0 && ejecutado > config.monto_maximo
      ? 'Excedido'
      : avance >= 90
        ? 'Atención'
        : 'En control';
    return {
      ...config,
      ejecutado,
      disponible,
      avance,
      estado,
    };
  }), [budgetConfigs, tesoreria.gastosPorRubro]);
  const budgetExceeded = budgetRows.some((row) => row.estado === 'Excedido');
  const carteraClientesVisibles = useMemo(
    () => tesoreria.carteraClientes.filter((row) => row.saldo_pendiente > 0),
    [tesoreria.carteraClientes],
  );
  const chequesEmitidosVisibles = useMemo(
    () => tesoreria.chequesEmitidos.filter((row) => row.importe > 0),
    [tesoreria.chequesEmitidos],
  );
  const chequesRecibidosVisibles = useMemo(
    () => tesoreria.chequesRecibidos.filter((row) => row.importe > 0),
    [tesoreria.chequesRecibidos],
  );
  const alertasTesoreriaVisibles = useMemo(
    () => tesoreria.alertasTesoreria,
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
    const filtered = [...movimientos].filter((row) => {
      const haystack = `${row.descripcion} ${row.categoria ?? ''} ${row.tipo} ${row.estado}`.toLowerCase();
      if (!query) return true;
      return haystack.includes(query);
    });

    return filtered
      .sort((a, b) => {
        const aPending = a.estado === 'PENDIENTE' ? 1 : 0;
        const bPending = b.estado === 'PENDIENTE' ? 1 : 0;
        if (aPending !== bPending) {
          return bPending - aPending;
        }
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      })
      .slice(0, 10);
  }, [movimientos, movimientosQuery]);
  const movimientosHistory = useMemo(() => {
    return [...movimientos]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .filter((row) => movimientosHistoryFilter === 'ALL' ? true : row.estado === movimientosHistoryFilter);
  }, [movimientos, movimientosHistoryFilter]);

  const cuentasPorCobrar = useMemo(() => {
    return movimientos.filter((m) => {
      const isIngreso = m.tipo === 'INGRESO';
      const isPending = m.estado === 'PENDIENTE' || ['PENDIENTE_COBRO', 'VENCIDO'].includes(m.estado_financiero || '');
      const isNotCobrado = m.estado_financiero !== 'COBRADO';
      return isIngreso && isPending && isNotCobrado;
    });
  }, [movimientos]);

  const cuentasPorPagar = useMemo(() => {
    return movimientos.filter((m) => {
      const isEgreso = m.tipo === 'EGRESO';
      const isPending = m.estado === 'PENDIENTE' || ['PENDIENTE_PAGO', 'VENCIDO'].includes(m.estado_financiero || '');
      const isNotPagado = m.estado_financiero !== 'PAGADO';
      return isEgreso && isPending && isNotPagado;
    });
  }, [movimientos]);

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
      setRubrosFinancieros((current) => (current.some((item) => item.id === saved.id) ? current.map((item) => (item.id === saved.id ? row : item)) : [...current, row]));
      if (editingRubroId) {
        setRubrosSavedMessage('Rubro actualizado correctamente.');
      } else {
        setRubrosSavedMessage('Rubro creado correctamente. Puedes verlo en Ver todos los rubros.');
        setIsRubrosFullModalOpen(true);
      }
      setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
      setEditingRubroId(null);
    } catch (error: unknown) {
      setRubroError(error instanceof Error ? error.message : 'No se pudo guardar el rubro.');
    }
  };

  const handleCloseRubrosModal = () => {
    setIsRubrosModalOpen(false);
    setIsRubrosFullModalOpen(false);
    setEditingRubroId(null);
    setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
    setRubroError(null);
    setRubrosSavedMessage(null);
  };

  const openBudgetEditor = (budget?: BudgetConfig) => {
    const current = budget ?? {
      id: `budget-${Date.now()}`,
      nombre: `Presupuesto ${budgetConfigs.length + 1}`,
      periodicidad: 'mensual' as BudgetPeriodicidad,
      rubros: [],
      monto_maximo: null,
    };
    setEditingBudgetId(budget?.id ?? null);
    setBudgetDraft(current);
    setBudgetFeedback(null);
    setIsBudgetEditorOpen(true);
  };

  const closeBudgetEditor = () => {
    setEditingBudgetId(null);
    setBudgetDraft({
      id: `budget-${Date.now()}`,
      nombre: 'Presupuesto principal',
      periodicidad: 'mensual',
      rubros: [],
      monto_maximo: null,
    });
    setBudgetFeedback(null);
    setIsBudgetEditorOpen(false);
  };

  const handleSaveBudgetConfig = () => {
    const normalizedRubros = Array.from(new Set(budgetDraft.rubros));
    const nextConfig: BudgetConfig = {
      id: budgetDraft.id || `budget-${Date.now()}`,
      nombre: budgetDraft.nombre.trim() || 'Presupuesto sin nombre',
      periodicidad: budgetDraft.periodicidad,
      rubros: normalizedRubros,
      monto_maximo: budgetDraft.monto_maximo,
    };

    if (!nextConfig.periodicidad) {
      setBudgetFeedback('Selecciona una periodicidad.');
      return;
    }
    if (nextConfig.monto_maximo === null || !Number.isFinite(nextConfig.monto_maximo) || nextConfig.monto_maximo <= 0) {
      setBudgetFeedback('El monto máximo debe ser mayor a 0.');
      return;
    }
    if (nextConfig.rubros.length === 0) {
      setBudgetFeedback('Selecciona al menos un rubro.');
      return;
    }

    setBudgetConfigs((current) => {
      const updated = editingBudgetId && current.some((item) => item.id === editingBudgetId)
        ? current.map((item) => (item.id === editingBudgetId ? { ...nextConfig, id: editingBudgetId } : item))
        : [...current, nextConfig];
      writeBudgetConfigs(updated);
      return updated;
    });
    setBudgetFeedback('Configuración guardada correctamente.');
    setBudgetSavedMessage('Configuración de presupuesto actualizada.');
    setIsBudgetEditorOpen(false);
    setEditingBudgetId(null);
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

  const handleNewRubro = () => {
    setEditingRubroId(null);
    setRubroForm({ nombre: '', tipo: '', activo: true, area: RUBRO_AREA_DEFAULT });
    setRubroError(null);
    setRubrosSavedMessage(null);
    window.setTimeout(() => rubroFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleToggleRubro = (rubro: RubroFinancieroAdmin) => {
    if (!rubro.activo && !window.confirm(`¿Activar el rubro ${rubro.nombre}?`)) return;
    if (rubro.activo && !window.confirm(`¿Seguro que deseas desactivar el rubro ${rubro.nombre}?`)) return;
    void finanzasService.toggleRubroFinanciero(rubro.id, !rubro.activo).then(() => {
      setRubrosFinancieros((current) => current.map((item) => (item.id === rubro.id ? { ...item, activo: !rubro.activo } : item)));
    });
    setRubrosSavedMessage(rubro.activo ? `Rubro ${rubro.nombre} desactivado.` : `Rubro ${rubro.nombre} activado.`);
  };

  const handleOpenRubrosModal = () => {
    setIsRubrosModalOpen(true);
    setRubroError(null);
    setRubrosSavedMessage(null);
  };

  const renderRubroEditorForm = (compact = false) => (
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
            setRubrosSavedMessage(null);
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

      <div className={`mt-4 ${compact ? 'space-y-3' : 'space-y-4'}`}>
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
  );

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
                  Administrar rubros
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
                  {rubrosFinancierosPreview.map((rubro) => (
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
                  {rubrosFinancierosVisibles.length > rubrosFinancierosPreview.length ? (
                    <button
                      type="button"
                      onClick={() => setIsRubrosFullModalOpen(true)}
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Ver todos los rubros
                    </button>
                  ) : null}
                </div>
              </div>

              {renderRubroEditorForm()}
            </div>
          </div>
        </div>
      ) : null}

      {isRubrosFullModalOpen ? (
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
            aria-labelledby="rubros-completos-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Costos</p>
                <h3 id="rubros-completos-title" className="mt-1 text-xl font-semibold text-slate-900">Todos los rubros financieros</h3>
                <p className="mt-1 text-sm text-slate-500">Consulta todos los rubros, su estado y sus acciones disponibles.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRubrosFullModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar modal"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-slate-200 bg-slate-100 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold">Área</th>
                      <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
              {rubrosFinancierosVisibles.map((rubro) => (
                      <tr key={rubro.id} className="align-top">
                        <td className="px-4 py-3 font-medium text-slate-900">{rubro.nombre}</td>
                        <td className="px-4 py-3 text-slate-700">{rubroTipoLabels[rubro.tipo]}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${rubro.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                            {rubro.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{rubro.area ?? '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {renderRubroEditorForm(true)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loadError && infoMessage ? (
        <Card className="border-slate-200 bg-slate-50 text-slate-700">
          {infoMessage}
        </Card>
      ) : null}

      {budgetSavedMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
          {budgetSavedMessage}
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
                onClick={() => setIsHistorialModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ver historial completo
              </button>
                <button
                  type="button"
                  onClick={handleOpenRubrosModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Administrar rubros
                </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.PRESUPUESTOS)}
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
              <MovimientosTable movimientos={movimientosQuick} limit={10} onRefresh={refresh} />
            </div>
            {budgetExceeded ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                Presupuesto excedido: los gastos reales superan el límite configurado.
              </div>
            ) : null}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
            <MovimientosTable
              movimientos={cuentasPorCobrar}
              limit={cuentasPorCobrar.length}
              showDiasVencimiento={true}
              title="Cuentas por Cobrar"
              subtitle="Ingresos pendientes de cobro y vencidos."
              onRefresh={refresh}
            />
            <MovimientosTable
              movimientos={cuentasPorPagar}
              limit={cuentasPorPagar.length}
              showDiasVencimiento={true}
              title="Cuentas por Pagar"
              subtitle="Egresos pendientes de pago y vencidos."
              onRefresh={refresh}
            />
          </div>
        </div>
      ) : null}

      {isHistorialModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" onClick={() => setIsHistorialModalOpen(false)} role="presentation">
          <div className="w-full max-w-7xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="historial-completo-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Movimientos financieros</p>
                <h3 id="historial-completo-title" className="mt-1 text-xl font-semibold text-slate-900">Historial completo</h3>
                <p className="mt-1 text-sm text-slate-500">Explora todos los registros con filtros por estado.</p>
              </div>
              <div className="flex items-center gap-2">
                {(['ALL', 'CONFIRMADO', 'PENDIENTE', 'ANULADO'] as const).map((estado) => (
                  <button
                    key={estado}
                    type="button"
                    onClick={() => setMovimientosHistoryFilter(estado)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${movimientosHistoryFilter === estado ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {estado === 'ALL' ? 'Todos' : estado === 'ANULADO' ? 'Acoplado' : estado === 'CONFIRMADO' ? 'Confirmado' : 'Pendiente'}
                  </button>
                ))}
                <button type="button" onClick={() => setIsHistorialModalOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100">
                  <FiX size={16} />
                </button>
              </div>
            </div>
            <div className="mt-5">
              <MovimientosTable movimientos={movimientosHistory} limit={movimientosHistory.length} onRefresh={refresh} />
            </div>
          </div>
        </div>
      ) : null}

      {isBudgetEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" onClick={closeBudgetEditor} role="presentation">
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
                <h3 id="editar-presupuesto-title" className="mt-1 text-xl font-semibold text-slate-900">
                  {editingBudgetId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">Configura nombre, periodicidad, monto máximo y rubros incluidos. Los cambios se guardan en el navegador.</p>
              </div>
              <button
                type="button"
                onClick={closeBudgetEditor}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nombre del presupuesto</span>
                  <input
                    value={budgetDraft.nombre}
                    onChange={(event) => setBudgetDraft((current) => ({ ...current, nombre: event.target.value }))}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                    placeholder="Ej: Presupuesto operativo"
                  />
                </label>
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Periodicidad</span>
                  <select value={budgetDraft.periodicidad} onChange={(event) => setBudgetDraft((current) => ({ ...current, periodicidad: event.target.value as BudgetPeriodicidad }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </label>
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Monto máximo de gastos</span>
            <input
              type="number"
              step="0.01"
              value={budgetDraft.monto_maximo ?? ''}
              onChange={(event) => setBudgetDraft((current) => ({
                ...current,
                monto_maximo: parseNumericInput(normalizeNumericInputChange(event.target.value)),
              }))}
              className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
              placeholder="Ej: 250000"
            />
                </label>
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Rubros incluidos</span>
                  <div className="mt-2 grid gap-2">
                    {budgetRubrosOptions.map((rubro) => {
                      const checked = budgetDraft.rubros.includes(rubro.id);
                      return (
                        <label key={rubro.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => setBudgetDraft((current) => ({
                              ...current,
                              rubros: event.target.checked ? [...current.rubros, rubro.id] : current.rubros.filter((item) => item !== rubro.id),
                            }))}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <span className="text-slate-700">{rubro.label}</span>
                        </label>
                      );
                    })}
                    {budgetRubrosOptions.length === 0 ? <p className="text-sm text-slate-500">No hay rubros disponibles para incluir.</p> : null}
                  </div>
                  {rubrosInactivosEnPresupuesto.length > 0 ? (
                    <p className="text-xs text-amber-700">
                      Aviso: este presupuesto conserva rubros desactivados que ya no se pueden seleccionar nuevamente: {rubrosInactivosEnPresupuesto.map((rubro) => rubro.nombre).join(', ')}.
                    </p>
                  ) : null}
                </label>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setBudgetDraft(createDefaultBudgetConfig())} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Restablecer</button>
                  <button type="button" onClick={handleSaveBudgetConfig} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20">Guardar configuración</button>
                </div>
                {budgetFeedback ? (
                  <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${budgetFeedback.includes('correctamente') ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {budgetFeedback}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Resumen local</h4>
                    <p className="text-sm text-slate-500">La configuración se guarda en el navegador.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Periodicidad</p>
                    <p className="mt-1 font-semibold text-slate-900">{budgetDraft.periodicidad}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Monto máximo</p>
                    <p className="mt-1 font-semibold text-slate-900">{budgetDraft.monto_maximo !== null ? formatCurrency(budgetDraft.monto_maximo) : 'Sin definir'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Rubros</p>
                    <p className="mt-1 font-semibold text-slate-900">{budgetDraft.rubros.length > 0 ? budgetDraft.rubros.length : 'Todos'}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  La configuración se persiste en localStorage al guardar.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Presupuestos guardados</h4>
                    <p className="text-sm text-slate-500">Puedes crear o editar más de uno.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openBudgetEditor()}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Agregar presupuesto
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {budgetRows.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{row.nombre}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClassByPresupuesto(row.estado)}`}>
                              {row.estado}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{row.periodicidad} · {row.rubros.length > 0 ? `${row.rubros.length} rubros` : 'Todos los rubros'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openBudgetEditor(row)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
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
              <p className="text-sm text-slate-500">Gestiona presupuestos múltiples con control local, edición y creación rápida.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {presupuestosGenerados ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                  Presupuesto estimado
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => openBudgetEditor()}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                <FiEdit2 size={14} />
                Nuevo presupuesto
              </button>
            </div>
          </div>
          {budgetRows.some((row) => row.estado !== 'En control') ? (
            <div className="mb-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Alertas presupuestarias</p>
              <ul className="space-y-1 text-sm">
                {budgetRows.filter((row) => row.estado !== 'En control').map((row) => (
                  <li key={`alert-${row.id}`}>
                    {row.nombre}: {row.estado === 'Excedido' ? 'supera el presupuesto' : 'supera el 90% del presupuesto'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 text-left font-semibold">Nombre</th>
                  <th className="py-2 text-left font-semibold">Periodicidad</th>
                  <th className="py-2 text-right font-semibold">Presupuesto</th>
                  <th className="py-2 text-right font-semibold">Ejecutado</th>
                  <th className="py-2 text-right font-semibold">Disponible</th>
                  <th className="py-2 text-right font-semibold">Avance %</th>
                  <th className="py-2 text-right font-semibold">Estado</th>
                  <th className="py-2 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgetRows.map((row) => {
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="py-2 font-medium text-slate-900">{row.nombre}</td>
                      <td className="py-2 text-slate-700 capitalize">{row.periodicidad}</td>
                      <td className="py-2 text-right text-slate-700">{row.monto_maximo !== null ? formatCurrency(row.monto_maximo) : 'Sin definir'}</td>
                      <td className="py-2 text-right text-slate-700">{formatCurrency(row.ejecutado)}</td>
                      <td className={`py-2 text-right font-semibold ${row.disponible !== null && row.disponible < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {row.disponible !== null ? formatCurrency(row.disponible) : 'Sin límite'}
                      </td>
                      <td className="py-2 text-right font-semibold text-slate-700">
                        {formatPct(row.avance)}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClassByPresupuesto(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openBudgetEditor(row)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {budgetRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">Sin presupuestos configurados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3">
            {budgetRows.map((row) => {
              const progresso = row.avance;
              return (
                <div key={`bar-${row.id}`}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.nombre}</span>
                    <span>{row.monto_maximo !== null ? `${formatCurrency(row.monto_maximo)} vs ${formatCurrency(row.ejecutado)}` : `${formatCurrency(row.ejecutado)} ejecutado`}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${progresso <= 80 ? 'bg-emerald-500' : progresso <= 100 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                    <span>{row.monto_maximo !== null ? `Presupuesto ${formatCurrency(row.monto_maximo)}` : 'Sin tope configurado'}</span>
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleNewRubro}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FiPlus size={14} />
                Nuevo rubro
              </button>
              <button
                type="button"
                onClick={() => setIsRubrosFullModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Ver todos los rubros
              </button>
            </div>
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
                  {rubrosFinancierosPreview.map((rubro) => (
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
              ref={rubroFormRef}
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
                    <div key={`${row.rubro ?? 'rubro'}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="font-semibold text-slate-900">{row.rubro}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(row.monto)} · {formatPct(row.porcentaje)}</p>
                      </div>
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsRubrosFullModalOpen(true)}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Ver todos los rubros
                  </button>
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
                {ingresosPtVisibles.map((row, index) => (
                  <div key={`${row.producto ?? 'producto'}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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
                    {carteraClientesVisibles.map((row, index) => (
                      <tr key={`${row.cliente_id ?? row.cliente_nombre ?? 'cliente'}-${index}`}>
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
                    {variacionesOrdenadas.map((row, index) => (
                      <tr key={`${row.rubro ?? 'var'}-${index}`}>
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
