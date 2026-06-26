import { useMemo, useState } from 'react';
import { FiArrowLeft, FiPlus, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../shared/components/card';
import { ROUTES } from '../../../app/config/routes';
import { useFinanzas } from '../hooks/useFinanzas';

type BudgetPeriodicidad = 'semanal' | 'quincenal' | 'mensual';
type BudgetConfig = {
  id: string;
  nombre: string;
  periodicidad: BudgetPeriodicidad;
  rubros: string[];
  monto_maximo: number | null;
};

const BUDGET_CONFIG_KEY = 'finanzas_control_presupuestal_v2';
const BUDGET_CONFIG_LEGACY_KEY = 'finanzas_control_presupuestal_v1';

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const statusClassByPresupuesto = (estado: 'En control' | 'Atención' | 'Excedido') => {
  if (estado === 'Excedido') return 'border-red-200 bg-red-50 text-red-700';
  if (estado === 'Atención') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
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
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(BUDGET_CONFIG_KEY) ?? window.localStorage.getItem(BUDGET_CONFIG_LEGACY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map((value, index) => {
      const candidate = value as Partial<BudgetConfig>;
      return {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `budget-${Date.now()}-${index}`,
        nombre: typeof candidate.nombre === 'string' && candidate.nombre.trim() ? candidate.nombre.trim() : `Presupuesto ${index + 1}`,
        periodicidad: candidate.periodicidad === 'semanal' || candidate.periodicidad === 'quincenal' || candidate.periodicidad === 'mensual' ? candidate.periodicidad : 'mensual',
        rubros: Array.isArray(candidate.rubros) ? candidate.rubros.filter((item): item is string => typeof item === 'string') : [],
        monto_maximo: typeof candidate.monto_maximo === 'number' && Number.isFinite(candidate.monto_maximo) ? candidate.monto_maximo : null,
      };
    });
  } catch {
    return fallback;
  }
};

const writeBudgetConfigs = (config: BudgetConfig[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BUDGET_CONFIG_KEY, JSON.stringify(config));
};

const PresupuestosPage = () => {
  const navigate = useNavigate();
  const { tesoreria } = useFinanzas();
  const [budgetConfigs, setBudgetConfigs] = useState<BudgetConfig[]>(() => readBudgetConfigs());
  const [budgetDraft, setBudgetDraft] = useState<BudgetConfig>(() => createDefaultBudgetConfig());
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetFeedback, setBudgetFeedback] = useState<string | null>(null);

  const budgetRows = useMemo(() => budgetConfigs.map((config) => {
    const rubrosSeleccionados = config.rubros.length > 0 ? tesoreria.gastosPorRubro.filter((row) => config.rubros.includes(row.rubro)) : tesoreria.gastosPorRubro;
    const ejecutado = rubrosSeleccionados.reduce((acc, row) => acc + row.monto, 0);
    const disponible = config.monto_maximo !== null ? config.monto_maximo - ejecutado : null;
    const avance = config.monto_maximo && config.monto_maximo > 0 ? (ejecutado / config.monto_maximo) * 100 : 0;
    const estado: 'En control' | 'Atención' | 'Excedido' = config.monto_maximo !== null && config.monto_maximo > 0 && ejecutado > config.monto_maximo
      ? 'Excedido'
      : avance >= 90
        ? 'Atención'
        : 'En control';
    return { ...config, ejecutado, disponible, avance, estado };
  }), [budgetConfigs, tesoreria.gastosPorRubro]);

  const openBudgetEditor = (budget?: BudgetConfig) => {
    const current = budget ?? createDefaultBudgetConfig(`Presupuesto ${budgetConfigs.length + 1}`);
    setEditingBudgetId(budget?.id ?? null);
    setBudgetDraft(current);
    setBudgetFeedback(null);
  };

  const closeBudgetEditor = () => {
    setEditingBudgetId(null);
    setBudgetDraft(createDefaultBudgetConfig());
    setBudgetFeedback(null);
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
    closeBudgetEditor();
  };

  return (
    <div className="space-y-6 p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Control presupuestal</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Presupuestos</h1>
          <p className="mt-2 text-sm text-slate-600">Gestiona presupuestos múltiples con edición separada de Costos.</p>
        </div>
        <button type="button" onClick={() => navigate(ROUTES.COSTOS)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <FiArrowLeft size={14} />
          Volver a Costos
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{editingBudgetId ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
              <p className="text-sm text-slate-500">La configuración se guarda en localStorage.</p>
            </div>
            <button type="button" onClick={closeBudgetEditor} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              <FiX size={13} />
              Limpiar
            </button>
          </div>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nombre</span>
            <input value={budgetDraft.nombre} onChange={(event) => setBudgetDraft((current) => ({ ...current, nombre: event.target.value }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" />
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
            <input type="number" step="0.01" value={budgetDraft.monto_maximo ?? ''} onChange={(event) => setBudgetDraft((current) => ({ ...current, monto_maximo: event.target.value === '' ? null : Number(event.target.value) }))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => openBudgetEditor()} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Nuevo</button>
            <button type="button" onClick={handleSaveBudgetConfig} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20">Guardar configuración</button>
          </div>
          {budgetFeedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{budgetFeedback}</div> : null}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Presupuestos guardados</h2>
              <p className="text-sm text-slate-500">Editar o crear presupuestos desde su pantalla propia.</p>
            </div>
            <button type="button" onClick={() => openBudgetEditor()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
              <FiPlus size={14} />
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
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClassByPresupuesto(row.estado)}`}>{row.estado}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{row.periodicidad} · {row.rubros.length > 0 ? `${row.rubros.length} rubros` : 'Todos los rubros'}</p>
                    <p className="mt-1 text-sm text-slate-700">Presupuesto: {row.monto_maximo !== null ? formatCurrency(row.monto_maximo) : 'Sin definir'} · Ejecutado: {formatCurrency(row.ejecutado)}</p>
                  </div>
                  <button type="button" onClick={() => openBudgetEditor(row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    Editar
                  </button>
                </div>
              </div>
            ))}
            {budgetRows.length === 0 ? <p className="text-sm text-slate-500">Sin presupuestos configurados.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PresupuestosPage;
