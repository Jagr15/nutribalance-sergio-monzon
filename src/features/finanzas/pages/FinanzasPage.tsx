import { Card } from '../../../shared/components/card';
import { useFinanzas } from '../hooks/useFinanzas';
import { FlujoCharts } from '../components/FlujoCharts';
import { KpiGrid } from '../components/KpiGrid';
import { MovimientosTable } from '../components/MovimientosTable';
import { RegistrarMovimientoForm } from '../components/RegistrarMovimientoForm';
import { CostosFormulaVsRealTable } from '../components/CostosFormulaVsRealTable';
import { usePermissions } from '../../auth/usePermissions';

const FinanzasPage = () => {
  const { kpis, reportes, movimientos, costosComparativos, inventario, loading, loadError, infoMessage, refresh, createMovimiento } = useFinanzas();
  const { canAccess } = usePermissions();
  const hasKpis = Object.values(kpis).some((v) => Number(v) !== 0);
  const hasReportes =
    reportes.flujo_caja_mensual.length > 0 ||
    reportes.gastos_por_categoria.length > 0 ||
    reportes.ingresos_por_categoria.length > 0 ||
    reportes.rentabilidad_por_formula.length > 0 ||
    reportes.costo_operativo_mensual.length > 0 ||
    costosComparativos.length > 0;
  const categoriasTotales = new Set([
    ...reportes.gastos_por_categoria.map((r) => r.categoria),
    ...reportes.ingresos_por_categoria.map((r) => r.categoria),
  ]).size;

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
          <li>Rentabilidad por fórmula: {reportes.rentabilidad_por_formula.length} fórmulas.</li>
          <li>Costo operativo mensual: {reportes.costo_operativo_mensual.length} períodos.</li>
          <li>Comparativa costo real/formulado: {costosComparativos.length} fórmulas.</li>
        </ul>
        <p className="text-sm text-slate-600 mt-3">
          Resumen operativo: {categoriasTotales} categorías financieras activas en reportes.
        </p>
      </Card>

      {loading ? <p className="text-sm text-gray-500">Cargando finanzas…</p> : null}
    </div>
  );
};

export default FinanzasPage;
