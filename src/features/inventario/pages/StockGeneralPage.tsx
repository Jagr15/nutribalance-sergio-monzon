import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../shared/components/card";
import { ApiService } from "../../../infrastructure/api";
import { ROUTES } from "../../../app/config/routes";
import type { Insumo, StockMateriaPrima } from "../../insumos/types";

type EstadoInventario = "OK" | "Bajo" | "Crítico";

interface ProductoTerminadoDemo {
  uid: string;
  stockKg: number;
  capacidadKg: number;
  costoArsTon: number;
}

const productosTerminadosDemo: ProductoTerminadoDemo[] = [
  { uid: "pt-001", stockKg: 18400, capacidadKg: 30000, costoArsTon: 196500 },
  { uid: "pt-002", stockKg: 7900, capacidadKg: 22000, costoArsTon: 214200 },
  { uid: "pt-003", stockKg: 3200, capacidadKg: 18000, costoArsTon: 228900 },
  { uid: "pt-004", stockKg: 5600, capacidadKg: 25000, costoArsTon: 221400 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const getEstado = (ratio: number): EstadoInventario => {
  if (ratio <= 20) return "Crítico";
  if (ratio <= 40) return "Bajo";
  return "OK";
};

const getEstadoClass = (estado: EstadoInventario) => {
  if (estado === "Crítico") return "bg-red-500/20 text-red-300";
  if (estado === "Bajo") return "bg-amber-500/20 text-amber-300";
  return "bg-emerald-500/20 text-emerald-300";
};

const StockGeneralPage = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lotesMP, setLotesMP] = useState<StockMateriaPrima[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [insumosData, lotesData] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.stockMP.getAllLotes(),
        ]);
        setInsumos(insumosData);
        setLotesMP(lotesData);
      } catch (error) {
        console.error("Error cargando stock general:", error);
      }
    };

    void load();
  }, []);

  const metrics = useMemo(() => {
    const totalMP = lotesMP.reduce((acc, item) => acc + (item.cantidad_actual || 0), 0);
    const totalCapMP = lotesMP.reduce((acc, item) => acc + (item.cantidad_inicial || 0), 0);
    const valorMP = lotesMP.reduce((acc, item) => acc + (item.costo_total || 0), 0);

    let mpCritico = 0;
    let mpBajo = 0;
    let mpOk = 0;

    insumos.forEach((insumo) => {
      const lotesPorInsumo = lotesMP.filter((lote) => lote.id_insumo === insumo.uid);
      const stock = lotesPorInsumo.reduce((acc, lote) => acc + (lote.cantidad_actual || 0), 0);
      const capacidad = lotesPorInsumo.reduce((acc, lote) => acc + (lote.cantidad_inicial || 0), 0);
      const ratio = capacidad > 0 ? (stock / capacidad) * 100 : 0;

      if (ratio <= 20 || stock <= insumo.umbral_alerta) {
        mpCritico += 1;
        return;
      }

      if (ratio <= 40) {
        mpBajo += 1;
        return;
      }

      mpOk += 1;
    });

    const totalPT = productosTerminadosDemo.reduce((acc, item) => acc + item.stockKg, 0);
    const totalCapPT = productosTerminadosDemo.reduce((acc, item) => acc + item.capacidadKg, 0);
    const valorPT = productosTerminadosDemo.reduce((acc, item) => acc + (item.stockKg / 1000) * item.costoArsTon, 0);

    let ptCritico = 0;
    let ptBajo = 0;
    let ptOk = 0;

    productosTerminadosDemo.forEach((item) => {
      const ratio = item.capacidadKg > 0 ? (item.stockKg / item.capacidadKg) * 100 : 0;
      const estado = getEstado(ratio);
      if (estado === "Crítico") ptCritico += 1;
      else if (estado === "Bajo") ptBajo += 1;
      else ptOk += 1;
    });

    const totalAlertasCriticas = mpCritico + ptCritico;
    const totalValor = valorMP + valorPT;

    const mpRatio = totalCapMP > 0 ? (totalMP / totalCapMP) * 100 : 0;
    const ptRatio = totalCapPT > 0 ? (totalPT / totalCapPT) * 100 : 0;

    return {
      totalMP,
      totalPT,
      totalValor,
      totalAlertasCriticas,
      mp: {
        elementos: insumos.length,
        lotes: lotesMP.length,
        valor: valorMP,
        ok: mpOk,
        bajo: mpBajo,
        critico: mpCritico,
        ratio: mpRatio,
      },
      pt: {
        elementos: productosTerminadosDemo.length,
        lotes: productosTerminadosDemo.length,
        valor: valorPT,
        ok: ptOk,
        bajo: ptBajo,
        critico: ptCritico,
        ratio: ptRatio,
      },
    };
  }, [insumos, lotesMP]);

  const summaryRows = [
    {
      categoria: "Materia Prima",
      elementos: `${metrics.mp.elementos} insumos / ${metrics.mp.lotes} lotes`,
      stock: `${metrics.totalMP.toLocaleString("es-AR")} kg`,
      valor: metrics.mp.valor,
      alertas: `OK ${metrics.mp.ok} · Bajo ${metrics.mp.bajo} · Crítico ${metrics.mp.critico}`,
      estado: getEstado(metrics.mp.ratio),
    },
    {
      categoria: "Producto Terminado",
      elementos: `${metrics.pt.elementos} productos`,
      stock: `${metrics.totalPT.toLocaleString("es-AR")} kg`,
      valor: metrics.pt.valor,
      alertas: `OK ${metrics.pt.ok} · Bajo ${metrics.pt.bajo} · Crítico ${metrics.pt.critico}`,
      estado: getEstado(metrics.pt.ratio),
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Inventario</p>
        <h1 className="text-3xl font-bold mt-2">Stock General</h1>
        <p className="text-gray-400 mt-2">Resumen consolidado de inventario para operación: materia prima y productos terminados en una sola vista.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Total Materia Prima</p>
          <h2 className="text-3xl font-black mt-2">{metrics.totalMP.toLocaleString("es-AR")} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Total Producto Terminado</p>
          <h2 className="text-3xl font-black mt-2">{metrics.totalPT.toLocaleString("es-AR")} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Alertas Críticas</p>
          <h2 className="text-3xl font-black mt-2 text-red-300">{metrics.totalAlertasCriticas}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Valor Total Inventario ARS</p>
          <h2 className="text-2xl font-black mt-2 text-emerald-300">{formatCurrency(Math.round(metrics.totalValor))}</h2>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-xl font-semibold mb-3">Materia Prima vs Producto Terminado</h2>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-gray-300 font-semibold">Materia Prima</p>
              <p className="text-gray-400 mt-1">{metrics.mp.lotes} lotes · {metrics.mp.elementos} insumos</p>
              <p className="text-gray-200 mt-2">Valor: {formatCurrency(Math.round(metrics.mp.valor))}</p>
              <p className="text-gray-400 mt-1">Alertas: OK {metrics.mp.ok} · Bajo {metrics.mp.bajo} · Crítico {metrics.mp.critico}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-gray-300 font-semibold">Producto Terminado</p>
              <p className="text-gray-400 mt-1">{metrics.pt.elementos} productos</p>
              <p className="text-gray-200 mt-2">Valor: {formatCurrency(Math.round(metrics.pt.valor))}</p>
              <p className="text-gray-400 mt-1">Alertas: OK {metrics.pt.ok} · Bajo {metrics.pt.bajo} · Crítico {metrics.pt.critico}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-3">Acciones de Inventario</h2>
          <p className="text-sm text-gray-400 mb-5">Navegación directa a vistas detalladas por tipo de stock.</p>
          <div className="flex flex-col gap-3">
            <Link to={ROUTES.STOCKMATERIAPRIMA} className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-center">
              Ver Materia Prima
            </Link>
            <Link to={ROUTES.PRODUCTOS} className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-center">
              Ver Producto Terminado
            </Link>
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Resumen de Inventario</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-gray-400 text-sm">
                <th className="py-3">Categoría</th>
                <th className="py-3">Elementos</th>
                <th className="py-3">Stock total</th>
                <th className="py-3">Valor estimado ARS</th>
                <th className="py-3">Alertas</th>
                <th className="py-3">Estado general</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.categoria} className="border-b border-white/5">
                  <td className="py-3 font-medium">{row.categoria}</td>
                  <td className="py-3 text-gray-300">{row.elementos}</td>
                  <td className="py-3 text-gray-300">{row.stock}</td>
                  <td className="py-3 text-gray-300">{formatCurrency(Math.round(row.valor))}</td>
                  <td className="py-3 text-gray-300">{row.alertas}</td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getEstadoClass(row.estado)}`}>
                      {row.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StockGeneralPage;
