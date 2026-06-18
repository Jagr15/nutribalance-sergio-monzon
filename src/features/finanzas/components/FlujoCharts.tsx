import { Card } from '../../../shared/components/card';
import type { FinanzasReportes } from '../types';

export const FlujoCharts = ({ reportes }: { reportes: FinanzasReportes }) => {
  const maxFlujo = Math.max(1, ...reportes.flujo_caja_mensual.map((r) => Math.max(r.ingresos, r.egresos)));

  return (
    <section className="grid grid-cols-1 gap-4">
      <Card>
        <h3 className="font-semibold mb-3">Flujo de caja mensual</h3>
        {reportes.flujo_caja_mensual.length === 0 ? <p className="text-sm text-slate-500">Sin datos de flujo mensual.</p> : null}
        <div className="space-y-3 overflow-x-auto">
          {reportes.flujo_caja_mensual.slice(-6).map((r) => (
            <div key={r.mes} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <span className="font-medium text-slate-900">{r.mes}</span>
                <span>Neto {r.neto.toLocaleString('es-AR')}</span>
              </div>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${(r.ingresos / maxFlujo) * 100}%` }} />
              </div>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-2 bg-red-500 rounded-full" style={{ width: `${(r.egresos / maxFlujo) * 100}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                <span>Ingresos {r.ingresos.toLocaleString('es-AR')}</span>
                <span>Egresos {r.egresos.toLocaleString('es-AR')}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
};
