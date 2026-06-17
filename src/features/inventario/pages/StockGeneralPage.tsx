import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../shared/components/card";
import { DataTable, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from "../../../shared/components/table";
import { ApiService } from "../../../infrastructure/api";
import { ROUTES } from "../../../app/config/routes";
import type { Insumo, StockMateriaPrima } from "../../insumos/types";
import { ControlEstado, type StockProductoTerminadoResumen } from "../../productos/types";

type EstadoInventario = "OK" | "Bajo" | "Crítico";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const getEstado = (ratio: number): EstadoInventario => {
  if (ratio <= 20) return "Crítico";
  if (ratio <= 40) return "Bajo";
  return "OK";
};

const StockGeneralPage = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lotesMP, setLotesMP] = useState<StockMateriaPrima[]>([]);
  const [stockPTResumen, setStockPTResumen] = useState<StockProductoTerminadoResumen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [insumosData, lotesData, stockPTResumenData] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.stockMP.getAllLotes(),
          ApiService.stockPT.getResumen(),
        ]);
        setInsumos(insumosData);
        setLotesMP(lotesData);
        setStockPTResumen(stockPTResumenData);
        setError(null);
      } catch (error) {
        console.error("Error cargando stock general:", error);
        setError("No se pudo cargar el inventario en este momento.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const metrics = useMemo(() => {
    const totalMP = lotesMP.reduce((acc, item) => acc + (item.cantidad_actual || 0), 0);
    const totalCapMP = lotesMP.reduce((acc, item) => acc + (item.cantidad_inicial || 0), 0);
    // El valor operativo del stock actual se estima con cantidad disponible * costo unitario.
    const valorMP = lotesMP.reduce((acc, item) => acc + (item.cantidad_actual || 0) * (item.costo_unitario || 0), 0);

    let mpCritico = 0;
    let mpBajo = 0;
    let mpOk = 0;

    insumos.forEach((insumo) => {
      const lotesPorInsumo = lotesMP.filter((lote) => lote.id_insumo === insumo.uid);
      const stock = lotesPorInsumo.reduce((acc, lote) => acc + (lote.cantidad_actual || 0), 0);
      const capacidad = lotesPorInsumo.reduce((acc, lote) => acc + (lote.cantidad_inicial || 0), 0);
      const ratio = capacidad > 0 ? (stock / capacidad) * 100 : 0;
      const umbral = insumo.umbral_alerta ?? 0;

      if (ratio <= 20 || stock <= umbral) {
        mpCritico += 1;
        return;
      }

      if (ratio <= 40) {
        mpBajo += 1;
        return;
      }

      mpOk += 1;
    });

    const totalPT = stockPTResumen.reduce((acc, item) => acc + (item.stock_actual || 0), 0);
    const valorPT = stockPTResumen.reduce((acc, item) => acc + (item.valor_monetario || 0), 0);
    const ptCritico = stockPTResumen.filter((item) => item.estado === ControlEstado.CRITICO).length;
    const ptBajo = stockPTResumen.filter((item) => item.estado === ControlEstado.BAJO).length;
    const ptOk = stockPTResumen.filter((item) => item.estado === ControlEstado.OK).length;

    const totalAlertasCriticas = mpCritico + ptCritico;
    const totalValor = valorMP + valorPT;

    const mpRatio = totalCapMP > 0 ? (totalMP / totalCapMP) * 100 : 0;
    const ptEstado: EstadoInventario = ptCritico > 0 ? "Crítico" : ptBajo > 0 ? "Bajo" : "OK";

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
        elementos: stockPTResumen.length,
        lotes: stockPTResumen.length,
        valor: valorPT,
        ok: ptOk,
        bajo: ptBajo,
        critico: ptCritico,
        estado: ptEstado,
      },
    };
  }, [insumos, lotesMP, stockPTResumen]);

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
      estado: metrics.pt.estado,
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Inventario</p>
        <h1 className="text-3xl font-bold mt-2">Stock General</h1>
        <p className="text-slate-500 mt-2">Resumen consolidado de inventario para operación: materia prima y productos terminados en una sola vista.</p>
      </section>
      {error ? <Card className="border border-red-200 bg-red-50 text-red-700">{error}</Card> : null}

      {isLoading ? (
        <Card>
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-600">Cargando inventario general...</p>
          </div>
        </Card>
      ) : null}

      {!isLoading ? <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Total Materia Prima</p>
          <h2 className="text-3xl font-black mt-2">{metrics.totalMP.toLocaleString("es-AR")} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Total Producto Terminado</p>
          <h2 className="text-3xl font-black mt-2">{metrics.totalPT.toLocaleString("es-AR")} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Alertas Críticas</p>
          <h2 className="text-3xl font-black mt-2 text-red-300">{metrics.totalAlertasCriticas}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Valor Total Inventario ARS</p>
          <h2 className="text-2xl font-black mt-2 text-emerald-300">{formatCurrency(Math.round(metrics.totalValor))}</h2>
          <p className="text-xs text-slate-500 mt-2">Incluye valor consolidado de MP y PT.</p>
        </Card>
      </section> : null}

      {!isLoading ? <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-xl font-semibold mb-3">Materia Prima vs Producto Terminado</h2>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-slate-700 font-semibold">Materia Prima</p>
              <p className="text-slate-500 mt-1">{metrics.mp.lotes} lotes · {metrics.mp.elementos} insumos</p>
              <p className="text-slate-700 mt-2">Valor: {formatCurrency(Math.round(metrics.mp.valor))}</p>
              <p className="text-slate-500 mt-1">Alertas: OK {metrics.mp.ok} · Bajo {metrics.mp.bajo} · Crítico {metrics.mp.critico}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-slate-700 font-semibold">Producto Terminado</p>
              <p className="text-slate-500 mt-1">{metrics.pt.elementos} productos</p>
              <p className="text-slate-700 mt-2">Valor: {formatCurrency(Math.round(metrics.pt.valor ?? 0))}</p>
              <p className="text-slate-500 mt-1">Alertas: OK {metrics.pt.ok} · Bajo {metrics.pt.bajo} · Crítico {metrics.pt.critico}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-3">Acciones de Inventario</h2>
          <p className="text-sm text-slate-500 mb-5">Navegación directa a vistas detalladas por tipo de stock.</p>
          <div className="flex flex-col gap-3">
            <Link to={ROUTES.STOCKMATERIAPRIMA} className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold text-center">
              Ver Materia Prima
            </Link>
            <Link to={ROUTES.PRODUCTOS} className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold text-center border border-slate-200">
              Ver Producto Terminado
            </Link>
          </div>
        </Card>
      </section> : null}

      {!isLoading ? <Card>
        <h2 className="text-xl font-semibold mb-4">Resumen de Inventario</h2>
        {summaryRows.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No hay inventario disponible para mostrar.</div>
        ) : (
        <DataTable minWidthClassName="min-w-[920px]">
          <TableHeader>
            <tr>
              <TableCell header>Categoría</TableCell>
              <TableCell header>Elementos</TableCell>
              <TableCell header>Stock total</TableCell>
              <TableCell header>Valor estimado ARS</TableCell>
              <TableCell header>Alertas</TableCell>
              <TableCell header>Estado general</TableCell>
            </tr>
          </TableHeader>
          <TableBody>
            {summaryRows.map((row) => (
              <TableRow key={row.categoria}>
                <TableCell className="font-medium">{row.categoria}</TableCell>
                <TableCell className="text-slate-700">{row.elementos}</TableCell>
                <TableCell className="text-slate-700">{row.stock}</TableCell>
                <TableCell className="text-slate-700">{row.valor === null ? "No disponible" : formatCurrency(Math.round(row.valor))}</TableCell>
                <TableCell className="text-slate-700">{row.alertas}</TableCell>
                <TableCell><StatusBadge value={row.estado} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
        )}
      </Card> : null}
    </div>
  );
};

export default StockGeneralPage;
