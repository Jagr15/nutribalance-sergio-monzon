import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../../shared/components/card';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { useEstadosFinancieros } from '../hooks/useEstadosFinancieros';
import { getFlujoCajaPagina, type PeriodoFiltro } from '../utils/estadosFinancieros';
import { historicoContableService, parseHistoricoCsv, type MovimientoHistoricoImportRow } from '../services/historicoContableService';
import { ProyeccionCajaTable } from '../components/ProyeccionCajaTable';


const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: string) => formatDateDDMMYYYY(value);

const formatMetodoPago = (metodo?: string | null) => {
  if (!metodo) return '—';
  const labelMap: Record<string, string> = {
    transferencia: 'Transferencia',
    efectivo: 'Efectivo',
    cheque: 'Cheque',
    tarjeta: 'Tarjeta',
    deposito: 'Depósito',
  };
  return labelMap[metodo.toLowerCase()] ?? (metodo.charAt(0).toUpperCase() + metodo.slice(1));
};

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
  const { loading, error, data, periodo, setPeriodo, rangoCustom, setRangoCustom, refresh, movimientos, tesoreria } = useEstadosFinancieros();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importState, setImportState] = useState(historicoContableService.getState());
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<MovimientoHistoricoImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const [cashFlowPage, setCashFlowPage] = useState(1);
  const CASH_FLOW_PAGE_SIZE = 15;

  const periodoEsPersonalizado = periodo === 'RANGO';
  const rangoVisible = useMemo(() => ({
    desde: periodoEsPersonalizado ? rangoCustom.desde : getPresetRange(periodo).desde,
    hasta: periodoEsPersonalizado ? rangoCustom.hasta : getPresetRange(periodo).hasta,
  }), [periodo, periodoEsPersonalizado, rangoCustom.desde, rangoCustom.hasta]);

  useEffect(() => {
    setCashFlowPage(1);
  }, [periodo, rangoVisible.desde, rangoVisible.hasta]);

  const cashFlowTotalPages = Math.max(
    1,
    Math.ceil((data?.flujoCaja?.movimientos?.length ?? 0) / CASH_FLOW_PAGE_SIZE)
  );

  useEffect(() => {
    if (cashFlowPage > cashFlowTotalPages) {
      setCashFlowPage(cashFlowTotalPages);
    }
  }, [cashFlowPage, cashFlowTotalPages]);

  const cashFlowStartIndex = (cashFlowPage - 1) * CASH_FLOW_PAGE_SIZE;
  const cashFlowEndIndex = cashFlowStartIndex + CASH_FLOW_PAGE_SIZE;

  const flujoCajaMovimientosPaginados = useMemo(() => {
    return getFlujoCajaPagina(data?.flujoCaja?.movimientos ?? [], cashFlowPage, CASH_FLOW_PAGE_SIZE);
  }, [data?.flujoCaja?.movimientos, cashFlowPage, CASH_FLOW_PAGE_SIZE]);

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
                  {importErrors.map((item, index) => <p key={`${index}-${item}`}>{item}</p>)}
                </div>
              ) : null}
              {importPreview.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Vista previa</p>
                  {importPreview.map((row) => (
                    <div key={`${row.legacy_uid ?? ''}-${row.fecha}-${row.tipo}-${row.descripcion}-${row.monto}-${row.origen_operativo ?? ''}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
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
                  {data.estadoResultados.ingresos.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-emerald-700">{money(row.amount)}</span></div>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">Egresos</p>
                <div className="mt-2 space-y-2">
                  {data.estadoResultados.egresos.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-rose-700">{money(row.amount)}</span></div>)}
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
              <div className="mt-2 space-y-2">{data.balanceGeneral.activos.length > 0 ? data.balanceGeneral.activos.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold">{money(row.amount)}</span></div>) : <EmptyState title="Sin activos" description="No hay valores acumulados para activos en este periodo." />}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pasivos</p>
              <div className="mt-2 space-y-2">{data.balanceGeneral.pasivos.length > 0 ? data.balanceGeneral.pasivos.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold">{money(row.amount)}</span></div>) : <EmptyState title="Sin pasivos" description="No hay pasivos detectados en el periodo seleccionado." />}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Patrimonio</p>
              <div className="mt-2 space-y-2">{data.balanceGeneral.patrimonio.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-blue-700">{money(row.amount)}</span></div>)}</div>
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
              <div className="mt-2 space-y-2">{librosFiltrados.auxiliarIngresos.length > 0 ? librosFiltrados.auxiliarIngresos.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-emerald-700">{money(row.amount)}</span></div>) : <EmptyState title="Sin ingresos auxiliares" description="No hay ingresos en el periodo." />}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Auxiliar de egresos</p>
              <div className="mt-2 space-y-2">{librosFiltrados.auxiliarEgresos.length > 0 ? librosFiltrados.auxiliarEgresos.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm"><span>{row.label}</span><span className="font-semibold text-rose-700">{money(row.amount)}</span></div>) : <EmptyState title="Sin egresos auxiliares" description="No hay egresos en el periodo." />}</div>
            </div>
          </div>
        </Card>
      </section>

      <Card className="mt-6">
        <div className="flex flex-col gap-1 mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Flujo de caja operativo</h2>
          <p className="text-xs text-slate-500">
            Movimientos reales de ingresos y egresos registrados y confirmados para el periodo seleccionado.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Total ingresos</p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{money(data.flujoCaja.resumen.totalIngresos)}</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-700">Total egresos</p>
            <p className="mt-2 text-2xl font-black text-rose-800">{money(data.flujoCaja.resumen.totalEgresos)}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${
            data.flujoCaja.resumen.flujoNeto > 0 
              ? 'border-emerald-100 bg-emerald-50/50' 
              : data.flujoCaja.resumen.flujoNeto < 0 
                ? 'border-rose-100 bg-rose-50/50' 
                : 'border-slate-200 bg-slate-50/50'
          }`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${
              data.flujoCaja.resumen.flujoNeto > 0 
                ? 'text-emerald-700' 
                : data.flujoCaja.resumen.flujoNeto < 0 
                  ? 'text-rose-700' 
                  : 'text-slate-500'
            }`}>Flujo neto</p>
            <p className={`mt-2 text-2xl font-black ${
              data.flujoCaja.resumen.flujoNeto > 0 
                ? 'text-emerald-800' 
                : data.flujoCaja.resumen.flujoNeto < 0 
                  ? 'text-rose-800' 
                  : 'text-slate-700'
            }`}>{money(data.flujoCaja.resumen.flujoNeto)}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${
            data.flujoCaja.resumen.saldoFinal > 0 
              ? 'border-emerald-100 bg-emerald-50/50' 
              : data.flujoCaja.resumen.saldoFinal < 0 
                ? 'border-rose-100 bg-rose-50/50' 
                : 'border-slate-200 bg-slate-50/50'
          }`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${
              data.flujoCaja.resumen.saldoFinal > 0 
                ? 'text-emerald-700' 
                : data.flujoCaja.resumen.saldoFinal < 0 
                  ? 'text-rose-700' 
                  : 'text-slate-500'
            }`}>Saldo final</p>
            <p className={`mt-2 text-2xl font-black ${
              data.flujoCaja.resumen.saldoFinal > 0 
                ? 'text-emerald-800' 
                : data.flujoCaja.resumen.saldoFinal < 0 
                  ? 'text-rose-800' 
                  : 'text-slate-700'
            }`}>{money(data.flujoCaja.resumen.saldoFinal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Movimientos</p>
            <p className="mt-2 text-2xl font-black text-slate-800">{data.flujoCaja.resumen.cantidadMovimientos}</p>
          </div>
        </div>

        {data.flujoCaja.movimientos.length === 0 ? (
          <EmptyState 
            title="No hay movimientos de flujo de caja para el periodo seleccionado" 
            description="Carga o confirma movimientos en el rango de fechas elegido para ver el flujo de caja." 
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Concepto / Categoría</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Cliente / Proveedor</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Método de pago</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Ingreso</th>
                    <th className="px-4 py-3 text-right">Egreso</th>
                    <th className="px-4 py-3 text-right">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flujoCajaMovimientosPaginados.map((m) => {
                    const isIngreso = m.tipo === 'INGRESO';
                    return (
                      <tr 
                        key={m.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isIngreso ? 'bg-emerald-50/10' : 'bg-rose-50/10'
                        }`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-900">
                          {dateLabel(m.fecha)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isIngreso ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {isIngreso ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-800 font-medium">
                          {m.categoria}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                          {m.referencia || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 font-medium max-w-[200px] truncate">
                          {m.tercero || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 max-w-[260px] truncate" title={m.descripcion ?? undefined}>
                          {m.descripcion}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                          {formatMetodoPago(m.metodo_pago)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                          <span className={`rounded-full px-2.5 py-0.5 font-medium ${
                            m.estado === 'CONFIRMADO' 
                              ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {m.estado || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold text-emerald-600">
                          {isIngreso ? money(m.ingreso) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold text-rose-600">
                          {!isIngreso ? money(m.egreso) : '—'}
                        </td>
                        <td className={`px-4 py-3.5 text-right whitespace-nowrap font-bold ${
                          m.saldo_acumulado > 0 
                            ? 'text-emerald-700' 
                            : m.saldo_acumulado < 0 
                              ? 'text-rose-700' 
                              : 'text-slate-600'
                        }`}>
                          {money(m.saldo_acumulado)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.flujoCaja.movimientos.length > CASH_FLOW_PAGE_SIZE ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Mostrando {cashFlowStartIndex + 1}-
                  {Math.min(cashFlowEndIndex, data.flujoCaja.movimientos.length)} de{' '}
                  <strong className="text-slate-900 font-semibold">{data.flujoCaja.movimientos.length}</strong> movimientos
                </span>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    disabled={cashFlowPage <= 1}
                    onClick={() => setCashFlowPage((page) => Math.max(1, page - 1))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white transition shadow-sm"
                  >
                    Anterior
                  </button>

                  <span className="text-xs text-slate-500 font-medium">
                    Página <strong className="text-slate-900 font-semibold">{cashFlowPage}</strong> de <strong className="text-slate-900 font-semibold">{cashFlowTotalPages}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={cashFlowPage >= cashFlowTotalPages}
                    onClick={() => setCashFlowPage((page) => Math.min(cashFlowTotalPages, page + 1))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white transition shadow-sm"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {!loading && (
        <ProyeccionCajaTable
          movimientos={movimientos}
          chequesRecibidos={tesoreria.chequesRecibidos}
          chequesEmitidos={tesoreria.chequesEmitidos}
        />
      )}
    </div>
  );
};

export default EstadosFinancierosPage;
