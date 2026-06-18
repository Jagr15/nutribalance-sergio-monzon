import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { FiX, FiGitMerge } from 'react-icons/fi';
import type { Formula } from '../types';
import { compareFormulas } from '../utils/formulaComparison';

interface Props {
  formulas: Formula[];
  onClose: () => void;
}

const money = (value: number | null) => (typeof value === 'number' ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value) : 'Sin costo');

const pct = (value: number | null, decimals = 2) => (typeof value === 'number' ? `${value.toFixed(decimals)}%` : 'Sin dato');

const kg = (value: number | null) => (typeof value === 'number' ? value.toFixed(1) : 'Sin dato');

const FormulaComparisonModal = ({ formulas, onClose }: Props) => {
  const defaultA = formulas[0]?.uid ?? '';
  const defaultB = formulas[1]?.uid ?? formulas[0]?.uid ?? '';
  const [formulaAId, setFormulaAId] = useState(() => defaultA);
  const [formulaBId, setFormulaBId] = useState(() => defaultB);

  const formulaA = useMemo(() => formulas.find((formula) => formula.uid === formulaAId) ?? formulas[0], [formulaAId, formulas]);
  const formulaB = useMemo(() => formulas.find((formula) => formula.uid === formulaBId) ?? formulas[1] ?? formulas[0], [formulaBId, formulas]);

  const comparison = useMemo(() => (formulaA && formulaB ? compareFormulas(formulaA, formulaB) : null), [formulaA, formulaB]);

  const isValidSelection = Boolean(formulaA && formulaB) && formulaA.uid !== formulaB.uid;

  const modal = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
              <FiGitMerge size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Comparar fórmulas</h3>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Costos, proteína y composición</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <FiX size={18} />
          </button>
        </header>

        <div className="grid gap-4 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Fórmula A</span>
              <select
                value={formulaAId}
                onChange={(event) => setFormulaAId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                {formulas.map((formula) => (
                  <option key={formula.uid} value={formula.uid}>
                    {formula.nombre_producto} v{formula.version}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Fórmula B</span>
                <select
                  value={formulaBId}
                  onChange={(event) => setFormulaBId(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
                >
                {formulas.map((formula) => (
                  <option key={formula.uid} value={formula.uid}>
                    {formula.nombre_producto} v{formula.version}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!isValidSelection ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Seleccioná dos fórmulas distintas para ver la comparación.
            </div>
          ) : null}

          {comparison && isValidSelection ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fórmula A</p>
                  <h4 className="mt-2 text-lg font-semibold text-slate-900">{comparison.formulaA.nombre_producto}</h4>
                  <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Versión</dt><dd>{comparison.formulaA.version}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Proteína fórmula</dt><dd>{pct(comparison.formulaA.proteina_formula)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">PB g/kg</dt><dd>{kg(comparison.formulaA.pb_g_kg)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/kg</dt><dd>{money(comparison.formulaA.costo_por_kg)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/ton</dt><dd>{money(comparison.formulaA.costo_por_tonelada)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Total ingredientes %</dt><dd>{pct(comparison.formulaA.total_ingredientes_pct)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Cantidad ingredientes</dt><dd>{comparison.formulaA.cantidad_ingredientes}</dd></div>
                  </dl>
                </section>

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">Diferencias B - A</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-800">
                    <div className="rounded-xl bg-white px-4 py-3 border border-blue-100">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Costo/kg</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{money(comparison.diferencias.costo_por_kg)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 border border-blue-100">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Costo/ton</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{money(comparison.diferencias.costo_por_tonelada)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 border border-blue-100">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Proteína %</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{pct(comparison.diferencias.proteina_formula)}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fórmula B</p>
                  <h4 className="mt-2 text-lg font-semibold text-slate-900">{comparison.formulaB.nombre_producto}</h4>
                  <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Versión</dt><dd>{comparison.formulaB.version}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Proteína fórmula</dt><dd>{pct(comparison.formulaB.proteina_formula)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">PB g/kg</dt><dd>{kg(comparison.formulaB.pb_g_kg)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/kg</dt><dd>{money(comparison.formulaB.costo_por_kg)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/ton</dt><dd>{money(comparison.formulaB.costo_por_tonelada)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Total ingredientes %</dt><dd>{pct(comparison.formulaB.total_ingredientes_pct)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Cantidad ingredientes</dt><dd>{comparison.formulaB.cantidad_ingredientes}</dd></div>
                  </dl>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h4 className="text-sm font-semibold text-slate-900">Comparación de ingredientes</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[960px] w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left">Insumo</th>
                        <th className="px-4 py-3 text-right">% Fórmula A</th>
                        <th className="px-4 py-3 text-right">% Fórmula B</th>
                        <th className="px-4 py-3 text-right">Diferencia %</th>
                        <th className="px-4 py-3 text-right">Costo A</th>
                        <th className="px-4 py-3 text-right">Costo B</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparison.ingredientes.map((row) => (
                        <tr key={row.id_insumo} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{row.nombre_insumo}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{pct(row.porcentaje_a)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{pct(row.porcentaje_b)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${row.diferencia_pct > 0 ? 'text-emerald-700' : row.diferencia_pct < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                            {pct(row.diferencia_pct)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{money(row.costo_estimado_a_kg)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{money(row.costo_estimado_b_kg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default FormulaComparisonModal;
