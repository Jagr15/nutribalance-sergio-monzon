import { useMemo } from "react";
import { Card } from "../../../shared/components/card";

interface CostoFormulaDemo {
  formula: string;
  costoArsTon: number;
  costoLoteArs: number;
  materiaPrimaPrincipal: string;
  variacionPorcentual: number;
  margenEstimadoPorcentual: number;
  valorInventarioArs: number;
}

const costosDemo: CostoFormulaDemo[] = [
  {
    formula: "Lechera Alta Producción v3",
    costoArsTon: 196500,
    costoLoteArs: 1284500,
    materiaPrimaPrincipal: "Maíz molido",
    variacionPorcentual: 3.2,
    margenEstimadoPorcentual: 16.5,
    valorInventarioArs: 3540000,
  },
  {
    formula: "Cerdo Crecimiento 28-70 v2",
    costoArsTon: 214200,
    costoLoteArs: 1059200,
    materiaPrimaPrincipal: "Harina de soja",
    variacionPorcentual: 5.8,
    margenEstimadoPorcentual: 13.1,
    valorInventarioArs: 2298000,
  },
  {
    formula: "Recría Engorde 350kg v1",
    costoArsTon: 228900,
    costoLoteArs: 1190800,
    materiaPrimaPrincipal: "Núcleo vitamínico",
    variacionPorcentual: 7.1,
    margenEstimadoPorcentual: 11.2,
    valorInventarioArs: 1895000,
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const CostosPage = () => {
  const resumen = useMemo(() => {
    const ordenRanking = [...costosDemo].sort((a, b) => b.costoArsTon - a.costoArsTon);
    const formulaMasCostosa = ordenRanking[0];
    const costoPromedioTon =
      costosDemo.reduce((acc, item) => acc + item.costoArsTon, 0) / Math.max(costosDemo.length, 1);
    const capitalInmovilizado = costosDemo.reduce((acc, item) => acc + item.valorInventarioArs, 0);
    const costoMPPrincipal = [...costosDemo].sort((a, b) => b.variacionPorcentual - a.variacionPorcentual)[0];

    return {
      ordenRanking,
      formulaMasCostosa,
      costoPromedioTon,
      capitalInmovilizado,
      costoMPPrincipal,
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Control de costos</p>
        <h1 className="text-3xl font-bold mt-2">Costos</h1>
        <p className="text-gray-400 mt-2">Análisis visual de costos por fórmula, variación estimada y capital inmovilizado.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Ranking N°1 por costo</p>
          <h2 className="text-lg font-black mt-2 text-red-300">{resumen.formulaMasCostosa.formula}</h2>
          <p className="text-sm mt-2">{formatCurrency(resumen.formulaMasCostosa.costoArsTon)}/ton</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Variación estimada promedio</p>
          <h2 className="text-2xl font-black mt-2 text-amber-300">
            +{(costosDemo.reduce((acc, item) => acc + item.variacionPorcentual, 0) / costosDemo.length).toFixed(1)}%
          </h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Capital inmovilizado</p>
          <h2 className="text-2xl font-black mt-2 text-blue-300">{formatCurrency(resumen.capitalInmovilizado)}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Costo MP principal</p>
          <h2 className="text-lg font-black mt-2 text-emerald-300">{resumen.costoMPPrincipal.materiaPrimaPrincipal}</h2>
          <p className="text-sm mt-2">Impacto: +{resumen.costoMPPrincipal.variacionPorcentual.toFixed(1)}%</p>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-xl font-semibold mb-4">Ranking de productos por costo</h2>
          <div className="space-y-3">
            {resumen.ordenRanking.map((item) => {
              const width = Math.min(100, Math.round((item.costoArsTon / resumen.formulaMasCostosa.costoArsTon) * 100));
              return (
                <div key={item.formula}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{item.formula}</span>
                    <span className="text-gray-300">{formatCurrency(item.costoArsTon)}/ton</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-amber-400" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-4">Variación estimada por fórmula</h2>
          <div className="space-y-3">
            {costosDemo.map((item) => {
              const width = Math.min(100, Math.round(item.variacionPorcentual * 10));
              return (
                <div key={`${item.formula}-var`}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{item.formula}</span>
                    <span className="text-amber-300">+{item.variacionPorcentual.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Análisis por fórmula y lote</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="text-left border-b border-white/10 text-gray-400 text-sm">
                <th className="pb-3">Fórmula</th>
                <th className="pb-3">Costo por fórmula</th>
                <th className="pb-3">Costo por lote</th>
                <th className="pb-3">Materia prima principal</th>
                <th className="pb-3">Variación estimada</th>
                <th className="pb-3">Margen estimado</th>
                <th className="pb-3">Valor de inventario</th>
              </tr>
            </thead>
            <tbody>
              {costosDemo.map((costo) => (
                <tr key={costo.formula} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 font-medium">{costo.formula}</td>
                  <td className="py-3">{formatCurrency(costo.costoArsTon)}/ton</td>
                  <td className="py-3">{formatCurrency(costo.costoLoteArs)}</td>
                  <td className="py-3">{costo.materiaPrimaPrincipal}</td>
                  <td className="py-3 text-amber-300">+{costo.variacionPorcentual.toFixed(1)}%</td>
                  <td className="py-3 text-emerald-300">{costo.margenEstimadoPorcentual.toFixed(1)}%</td>
                  <td className="py-3">{formatCurrency(costo.valorInventarioArs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-gray-300">
          Costo promedio por tonelada actual: <span className="font-semibold text-blue-300">{formatCurrency(Math.round(resumen.costoPromedioTon))}</span>
        </p>
      </Card>
    </div>
  );
};

export default CostosPage;
