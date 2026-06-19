import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiPower, FiRotateCcw } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { ApiService } from '../../../infrastructure/api';
import { useFinanzas } from '../hooks/useFinanzas';
import { FlujoCharts } from '../components/FlujoCharts';
import { KpiGrid } from '../components/KpiGrid';
import { MovimientosTable } from '../components/MovimientosTable';
import { RegistrarMovimientoForm } from '../components/RegistrarMovimientoForm';
import { CostosFormulaVsRealTable } from '../components/CostosFormulaVsRealTable';
import { usePermissions } from '../../auth/usePermissions';
import type { UltimoPrecioPagadoInsumo } from '../../insumos/types';
import {
  buildMateriaPrimaSimulation,
  enrichIngresosPtPorProducto,
  getPresupuestoEstado,
  normalizeRubroFinancieroInput,
  sortIngresosPtPorProducto,
  type IngresoPtSortMode,
  type MateriaPrimaSimulationResult,
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

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin dato';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const statusClassByPresupuesto = (estado: ReturnType<typeof getPresupuestoEstado>) => {
  if (estado === 'Excedido') return 'border-red-200 bg-red-50 text-red-700';
  if (estado === 'Atención') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const estadoLabelByClient = (diasAtraso: number | null, proximoVencimiento: string | null) => {
  if (diasAtraso && diasAtraso > 0) return 'Vencida';
  if (proximoVencimiento) return 'Próxima';
  return 'Al día';
};

const FinanzasPage = () => {
  const { kpis, reportes, tesoreria, movimientos, costosComparativos, loading, loadError, infoMessage, refresh, createMovimiento } = useFinanzas();
  const { canAccess } = usePermissions();

  const [variacionesSort, setVariacionesSort] = useState<(typeof variacionesSortOptions)[number]['value']>('desviacion');
  const [ingresosSort, setIngresosSort] = useState<IngresoPtSortMode>('venta_real');
  const [rubrosFinancieros, setRubrosFinancieros] = useState<RubroFinancieroAdmin[]>([]);
  const [rubroForm, setRubroForm] = useState<RubroFinancieroFormValues>({ nombre: '', tipo: '', activo: true, area: '' });
  const [editingRubroId, setEditingRubroId] = useState<string | null>(null);
  const [rubroError, setRubroError] = useState<string | null>(null);
  const [rubrosSavedMessage, setRubrosSavedMessage] = useState<string | null>(null);
  const [ultimosPrecios, setUltimosPrecios] = useState<UltimoPrecioPagadoInsumo[]>([]);
  const [simInsumoId, setSimInsumoId] = useState('');
  const [simIncrementoPct, setSimIncrementoPct] = useState(10);
  const [simVolumen, setSimVolumen] = useState(1000);
  const [simulatorError, setSimulatorError] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;
    void ApiService.stockMP.getUltimosPrecios()
      .then((data) => {
        if (!mounted) return;
        setSimulatorError(null);
        setUltimosPrecios(data);
        setSimInsumoId((current) => current || data[0]?.id_insumo || '');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setSimulatorError(error instanceof Error ? error.message : 'No se pudieron cargar los precios de insumos.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const ingresosPtPorProducto = useMemo(
    () => sortIngresosPtPorProducto(
      enrichIngresosPtPorProducto(reportes.ingresos_pt_por_producto, costosComparativos),
      ingresosSort,
    ),
    [costosComparativos, ingresosSort, reportes.ingresos_pt_por_producto],
  );

  const variacionesOrdenadas = useMemo(
    () => [...tesoreria.variacionesPorRubro].sort((a, b) => {
      if (variacionesSort === 'desviacion') return Math.abs(b.variacion_pct) - Math.abs(a.variacion_pct);
      if (variacionesSort === 'menor_desviacion') return Math.abs(a.variacion_pct) - Math.abs(b.variacion_pct);
      if (variacionesSort === 'mayor_gasto') return b.real - a.real;
      return a.real - b.real;
    }),
    [tesoreria.variacionesPorRubro, variacionesSort],
  );

  const selectedPrecio = useMemo(
    () => ultimosPrecios.find((row) => row.id_insumo === simInsumoId) ?? ultimosPrecios[0] ?? null,
    [simInsumoId, ultimosPrecios],
  );

  const simulation: MateriaPrimaSimulationResult | null = useMemo(() => {
    if (!selectedPrecio) return null;
    return buildMateriaPrimaSimulation({
      insumo: selectedPrecio.insumo,
      incremento_pct: simIncrementoPct,
      volumen_estimado: simVolumen,
      costo_unitario_actual: selectedPrecio.ultimo_precio,
      ingresos_periodo: kpis.ingresos_mes,
      egresos_periodo: kpis.egresos_mes,
    });
  }, [kpis.egresos_mes, kpis.ingresos_mes, selectedPrecio, simIncrementoPct, simVolumen]);

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
        area: normalized.area?.trim() || null,
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
      setRubroForm({ nombre: '', tipo: '', activo: true, area: '' });
      setEditingRubroId(null);
    } catch (error: unknown) {
      setRubroError(error instanceof Error ? error.message : 'No se pudo guardar el rubro.');
    }
  };

  const handleEditRubro = (rubro: RubroFinancieroAdmin) => {
    setEditingRubroId(rubro.id);
      setRubroForm({
        nombre: rubro.nombre,
      tipo: toFormularioTipo(rubro.tipo),
      activo: rubro.activo,
      area: rubro.area ?? '',
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

      {!loadError && infoMessage ? (
        <Card className="border-slate-200 bg-slate-50 text-slate-700">
          {infoMessage}
        </Card>
      ) : null}

      {canAccess('finanzas', 'register_financial_movement') ? (
        <Card>
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
          />
        </Card>
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
              <h3 className="text-lg font-semibold">Presupuesto vs Real</h3>
              <p className="text-sm text-slate-500">Tabla de presupuesto estimado y ejecución real por rubro.</p>
            </div>
            {presupuestosGenerados ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                Presupuesto estimado
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 text-left font-semibold">Rubro</th>
                  <th className="py-2 text-right font-semibold">Presupuesto estimado</th>
                  <th className="py-2 text-right font-semibold">Real ejecutado</th>
                  <th className="py-2 text-right font-semibold">Variación $</th>
                  <th className="py-2 text-right font-semibold">Variación %</th>
                  <th className="py-2 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presupuestoRows.map((row) => {
                  const estado = getPresupuestoEstado(row.presupuesto, row.real);
                  return (
                    <tr key={row.rubro}>
                      <td className="py-2 font-medium text-slate-900">{row.rubro}</td>
                      <td className="py-2 text-right text-slate-700">{formatCurrency(row.presupuesto)}</td>
                      <td className="py-2 text-right text-slate-700">{formatCurrency(row.real)}</td>
                      <td className={`py-2 text-right font-semibold ${row.variacion_abs > 0 ? 'text-red-600' : row.variacion_abs < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {formatCurrency(row.variacion_abs)}
                      </td>
                      <td className={`py-2 text-right font-semibold ${row.variacion_pct > 0 ? 'text-red-600' : row.variacion_pct < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {formatPct(row.variacion_pct)}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClassByPresupuesto(estado)}`}>
                          {estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {presupuestoRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">Sin datos de presupuesto.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3">
            {presupuestoRows.map((row) => {
              const barMax = Math.max(1, row.presupuesto, row.real);
              return (
                <div key={`bar-${row.rubro}`}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.rubro}</span>
                    <span>{formatCurrency(row.presupuesto)} vs {formatCurrency(row.real)}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-slate-400"
                        style={{ width: `${(row.presupuesto / barMax) * 100}%` }}
                      />
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${(row.real / barMax) * 100}%` }}
                      />
                    </div>
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
                setRubroForm({ nombre: '', tipo: '', activo: true });
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
                    setRubroForm({ nombre: '', tipo: '', activo: true });
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

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Distribución de gastos</h3>
          {tesoreria.gastosPorRubro.length === 0 ? <p className="text-sm text-slate-500">Sin gastos registrados.</p> : null}
          {tesoreria.gastosPorRubro.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-center">
              <div
                className="mx-auto h-52 w-52 rounded-full border border-slate-200 shadow-inner"
                style={{
                  background: `conic-gradient(${tesoreria.gastosPorRubro
                    .map((row, index) => {
                      const start = tesoreria.gastosPorRubro.slice(0, index).reduce((acc, item) => acc + item.porcentaje, 0);
                      const end = start + row.porcentaje;
                      return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
                    })
                    .join(', ')})`,
                }}
              />
              <div className="space-y-3">
                {tesoreria.gastosPorRubro.map((row, index) => (
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
          ) : null}
        </Card>

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
                {variacionesOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">Sin variaciones registradas.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
          {ingresosPtPorProducto.length === 0 ? <p className="text-sm text-slate-500">Sin ventas de producto terminado.</p> : null}
          <div className="space-y-3">
            {ingresosPtPorProducto.map((row) => (
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

        <Card>
          <h3 className="text-lg font-semibold mb-4">Simulador de costo de materia prima</h3>
          {simulatorError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {simulatorError}
            </div>
          ) : null}
          {ultimosPrecios.length === 0 ? (
            <p className="text-sm text-slate-500">No hay precios recientes de insumos disponibles.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Insumo</span>
                  <select
                    value={simInsumoId}
                    onChange={(event) => setSimInsumoId(event.target.value)}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  >
                    {ultimosPrecios.map((precio) => (
                      <option key={precio.id_insumo} value={precio.id_insumo}>
                        {precio.insumo} · {formatCurrency(precio.ultimo_precio)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Incremento %</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={simIncrementoPct}
                    onChange={(event) => setSimIncrementoPct(Number(event.target.value))}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Volumen estimado</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={simVolumen}
                    onChange={(event) => setSimVolumen(Number(event.target.value))}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  />
                </label>
              </div>

              {simulation ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">Costo unitario actual</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(simulation.costo_unitario_actual)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">Costo unitario nuevo</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(simulation.costo_unitario_nuevo)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">Impacto en costo</p>
                      <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(simulation.impacto_costo)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">Impacto en utilidad</p>
                      <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(simulation.impacto_utilidad)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Nuevo margen estimado</p>
                    <p className="mt-1 text-2xl font-black text-blue-600">{formatPct(simulation.margen_nuevo_pct)}</p>
                    <p className="text-xs text-slate-500">Margen actual: {formatPct(simulation.margen_actual_pct)}</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    Para {simulation.volumen_estimado.toLocaleString('es-AR')} kg de {simulation.insumo}, el costo total estimado sube de {formatCurrency(simulation.costo_total_actual)} a {formatCurrency(simulation.costo_total_nuevo)}.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Selecciona un insumo para calcular el impacto.</p>
              )}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Cartera de clientes</h3>
              <p className="text-sm text-slate-500">Saldo pendiente, última venta y atraso por cliente.</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Total por cobrar: <span className="font-semibold text-lime-700">{formatCurrency(cxcResumen.total)}</span></p>
              <p>Clientes con deuda: <span className="font-semibold text-slate-900">{tesoreria.carteraClientes.length}</span></p>
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
                {tesoreria.carteraClientes.map((row) => (
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
                {tesoreria.carteraClientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">Sin cuentas por cobrar registradas.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Tesorería / Cheques</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Cheques emitidos</p>
              <div className="space-y-2">
                {tesoreria.chequesEmitidos.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">{row.numero}</span>
                      <span className="text-slate-600">{formatCurrency(row.importe)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{row.tercero} · vence {formatDate(row.fecha_vencimiento)} · {row.estado}</p>
                  </div>
                ))}
                {tesoreria.chequesEmitidos.length === 0 ? <p className="text-sm text-slate-500">Sin cheques emitidos.</p> : null}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Cheques recibidos</p>
              <div className="space-y-2">
                {tesoreria.chequesRecibidos.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">{row.numero}</span>
                      <span className="text-slate-600">{formatCurrency(row.importe)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{row.tercero} · vence {formatDate(row.fecha_vencimiento)} · {row.estado}</p>
                  </div>
                ))}
                {tesoreria.chequesRecibidos.length === 0 ? <p className="text-sm text-slate-500">Sin cheques recibidos.</p> : null}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Proyección de flujo de caja</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tesoreria.proyeccionFlujo.map((row) => (
              <div key={row.horizonte} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{row.horizonte}</p>
                <p className={`mt-2 text-2xl font-black ${row.saldo_estimado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(row.saldo_estimado)}</p>
                <p className="mt-2 text-xs text-slate-500">Ingresos {formatCurrency(row.ingresos_estimados)} · Egresos {formatCurrency(row.egresos_estimados)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Alertas de tesorería</h3>
          {tesoreria.alertasTesoreria.length === 0 ? <p className="text-sm text-slate-500">Sin alertas de tesorería.</p> : null}
          <div className="space-y-2">
            {tesoreria.alertasTesoreria.map((alerta) => (
              <div key={alerta.alerta_id} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <p className="font-semibold">{alerta.titulo}</p>
                <p className="text-xs text-red-700">{alerta.tipo}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <CostosFormulaVsRealTable rows={costosComparativos} />

      {!loading && !hasReportes ? (
        <Card className="text-slate-600">
          <p className="font-semibold">Sin reportes financieros disponibles.</p>
        </Card>
      ) : null}

      <MovimientosTable movimientos={movimientos} />

      {!loading && movimientos.length === 0 ? (
        <Card className="text-slate-600">
          <p className="font-semibold">Todavía no hay movimientos financieros registrados.</p>
          <p className="text-sm mt-1">Usá el formulario superior para registrar el primer ingreso, egreso o transferencia.</p>
        </Card>
      ) : null}

      <Card>
        <h3 className="text-lg font-semibold mb-2">Reportes financieros</h3>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>Flujo caja mensual: {reportes.flujo_caja_mensual.length} períodos.</li>
          <li>Gastos por categoría: {reportes.gastos_por_categoria.length} categorías.</li>
          <li>Ingresos por categoría: {reportes.ingresos_por_categoria.length} categorías.</li>
          <li>Ingresos PT por producto: {ingresosPtPorProducto.length} productos.</li>
          <li>Rentabilidad por fórmula: {reportes.rentabilidad_por_formula.length} fórmulas.</li>
          <li>Costo operativo mensual: {reportes.costo_operativo_mensual.length} períodos.</li>
          <li>Comparativa costo real/formulado: {costosComparativos.length} fórmulas.</li>
        </ul>
        <p className="text-sm text-slate-600 mt-3">
          Resumen operativo: {tesoreria.gastosPorRubro.length} rubros de gasto activos, {ingresosPtPorProducto.length} productos PT con ingresos y {tesoreria.carteraClientes.length} clientes con saldo pendiente.
        </p>
      </Card>

      {loading ? <p className="text-sm text-gray-500">Cargando finanzas…</p> : null}
    </div>
  );
};

export default FinanzasPage;
