import { useMemo, useState } from 'react';
import { Card } from '../../../shared/components/card';
import { useFinanzas } from '../hooks/useFinanzas';
import { FlujoCharts } from '../components/FlujoCharts';
import { KpiGrid } from '../components/KpiGrid';
import { MovimientosTable } from '../components/MovimientosTable';
import { RegistrarMovimientoForm } from '../components/RegistrarMovimientoForm';
import { CostosFormulaVsRealTable } from '../components/CostosFormulaVsRealTable';
import { usePermissions } from '../../auth/usePermissions';

const PAGE_NOW = new Date().getTime();

const FinanzasPage = () => {
  const { kpis, reportes, tesoreria, movimientos, costosComparativos, inventario, loading, loadError, infoMessage, refresh, createMovimiento } = useFinanzas();
  const { canAccess } = usePermissions();
  const [variacionesSort, setVariacionesSort] = useState<'desviacion' | 'menor_desviacion' | 'mayor_gasto' | 'menor_gasto'>('desviacion');
  const hasKpis = Object.values(kpis).some((v) => Number(v) !== 0);
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
    tesoreria.chequesRecibidos.length > 0;
  const categoriasTotales = new Set([
    ...reportes.gastos_por_categoria.map((r) => r.categoria),
    ...reportes.ingresos_por_categoria.map((r) => r.categoria),
  ]).size;
  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  const formatPct = (value: number) => `${value.toFixed(1)}%`;
  const variacionesOrdenadas = useMemo(
    () => [...tesoreria.variacionesPorRubro].sort((a, b) => {
      if (variacionesSort === 'desviacion') return Math.abs(b.variacion_pct) - Math.abs(a.variacion_pct);
      if (variacionesSort === 'menor_desviacion') return Math.abs(a.variacion_pct) - Math.abs(b.variacion_pct);
      if (variacionesSort === 'mayor_gasto') return b.real - a.real;
      return a.real - b.real;
    }),
    [tesoreria.variacionesPorRubro, variacionesSort],
  );
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

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Flujo de Caja Operativo</p>
        <h1 className="text-3xl font-bold mt-2">Finanzas</h1>
        <p className="text-gray-400 mt-2">Módulo financiero conectado a operación real (compras MP, producción, stock, ventas y merma).</p>
      </section>

      {loadError ? (
        <Card className="border-red-200 bg-red-50 text-red-700">
          No pudimos cargar la información financiera
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
            onSubmit={async (payload) => {
              await createMovimiento(payload);
              await refresh();
            }}
          />
        </Card>
      ) : null}

      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-slate-100 border-slate-200">
              <div />
            </Card>
          ))}
        </section>
      ) : (
        <KpiGrid kpis={kpis} />
      )}

      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`inv-skel-${i}`} className="h-24 animate-pulse bg-slate-100 border-slate-200">
              <div />
            </Card>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Valor stock MP</p>
            <p className="text-3xl font-black mt-2 text-emerald-300">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(inventario.valor_stock_mp)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Valor stock PT</p>
            <p className="text-3xl font-black mt-2 text-cyan-300">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(inventario.valor_stock_pt)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Valor inventario total</p>
            <p className="text-3xl font-black mt-2 text-fuchsia-300">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(inventario.valor_inventario_total)}
            </p>
          </Card>
        </section>
      )}

      {!loading && !hasKpis ? (
        <Card className="text-slate-600">
          <p className="font-semibold">Sin KPIs financieros disponibles.</p>
        </Card>
      ) : null}

      <FlujoCharts reportes={reportes} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Presupuesto vs Real</h3>
              <p className="text-sm text-slate-500">Desviación por rubro con presupuesto generado cuando faltan datos.</p>
            </div>
            {tesoreria.presupuestoVsReal.some((row) => row.generado) ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                Presupuesto estimado
              </span>
            ) : null}
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
                {tesoreria.presupuestoVsReal.map((row) => (
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
                  </tr>
                ))}
                {tesoreria.presupuestoVsReal.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">Sin datos de presupuesto.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-2">
            {tesoreria.presupuestoVsReal.map((row) => (
              <div key={`bar-${row.rubro}`}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{row.rubro}</span>
                  <span>{formatCurrency(row.presupuesto)} vs {formatCurrency(row.real)}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-2 rounded-full bg-slate-400" style={{ width: `${Math.min(100, (row.presupuesto / Math.max(1, row.real, row.presupuesto)) * 100)}%` }} /></div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, (row.real / Math.max(1, row.real, row.presupuesto)) * 100)}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Distribución de gastos</h3>
          {tesoreria.gastosPorRubro.length === 0 ? <p className="text-sm text-slate-500">Sin gastos registrados.</p> : null}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-center">
            <div className="mx-auto h-52 w-52 rounded-full border border-slate-200 shadow-inner" style={{
              background: tesoreria.gastosPorRubro.length === 0
                ? 'conic-gradient(#cbd5e1 0% 100%)'
                : `conic-gradient(${tesoreria.gastosPorRubro.map((row, index) => {
                  const colors = ['#2563eb', '#0f766e', '#ea580c', '#7c3aed', '#d97706', '#db2777', '#64748b'];
                  const start = tesoreria.gastosPorRubro.slice(0, index).reduce((acc, item) => acc + item.porcentaje, 0);
                  const end = start + row.porcentaje;
                  return `${colors[index % colors.length]} ${start}% ${end}%`;
                }).join(', ')})`,
            }} />
            <div className="space-y-3">
              {tesoreria.gastosPorRubro.map((row, index) => (
                <div key={row.rubro} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">{row.rubro}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(row.monto)} · {formatPct(row.porcentaje)}</p>
                  </div>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ['#2563eb', '#0f766e', '#ea580c', '#7c3aed', '#d97706', '#db2777', '#64748b'][index % 7] }} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
              <option value="desviacion">Mayor desviación</option>
              <option value="menor_desviacion">Menor desviación</option>
              <option value="mayor_gasto">Mayor gasto</option>
              <option value="menor_gasto">Menor gasto</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 text-left font-semibold">Rubro</th>
                  <th className="py-2 text-right font-semibold">Presupuesto</th>
                  <th className="py-2 text-right font-semibold">Real</th>
                  <th className="py-2 text-right font-semibold">Variación %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variacionesOrdenadas.map((row) => (
                  <tr key={`var-${row.rubro}`}>
                    <td className="py-2 font-medium text-slate-900">{row.rubro}</td>
                    <td className="py-2 text-right">{formatCurrency(row.presupuesto)}</td>
                    <td className="py-2 text-right">{formatCurrency(row.real)}</td>
                    <td className={`py-2 text-right font-semibold ${Math.abs(row.variacion_pct) > 10 ? 'text-red-600' : 'text-slate-700'}`}>{formatPct(row.variacion_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Ingresos por producto vendido</h3>
          {reportes.ingresos_pt_por_producto.length === 0 ? <p className="text-sm text-slate-500">Sin ventas de producto terminado.</p> : null}
          <div className="space-y-3">
            {reportes.ingresos_pt_por_producto.slice(0, 8).map((row) => (
              <div key={row.producto}>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-slate-900">{row.producto}</span>
                  <span className="text-slate-600">{row.cantidad_kg.toLocaleString('es-AR')} kg · {formatCurrency(row.importe_total)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(row.importe_total / Math.max(1, ...reportes.ingresos_pt_por_producto.map((item) => item.importe_total))) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{row.clientes_count} clientes atendidos</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Cartera de clientes</h3>
              <p className="text-sm text-slate-500">Saldo pendiente y última compra a partir de CxC y ventas PT.</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Total por cobrar: <span className="font-semibold text-lime-700">{formatCurrency(cxcResumen.total)}</span></p>
              <p>Clientes con deuda: <span className="font-semibold text-slate-900">{tesoreria.carteraClientes.length}</span></p>
              <p>Vencidas: <span className="font-semibold text-red-600">{cxcResumen.vencidas}</span> · Próximas: <span className="font-semibold text-amber-600">{cxcResumen.proximas}</span></p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 text-left font-semibold">Cliente</th>
                  <th className="py-2 text-right font-semibold">Saldo pendiente</th>
                  <th className="py-2 text-left font-semibold">Última compra</th>
                  <th className="py-2 text-right font-semibold">Días de atraso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tesoreria.carteraClientes.map((row) => (
                  <tr key={row.cliente_id ?? row.cliente_nombre}>
                    <td className="py-2 font-medium text-slate-900">{row.cliente_nombre}</td>
                    <td className="py-2 text-right">{formatCurrency(row.saldo_pendiente)}</td>
                    <td className="py-2 text-slate-700">{row.ultima_compra ? new Date(row.ultima_compra).toLocaleDateString('es-AR') : 'Sin dato'}</td>
                    <td className="py-2 text-right">{row.dias_atraso !== null ? row.dias_atraso : '0'}</td>
                  </tr>
                ))}
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
                    <p className="text-xs text-slate-500">{row.tercero} · vence {new Date(row.fecha_vencimiento).toLocaleDateString('es-AR')} · {row.estado}</p>
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
                    <p className="text-xs text-slate-500">{row.tercero} · vence {new Date(row.fecha_vencimiento).toLocaleDateString('es-AR')} · {row.estado}</p>
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
          <li>Ingresos PT por producto: {reportes.ingresos_pt_por_producto.length} productos.</li>
          <li>Rentabilidad por fórmula: {reportes.rentabilidad_por_formula.length} fórmulas.</li>
          <li>Costo operativo mensual: {reportes.costo_operativo_mensual.length} períodos.</li>
          <li>Comparativa costo real/formulado: {costosComparativos.length} fórmulas.</li>
        </ul>
        <p className="text-sm text-slate-600 mt-3">
          Resumen operativo: {categoriasTotales} categorías financieras activas y {reportes.ingresos_pt_por_producto.length} productos PT con ingresos.
        </p>
      </Card>

      {loading ? <p className="text-sm text-gray-500">Cargando finanzas…</p> : null}
    </div>
  );
};

export default FinanzasPage;
