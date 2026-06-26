import { useMemo, useRef, useState } from 'react';
import { Card } from '../../../shared/components/card';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { useEstadosFinancieros } from '../hooks/useEstadosFinancieros';
import type { PeriodoFiltro } from '../utils/estadosFinancieros';
import { historicoContableService, parseHistoricoCsv, type MovimientoHistoricoImportRow } from '../services/historicoContableService';

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: string) => formatDateDDMMYYYY(value);

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);
const endOfToday = (date: Date) => toDateInputValue(date);

const getPresetRange = (periodo: PeriodoFiltro) => {
  const today = new Date();
  if (periodo === 'MES_ACTUAL') return { desde: toDateInputValue(startOfMonth(today)), hasta: endOfToday(today) };
  if (periodo === 'TRIMESTRE_ACTUAL') return { desde: toDateInputValue(startOfQuarter(today)), hasta: endOfToday(today) };
  if (periodo === 'ANIO_ACTUAL') return { desde: toDateInputValue(startOfYear(today)), hasta: endOfToday(today) };
  return { desde: '', hasta: '' };
};

const DEMO_PATTERN = /prueba|test|demo|www|tttt/i;
const isDemoText = (value?: string | null) => Boolean(value && DEMO_PATTERN.test(value));

const PeriodoSelect = ({ value, onChange }: { value: PeriodoFiltro; onChange: (value: PeriodoFiltro) => void }) => (
  <select className="ui-input rounded-2xl px-4 py-3 text-sm" value={value} onChange={(event) => onChange(event.target.value as PeriodoFiltro)}>
    <option value="MES_ACTUAL">Mes actual</option>
    <option value="TRIMESTRE_ACTUAL">Trimestre actual</option>
    <option value="ANIO_ACTUAL">Año actual</option>
    <option value="TODO">Todo el histórico</option>
    <option value="RANGO">Rango personalizado</option>
  </select>
);

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
    <p className="font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{description}</p>
  </div>
);

const EstadosFinancierosPage = () => {
  const { loading, error, data, periodo, setPeriodo, rangoCustom, setRangoCustom, refresh } = useEstadosFinancieros();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importState, setImportState] = useState(historicoContableService.getState());
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<MovimientoHistoricoImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const periodoEsPersonalizado = periodo === 'RANGO';
  const rangoVisible = useMemo(() => ({
    desde: periodoEsPersonalizado ? rangoCustom.desde : getPresetRange(periodo).desde,
    hasta: periodoEsPersonalizado ? rangoCustom.hasta : getPresetRange(periodo).hasta,
  }), [periodo, periodoEsPersonalizado, rangoCustom.desde, rangoCustom.hasta]);
  const showInitialLoadSection = import.meta.env.VITE_SHOW_HISTORICO_LOAD === 'true';

  const librosFiltrados = useMemo(() => ({
    libroMayor: data.libros.libroMayor.filter((row) => !isDemoText(row.cuenta) && !isDemoText(row.descripcion)),
    auxiliarIngresos: data.libros.auxiliarIngresos.filter((row) => !isDemoText(row.label)),
    auxiliarEgresos: data.libros.auxiliarEgresos.filter((row) => !isDemoText(row.label)),
  }), [data.libros.auxiliarEgresos, data.libros.auxiliarIngresos, data.libros.libroMayor]);

  const rangoInvalido = Boolean(rangoVisible.desde && rangoVisible.hasta && rangoVisible.desde > rangoVisible.hasta);

  const hasData =
    data.estadoResultados.ingresos.length > 0 ||
    data.estadoResultados.egresos.length > 0 ||
    data.balanceGeneral.activos.length > 0 ||
    data.balanceGeneral.pasivos.length > 0 ||
    data.libros.libroMayor.length > 0;

  const handlePeriodoChange = (next: PeriodoFiltro) => {
    setPeriodo(next);
    if (next === 'RANGO') return;
    if (next === 'TODO') {
      setRangoCustom({ desde: '', hasta: '' });
      return;
    }
    setRangoCustom(getPresetRange(next));
  };

  const handleDesdeChange = (value: string) => {
    setPeriodo('RANGO');
    setRangoCustom((current) => ({ ...current, desde: value }));
  };

  const handleHastaChange = (value: string) => {
    setPeriodo('RANGO');
    setRangoCustom((current) => ({ ...current, hasta: value }));
  };

  const runValidation = (rows: MovimientoHistoricoImportRow[]) => {
    const result = historicoContableService.validate(rows);
    setImportState(result.estado);
    setImportErrors(result.errores);
    setImportMessage(result.errores.length > 0 ? 'Hay errores en la carga inicial.' : `Validado: ${result.total} movimientos.`);
    setImportPreview(rows.slice(0, 10));
    return result;
  };

  const handleCsvText = (value: string) => {
    setCsvText(value);
    setImportMessage(null);
    setImportErrors([]);
    setImportPreview([]);
  };

  const handlePreview = () => {
    const rows = parseHistoricoCsv(csvText);
    runValidation(rows);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const rows = parseHistoricoCsv(text);
    runValidation(rows);
  };

  const handleImport = async () => {
    setImportLoading(true);
    setImportMessage(null);
    setImportErrors([]);
    try {
      const rows = parseHistoricoCsv(csvText);
      const result = await historicoContableService.importRows(rows);
      setImportState(result.estado);
      setImportErrors(result.errores);
      setImportMessage(result.errores.length > 0 ? 'La importación quedó con errores.' : `Importados ${result.importados} movimientos históricos.`);
      if (result.errores.length === 0) {
        await refresh();
      }
    } catch (err: unknown) {
      setImportState('errores');
      setImportMessage(err instanceof Error ? err.message : 'No se pudo importar el histórico.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200">Contabilidad</p>
        <h1 className="mt-2 text-3xl font-semibold">Estados financieros</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Estados de resultados, balance general y auxiliares generados desde movimientos reales, con lectura directa y sin Excel.</p>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold">Estados operativos calculados desde movimientos confirmados y saldos existentes.</p>
        <p className="mt-1 text-amber-800">Estimado por falta de catálogo contable formal.</p>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Periodo</span>
            <PeriodoSelect value={periodo} onChange={handlePeriodoChange} />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Desde</span>
            <input type="date" className="ui-input rounded-2xl px-4 py-3 text-sm" value={rangoVisible.desde} onChange={(event) => handleDesdeChange(event.target.value)} />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Hasta</span>
            <input type="date" className="ui-input rounded-2xl px-4 py-3 text-sm" value={rangoVisible.hasta} onChange={(event) => handleHastaChange(event.target.value)} />
          </label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Movimientos</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? '...' : data.libros.libroMayor.length}</p>
          </div>
        </div>
        {rangoInvalido ? (
          <p className="mt-3 text-sm font-medium text-rose-700">El rango de fechas no es válido: la fecha "Desde" no puede ser mayor que "Hasta".</p>
        ) : null}
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando estados financieros...</p>
        </Card>
      ) : null}

      {showInitialLoadSection ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Carga inicial de históricos</h2>
              <p className="mt-1 text-sm text-slate-500">Pegá un CSV simple o cargá un archivo con columnas: `fecha,tipo,descripcion,monto,origen_operativo,legacy_uid`.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">{importState}</div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <div className="space-y-3">
              <textarea
                className="ui-input min-h-[180px] w-full rounded-2xl px-4 py-3 text-sm"
                placeholder="fecha,tipo,descripcion,monto,origen_operativo,legacy_uid\n2026-01-01,INGRESO,Venta inicial,1000,VENTA_PT,hist-001"
                value={csvText}
                onChange={(event) => handleCsvText(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={handlePreview}>Validar CSV</button>
                <button type="button" className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60" onClick={handleImport} disabled={importLoading || csvText.trim().length === 0}>{importLoading ? 'Importando...' : 'Importar histórico'}</button>
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => fileRef.current?.click()}>Cargar CSV</button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
              </div>
              <p className="text-xs text-slate-500">Si falta `legacy_uid`, se genera una clave estable para evitar duplicados. Los campos vacíos invalidan la fila antes de importar.</p>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Estado de la carga</p>
              <p className="text-sm text-slate-600">{importMessage ?? 'Pendiente de validación.'}</p>
              {importErrors.length > 0 ? (
                <div className="max-h-44 overflow-auto rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {importErrors.map((item) => <p key={item}>{item}</p>)}
                </div>
              ) : null}
              {importPreview.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Vista previa</p>
                  {importPreview.map((row) => (
                    <div key={`${row.legacy_uid ?? row.fecha}-${row.descripcion}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                      <p className="font-semibold text-slate-900">{row.descripcion}</p>
                      <p className="text-slate-500">{row.fecha} · {row.tipo} · {row.origen_operativo} · {row.monto}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && !hasData ? (
        <Card>
          <EmptyState title="No hay información contable para este periodo" description="Cargá movimientos confirmados para ver estados financieros automáticos." />
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold">Estado de resultados</h2>
          <p className="mt-1 text-xs text-slate-500">Fuente: movimientos confirmados del período seleccionado.</p>
          {data.estadoResultados.ingresos.length === 0 && data.estadoResultados.egresos.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Sin resultados" description="No hay ingresos ni egresos en el periodo seleccionado." />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Ingresos</p>
                <div className="mt-2 space-y-2">
                  {data.estadoResultados.ingresos.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-emerald-700">{money(row.amount)}</span></div>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Egresos</p>
                <div className="mt-2 space-y-2">
                  {data.estadoResultados.egresos.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-rose-700">{money(row.amount)}</span></div>)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Utilidad neta</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{money(data.estadoResultados.utilidadNeta)}</p>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Balance general</h2>
          <p className="mt-1 text-xs text-slate-500">Fuente: saldos actuales, cuentas por cobrar, inventario y tesorería operativa.</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Activos</p>
              <div className="mt-2 space-y-2">{data.balanceGeneral.activos.length > 0 ? data.balanceGeneral.activos.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold">{money(row.amount)}</span></div>) : <EmptyState title="Sin activos" description="No hay valores acumulados para activos en este periodo." />}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pasivos</p>
              <div className="mt-2 space-y-2">{data.balanceGeneral.pasivos.length > 0 ? data.balanceGeneral.pasivos.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold">{money(row.amount)}</span></div>) : <EmptyState title="Sin pasivos" description="No hay pasivos detectados en el periodo seleccionado." />}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Patrimonio</p>
              <div className="mt-2 space-y-2">{data.balanceGeneral.patrimonio.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-blue-700">{money(row.amount)}</span></div>)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Libros y auxiliares</h2>
          <p className="mt-1 text-xs text-slate-500">Fuente: libro mayor operativo y auxiliares derivados de los movimientos registrados.</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Libro mayor</p>
              <div className="mt-2 space-y-2 max-h-72 overflow-auto pr-1">
                {librosFiltrados.libroMayor.length > 0 ? librosFiltrados.libroMayor.slice(0, 12).map((row) => <div key={`${row.fecha}-${row.descripcion}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{row.cuenta}</span><span>{dateLabel(row.fecha)}</span></div><p className="mt-1 text-slate-700">{row.descripcion}</p><div className="mt-2 flex items-center justify-between"><span>Débito {money(row.debito)}</span><span>Crédito {money(row.credito)}</span></div></div>) : <EmptyState title="Sin libro mayor" description="No hay movimientos confirmados para mostrar." />}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Auxiliar de ingresos</p>
              <div className="mt-2 space-y-2">{librosFiltrados.auxiliarIngresos.length > 0 ? librosFiltrados.auxiliarIngresos.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-emerald-700">{money(row.amount)}</span></div>) : <EmptyState title="Sin ingresos auxiliares" description="No hay ingresos en el periodo." />}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Auxiliar de egresos</p>
              <div className="mt-2 space-y-2">{librosFiltrados.auxiliarEgresos.length > 0 ? librosFiltrados.auxiliarEgresos.map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-rose-700">{money(row.amount)}</span></div>) : <EmptyState title="Sin egresos auxiliares" description="No hay egresos en el periodo." />}</div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default EstadosFinancierosPage;
