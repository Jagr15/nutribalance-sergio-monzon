import { Card } from '../../../shared/components/card';
import type { FinanzasReportes } from '../types';

export const FlujoCharts = ({ reportes }: { reportes: FinanzasReportes }) => {
  const maxFlujo = Math.max(1, ...reportes.flujo_caja_mensual.map((r) => Math.max(r.ingresos, r.egresos)));
  const maxGastos = Math.max(1, ...reportes.gastos_por_categoria.map((r) => r.monto));
  const maxIngresosCategoria = Math.max(1, ...reportes.ingresos_por_categoria.map((r) => r.monto));
  const maxIngresosPt = Math.max(1, ...reportes.ingresos_pt_por_producto.map((r) => r.importe_total));

  const renderBarList = (
    rows: Array<{ key: string; label: string; value: number; meta?: string }>,
    colorClass: string,
    maxValue: number,
    emptyLabel: string,
  ) => {
    if (rows.length === 0) {
      return <p className="text-sm text-slate-500">{emptyLabel}</p>;
    }

    return (
      <div className="space-y-2 overflow-x-auto">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex justify-between gap-3 text-xs">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-slate-600">
                {row.meta ? `${row.meta} · ` : ''}
                {row.value.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full">
              <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${(row.value / maxValue) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

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
        {renderBarList(
          reportes.gastos_por_categoria.slice(0, 6).map((r) => ({ key: r.categoria, label: r.categoria, value: r.monto })),
          'bg-orange-500',
          maxGastos,
          'Sin gastos por categoría.',
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Ingresos por categoría</h3>
        <p className="text-xs text-slate-500 mb-3">Cobranzas y otros ingresos operativos. Las ventas de PT se muestran abajo por producto.</p>
        {renderBarList(
          reportes.ingresos_por_categoria.slice(0, 6).map((r) => ({ key: r.categoria, label: r.categoria, value: r.monto })),
          'bg-cyan-500',
          maxIngresosCategoria,
          'Sin ingresos por categoría.',
        )}

        <div className="mt-4 border-t border-slate-200/60 pt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-slate-800">Ingresos por producto terminado</h4>
            <span className="text-xs uppercase tracking-widest text-slate-500">{reportes.ingresos_pt_por_producto.length} productos</span>
          </div>
          {renderBarList(
            reportes.ingresos_pt_por_producto.slice(0, 6).map((r) => ({
              key: r.producto,
              label: r.producto,
              value: r.importe_total,
              meta: `${r.cantidad_kg.toLocaleString('es-AR')} kg`,
            })),
            'bg-indigo-500',
            maxIngresosPt,
            'Sin ventas de producto terminado.',
          )}
        </div>
      </Card>
    </section>
  );
};
