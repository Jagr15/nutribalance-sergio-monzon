import { Card } from '../../../shared/components/card';
import type { FinanzasKPIs } from '../types';

const ars = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);

export const KpiGrid = ({ kpis }: { kpis: FinanzasKPIs }) => (
  <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    <Card><p className="text-xs text-gray-400">Ingresos del período</p><p className="text-3xl font-black mt-2 text-emerald-300">{ars(kpis.ingresos_mes)}</p></Card>
    <Card><p className="text-xs text-gray-400">Egresos del período</p><p className="text-3xl font-black mt-2 text-red-300">{ars(kpis.egresos_mes)}</p></Card>
    <Card><p className="text-xs text-gray-400">Flujo neto</p><p className="text-2xl font-black mt-2 text-blue-300">{ars(kpis.flujo_neto)}</p></Card>
    <Card><p className="text-xs text-gray-400">Margen operativo</p><p className="text-2xl font-black mt-2 text-violet-300">{kpis.margen_operativo.toFixed(2)}%</p></Card>
    <Card><p className="text-xs text-gray-400">Cuentas por cobrar</p><p className="text-2xl font-black mt-2 text-lime-300">{ars(kpis.cuentas_por_cobrar)}</p></Card>
    <Card><p className="text-xs text-gray-400">Cuentas por pagar</p><p className="text-2xl font-black mt-2 text-orange-300">{ars(kpis.cuentas_por_pagar)}</p></Card>
  </section>
);
