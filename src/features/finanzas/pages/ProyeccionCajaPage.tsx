import { useMemo, useState } from 'react';
import { FiArrowLeft, FiCopy, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../shared/components/card';
import { parseNumericInput } from '../../../shared/utils/formatters';
import { ROUTES } from '../../../app/config/routes';
import { useFinanzas } from '../hooks/useFinanzas';
import { buildProyeccionCaja, MONTH_LABELS_ES, PLAZO_CAJA_OPTIONS, type ProyeccionCajaRow } from '../utils/proyeccionCaja';
import type { TipoMovimientoFinanciero } from '../types';

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null) => (value === null ? '-' : `${(value * 100).toFixed(1)}%`);

const currentYear = new Date().getFullYear();

const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);

const uniqueSorted = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const formatCell = (row: ProyeccionCajaRow, value: number | null) => {
  if (row.format === 'percentage') return percent(value);
  return money(value ?? 0);
};

const getToneClass = (row: ProyeccionCajaRow, value: number | null) => {
  if (row.key === 'ganancia_perdida') {
    if (value === null) return 'text-slate-700';
    return value >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  }
  if (row.key === 'acumulado') {
    if (value === null) return 'text-slate-700';
    return value >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  }
  if (row.key === 'ingresos') return 'text-emerald-700';
  if (row.key === 'gastos') return 'text-rose-700';
  return 'text-slate-900';
};

const ProyeccionCajaPage = () => {
  const navigate = useNavigate();
  const { movimientos, tesoreria, loading, refresh } = useFinanzas();
  const [anio, setAnio] = useState(currentYear);
  const [plazoCobranzaDias, setPlazoCobranzaDias] = useState<(typeof PLAZO_CAJA_OPTIONS)[number]>(140);
  const [plazoPagoDias, setPlazoPagoDias] = useState<(typeof PLAZO_CAJA_OPTIONS)[number]>(140);
  const [cliente, setCliente] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoFinanciero | ''>('');
  const [saldoInicialInput, setSaldoInicialInput] = useState('0');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const clientOptions = useMemo(() => uniqueSorted([
    ...tesoreria.carteraClientes.map((row) => row.cliente_nombre),
    ...tesoreria.chequesRecibidos.map((row) => row.cliente_nombre ?? row.tercero),
  ]), [tesoreria.carteraClientes, tesoreria.chequesRecibidos]);

  const providerOptions = useMemo(() => uniqueSorted([
    ...tesoreria.chequesEmitidos.map((row) => row.tercero),
  ]), [tesoreria.chequesEmitidos]);

  const saldoInicial = parseNumericInput(saldoInicialInput) ?? 0;

  const projection = useMemo(() => buildProyeccionCaja({
    anio,
    plazoCobranzaDias,
    plazoPagoDias,
    saldoInicialEnero: saldoInicial,
    cliente: cliente || undefined,
    proveedor: proveedor || undefined,
    tipoMovimiento,
    movimientos,
    chequesRecibidos: tesoreria.chequesRecibidos,
    chequesEmitidos: tesoreria.chequesEmitidos,
  }), [anio, cliente, movimientos, plazoCobranzaDias, plazoPagoDias, proveedor, saldoInicial, tesoreria.chequesEmitidos, tesoreria.chequesRecibidos, tipoMovimiento]);

  const copyTable = async () => {
    const header = ['Concepto', ...MONTH_LABELS_ES];
    const lines = [
      header.join('\t'),
      ...projection.rows.map((row) => [row.label, ...row.values.map((value) => formatCell(row, value)).map((value) => String(value))].join('\t')),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyMessage('Tabla copiada al portapapeles.');
    } catch {
      setCopyMessage('No se pudo copiar automáticamente, pero sí puedes exportar a Excel.');
    }
  };

  const exportExcel = () => {
    void import('xlsx').then((XLSX) => {
      const matrixRows = projection.rows.map((row) => ({
        Concepto: row.label,
        ...Object.fromEntries(MONTH_LABELS_ES.map((month, index) => [month, row.format === 'percentage' ? percent(row.values[index] ?? null) : (row.values[index] ?? 0)])),
      }));
      const detailRows = projection.items.map((item) => ({
        Fecha_base: item.fecha_base,
        Plazo_aplicado_dias: item.plazo_aplicado_dias,
        Fecha_proyectada: item.fecha_proyectada,
        Mes_proyectado: item.mes_proyectado,
        Tipo: item.tipo,
        Fuente: item.fuente,
        Descripcion: item.descripcion,
        Cliente: item.cliente_nombre ?? '',
        Proveedor: item.proveedor_nombre ?? '',
        Categoria: item.categoria ?? '',
        Monto: item.monto,
      }));
      const wb = XLSX.utils.book_new();
      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Proyeccion');
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle');
      XLSX.writeFile(wb, `proyeccion-caja-${anio}.xlsx`);
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-200">Finanzas</p>
        <h1 className="mt-2 text-3xl font-semibold">Proyección de Caja</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">
          Vista mensual para anticipar cobranzas y pagos con plazos configurables. Los importes originales no se modifican: esta pantalla solo proyecta el flujo futuro.
        </p>
      </section>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filtros de proyección</h2>
            <p className="text-sm text-slate-500">Los meses sin datos muestran $0 y la rentabilidad queda en blanco cuando no hay ingresos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <FiRefreshCw size={14} />
              Actualizar
            </button>
            <button type="button" onClick={copyTable} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <FiCopy size={14} />
              Copiar tabla
            </button>
            <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              <FiDownload size={14} />
              Exportar Excel
            </button>
            <button type="button" onClick={() => navigate(ROUTES.COSTOS)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <FiArrowLeft size={14} />
              Volver a Finanzas
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Año</span>
            <select value={anio} onChange={(event) => setAnio(Number(event.target.value))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Plazo cobranza</span>
            <select value={plazoCobranzaDias} onChange={(event) => setPlazoCobranzaDias(Number(event.target.value) as (typeof PLAZO_CAJA_OPTIONS)[number])} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              {PLAZO_CAJA_OPTIONS.map((dias) => <option key={dias} value={dias}>{dias} días</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Afecta solo ingresos y cuentas por cobrar.</p>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Plazo pago</span>
            <select value={plazoPagoDias} onChange={(event) => setPlazoPagoDias(Number(event.target.value) as (typeof PLAZO_CAJA_OPTIONS)[number])} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              {PLAZO_CAJA_OPTIONS.map((dias) => <option key={dias} value={dias}>{dias} días</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Afecta solo gastos y cuentas por pagar.</p>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cliente</span>
            <select value={cliente} onChange={(event) => setCliente(event.target.value)} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              <option value="">Todos</option>
              {clientOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Proveedor</span>
            <select value={proveedor} onChange={(event) => setProveedor(event.target.value)} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              <option value="">Todos</option>
              {providerOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo de movimiento</span>
            <select value={tipoMovimiento} onChange={(event) => setTipoMovimiento(event.target.value as TipoMovimientoFinanciero | '')} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              <option value="">Todos</option>
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
            </select>
          </label>
          <label className="block md:col-span-2 xl:col-span-6">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Saldo inicial de enero</span>
            <input
              type="text"
              value={saldoInicialInput}
              onChange={(event) => setSaldoInicialInput(event.target.value)}
              className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
              placeholder="0"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">La proyección no modifica movimientos reales. Solo estima el flujo según los plazos seleccionados.</p>
          <p className="mt-1 text-blue-800">Los filtros se aplican en tiempo real y recalculan la matriz mensual al instante.</p>
        </div>

        {copyMessage ? <p className="text-sm text-slate-500">{copyMessage}</p> : null}
        <p className="text-xs text-slate-500">
          La proyección usa registros pendientes, cheques vigentes y los plazos seleccionados. Si un ingreso no tiene monto, fecha o contraparte suficiente, se omite de la estimación.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Ingresos proyectados</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{money(projection.resumen.ingresos_total)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Gastos proyectados</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{money(projection.resumen.gastos_total)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Ganancia / Pérdida</p>
          <p className={`mt-2 text-3xl font-semibold ${projection.resumen.ganancia_perdida_total >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {money(projection.resumen.ganancia_perdida_total)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Saldo final</p>
          <p className={`mt-2 text-3xl font-semibold ${projection.resumen.saldo_final >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {money(projection.resumen.saldo_final)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Rentabilidad anual</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">{percent(projection.resumen.rentabilidad_total)}</p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Matriz mensual</h3>
          <p className="mt-1 text-sm text-slate-500">Los colores verde y rojo resaltan ganancia, pérdida y saldo acumulado. La estructura sigue el formato de una hoja Excel.</p>
        </div>
        <div className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            Los importes se muestran en el mes estimado de cobro o pago. Por ejemplo, un movimiento de julio con plazo de 140 a 160 días puede proyectarse en noviembre o diciembre.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Concepto</th>
                {projection.meses.map((month) => (
                  <th key={month} className="border-b border-slate-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projection.rows.map((row) => (
                <tr key={row.key} className={row.key === 'ganancia_perdida' || row.key === 'acumulado' ? 'bg-slate-50/60' : 'bg-white'}>
                  <th className="border-b border-slate-100 px-4 py-3 text-left font-semibold text-slate-900">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={`${row.key}-${projection.meses[index]}`} className="border-b border-slate-100 px-4 py-3 text-center">
                      <span className={`inline-flex min-w-[110px] justify-center rounded-xl px-3 py-2 font-semibold ${getToneClass(row, value)}`}>
                        {row.key === 'rentabilidad' ? percent(value) : formatCell(row, value)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="text-slate-600">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Plazo cobranza</p>
            <p className="mt-1 text-sm text-slate-600">Suma estos días a la fecha base del ingreso para ubicarlo en el mes proyectado.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Plazo pago</p>
            <p className="mt-1 text-sm text-slate-600">Suma estos días a la fecha base del gasto para ubicarlo en el mes proyectado.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Meses vacíos</p>
            <p className="mt-1 text-sm text-slate-600">Si no hay datos, la celda queda en $0 para evitar ambigüedad visual.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Exportación</p>
            <p className="mt-1 text-sm text-slate-600">La matriz puede copiarse al portapapeles o descargarse como Excel con detalle.</p>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando datos financieros para proyectar caja...</p>
        </Card>
      ) : null}
    </div>
  );
};

export default ProyeccionCajaPage;
