import { useMemo, useState } from 'react';
import { FiCopy, FiDownload } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { parseNumericInput } from '../../../shared/utils/formatters';
import { calcularProyeccionCaja } from '../utils/calcularProyeccionCaja';
import { MONTH_LABELS_ES, PLAZO_CAJA_OPTIONS } from '../utils/proyeccionCaja';
import type { ChequeTesoreriaRow, MovimientoFinanciero } from '../types';

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null) => (value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`);

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);

interface ProyeccionCajaTableProps {
  movimientos: MovimientoFinanciero[];
  chequesRecibidos: ChequeTesoreriaRow[];
  chequesEmitidos: ChequeTesoreriaRow[];
}

export const ProyeccionCajaTable = ({
  movimientos,
  chequesRecibidos,
  chequesEmitidos,
}: ProyeccionCajaTableProps) => {
  const [anio, setAnio] = useState(currentYear);
  const [plazoCobranzaDias, setPlazoCobranzaDias] = useState<(typeof PLAZO_CAJA_OPTIONS)[number]>(140);
  const [plazoPagoDias, setPlazoPagoDias] = useState<(typeof PLAZO_CAJA_OPTIONS)[number]>(140);
  const [saldoInicialInput, setSaldoInicialInput] = useState('0');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const saldoInicial = parseNumericInput(saldoInicialInput) ?? 0;

  const projection = useMemo(() => calcularProyeccionCaja({
    anio,
    plazoCobranzaDias,
    plazoPagoDias,
    saldoInicialEnero: saldoInicial,
    movimientos,
    chequesRecibidos,
    chequesEmitidos,
  }), [anio, movimientos, plazoCobranzaDias, plazoPagoDias, saldoInicial, chequesEmitidos, chequesRecibidos]);

  const copyTable = async () => {
    const header = ['Concepto', ...MONTH_LABELS_ES];
    const lines = [
      header.join('\t'),
      ...projection.rows.map((row) => [
        row.label,
        ...row.values.map((val) => row.format === 'percentage' ? percent(val) : money(val ?? 0))
      ].join('\t')),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyMessage('Tabla copiada al portapapeles.');
      setTimeout(() => setCopyMessage(null), 3000);
    } catch {
      setCopyMessage('No se pudo copiar automáticamente.');
      setTimeout(() => setCopyMessage(null), 3000);
    }
  };

  const exportExcel = () => {
    void import('xlsx').then((XLSX) => {
      const matrixRows = projection.rows.map((row) => ({
        Concepto: row.label,
        ...Object.fromEntries(MONTH_LABELS_ES.map((month, index) => [
          month,
          row.format === 'percentage' ? percent(row.values[index]) : (row.values[index] ?? 0)
        ])),
      }));
      const wb = XLSX.utils.book_new();
      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Proyeccion');
      XLSX.writeFile(wb, `proyeccion-caja-${anio}.xlsx`);
    });
  };

  const getToneClass = (rowKey: string, value: number | null) => {
    if (rowKey === 'ganancia_perdida' || rowKey === 'acumulado') {
      if (value === null) return 'text-slate-700';
      return value >= 0 ? 'text-emerald-700 bg-emerald-50/70' : 'text-rose-700 bg-rose-50/70';
    }
    if (rowKey === 'ingresos') return 'text-emerald-700 font-medium';
    if (rowKey === 'gastos') return 'text-rose-700 font-medium';
    return 'text-slate-900';
  };

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Proyección de Caja</h2>
          <p className="text-sm text-slate-500">Estimación mensual basada en plazos de cobranza y pago sobre cuentas pendientes y cheques.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyTable} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            <FiCopy size={14} />
            Copiar tabla
          </button>
          <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            <FiDownload size={14} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Año de proyección</span>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm border border-slate-200">
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Plazo de Cobranza (días)</span>
          <select value={plazoCobranzaDias} onChange={(e) => setPlazoCobranzaDias(Number(e.target.value) as any)} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm border border-slate-200">
            {PLAZO_CAJA_OPTIONS.map((dias) => <option key={dias} value={dias}>{dias} días</option>)}
          </select>
        </label>
        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Plazo de Pago (días)</span>
          <select value={plazoPagoDias} onChange={(e) => setPlazoPagoDias(Number(e.target.value) as any)} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm border border-slate-200">
            {PLAZO_CAJA_OPTIONS.map((dias) => <option key={dias} value={dias}>{dias} días</option>)}
          </select>
        </label>
        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Saldo inicial de enero</span>
          <input
            type="text"
            value={saldoInicialInput}
            onChange={(e) => setSaldoInicialInput(e.target.value)}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm border border-slate-200"
            placeholder="0"
          />
        </label>
      </div>

      {copyMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800">
          {copyMessage}
        </div>
      )}

      {/* Tarjetas de Resumen Anual Proyectado */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ingresos Proyectados</p>
          <p className="mt-1.5 text-lg font-bold text-emerald-700">{money(projection.resumen.ingresos_total)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Gastos Proyectados</p>
          <p className="mt-1.5 text-lg font-bold text-rose-700">{money(projection.resumen.gastos_total)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ganancia / Pérdida</p>
          <p className={`mt-1.5 text-lg font-bold ${projection.resumen.ganancia_perdida_total >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {money(projection.resumen.ganancia_perdida_total)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Saldo Final</p>
          <p className={`mt-1.5 text-lg font-bold ${projection.resumen.saldo_final >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {money(projection.resumen.saldo_final)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rentabilidad Anual</p>
          <p className="mt-1.5 text-lg font-bold text-blue-700">{percent(projection.resumen.rentabilidad_total)}</p>
        </div>
      </div>

      {/* Excel Table */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="sticky left-0 z-30 bg-slate-900 border-r border-slate-800 px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider min-w-[160px]">
                  Flujo de Caja
                </th>
                {MONTH_LABELS_ES.map((month) => (
                  <th key={month} className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider min-w-[95px]">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {projection.rows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/40 transition-colors">
                  <th className="sticky left-0 z-20 bg-slate-50 border-r border-slate-200 px-4 py-3 text-left font-bold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {row.label}
                  </th>
                  {row.values.map((value, idx) => (
                    <td key={`${row.key}-${idx}`} className="px-3 py-3 text-center whitespace-nowrap">
                      <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${getToneClass(row.key, value)}`}>
                        {row.key === 'rentabilidad' ? percent(value) : money(value ?? 0)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
