import { Card } from '../../../shared/components/card';
import type { CostosFormulaVsReal } from '../types';

const ars = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v);

const badgeClass = (variacionPct: number) => {
  if (variacionPct < -1) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (Math.abs(variacionPct) <= 1) return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-red-200 bg-red-50 text-red-700';
};

const badgeLabel = (variacionPct: number) => {
  if (variacionPct < -1) return 'Favorable';
  if (Math.abs(variacionPct) <= 1) return 'Neutra';
  return 'Desfavorable';
};

export const CostosFormulaVsRealTable = ({ rows }: { rows: CostosFormulaVsReal[] }) => {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Variación de costo por fórmula</h3>
          <p className="text-sm text-slate-500">Comparación entre costo formulado y costo real por OP finalizada.</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{rows.length} registros</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 text-left font-semibold">Producto / Fórmula</th>
              <th className="py-3 text-right font-semibold">Costo formulado kg</th>
              <th className="py-3 text-right font-semibold">Costo real kg</th>
              <th className="py-3 text-right font-semibold">Variación %</th>
              <th className="py-3 text-left font-semibold">Última OP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.producto_formula_id || `${row.nombre_producto}-${row.version_formula ?? 'na'}-${row.ultima_op ?? 'na'}`}>
                <td className="py-3 pr-3">
                  <div className="font-semibold text-slate-900">{row.nombre_producto}</div>
                  <div className="text-xs text-slate-500">v{row.version_formula ?? 'N/D'}</div>
                </td>
                <td className="py-3 text-right text-slate-700">{ars(row.costo_formulado_kg)}</td>
                <td className="py-3 text-right text-slate-700">{ars(row.costo_real_kg)}</td>
                <td className="py-3 text-right">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(row.variacion_pct)}`}>
                    {badgeLabel(row.variacion_pct)} {row.variacion_pct.toFixed(2)}%
                  </span>
                  <div className="mt-1 text-[11px] text-slate-500">{ars(row.variacion_abs)} por kg</div>
                </td>
                <td className="py-3 text-slate-700">
                  <div className="font-mono text-xs">{row.ultima_op ?? 'Sin OP finalizada'}</div>
                  <div className="text-[11px] text-slate-500">Costo real ton: {ars(row.costo_real_ton)}</div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-slate-500" colSpan={5}>Todavía no hay fórmulas finalizadas para comparar.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
