import { Card } from '../../../shared/components/card';
import type { FinanzasReportes } from '../types';

export const FlujoCharts = ({ reportes }: { reportes: FinanzasReportes }) => {
  const maxFlujo = Math.max(1, ...reportes.flujo_caja_mensual.map((r) => Math.max(r.ingresos, r.egresos)));
  const maxCat = Math.max(1, ...reportes.gastos_por_categoria.map((r) => r.monto), ...reportes.ingresos_por_categoria.map((r) => r.monto));

  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card>
        <h3 className="font-semibold mb-3">Flujo de caja mensual</h3>
        {reportes.flujo_caja_mensual.length === 0 ? <p className="text-sm text-slate-500">Sin datos de flujo mensual.</p> : null}
        <div className="space-y-2 overflow-x-auto">
          {reportes.flujo_caja_mensual.slice(-6).map((r) => (
            <div key={r.mes}>
              <p className="text-xs text-gray-400 mb-1">{r.mes}</p>
              <div className="h-2 bg-white/10 rounded-full mb-1"><div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${(r.ingresos / maxFlujo) * 100}%` }} /></div>
              <div className="h-2 bg-white/10 rounded-full"><div className="h-2 bg-red-500 rounded-full" style={{ width: `${(r.egresos / maxFlujo) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Gastos por categoría</h3>
        {reportes.gastos_por_categoria.length === 0 ? <p className="text-sm text-slate-500">Sin gastos por categoría.</p> : null}
        <div className="space-y-2 overflow-x-auto">
          {reportes.gastos_por_categoria.slice(0, 6).map((r) => (
            <div key={r.categoria}><div className="flex justify-between text-xs"><span>{r.categoria}</span><span>{r.monto.toLocaleString('es-AR')}</span></div><div className="h-2 bg-white/10 rounded-full"><div className="h-2 bg-orange-500 rounded-full" style={{ width: `${(r.monto / maxCat) * 100}%` }} /></div></div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Ingresos por categoría</h3>
        {reportes.ingresos_por_categoria.length === 0 ? <p className="text-sm text-slate-500">Sin ingresos por categoría.</p> : null}
        <div className="space-y-2 overflow-x-auto">
          {reportes.ingresos_por_categoria.slice(0, 6).map((r) => (
            <div key={r.categoria}><div className="flex justify-between text-xs"><span>{r.categoria}</span><span>{r.monto.toLocaleString('es-AR')}</span></div><div className="h-2 bg-white/10 rounded-full"><div className="h-2 bg-cyan-500 rounded-full" style={{ width: `${(r.monto / maxCat) * 100}%` }} /></div></div>
          ))}
        </div>
      </Card>
    </section>
  );
};
