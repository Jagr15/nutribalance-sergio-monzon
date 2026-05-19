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
    const formulaMasCostosa = [...costosDemo].sort((a, b) => b.costoArsTon - a.costoArsTon)[0];
    const costoPromedioTon =
      costosDemo.reduce((acc, item) => acc + item.costoArsTon, 0) / Math.max(costosDemo.length, 1);
    const capitalInmovilizado = costosDemo.reduce((acc, item) => acc + item.valorInventarioArs, 0);
    const mermaRegistrada = 1.8;

    return {
      formulaMasCostosa,
      costoPromedioTon,
      capitalInmovilizado,
      mermaRegistrada,
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Control de costos</p>
        <h1 className="text-3xl font-bold mt-2">Costos</h1>
        <p className="text-gray-400 mt-2">
          Análisis preliminar para validación del flujo; módulo financiero avanzado en siguiente fase.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Fórmula más costosa</p>
          <h2 className="text-lg font-black mt-2 text-red-300">{resumen.formulaMasCostosa.formula}</h2>
          <p className="text-sm mt-2">{formatCurrency(resumen.formulaMasCostosa.costoArsTon)}/ton</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Costo promedio por tonelada</p>
          <h2 className="text-2xl font-black mt-2 text-blue-300">{formatCurrency(Math.round(resumen.costoPromedioTon))}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Capital inmovilizado en MP</p>
          <h2 className="text-2xl font-black mt-2 text-amber-300">{formatCurrency(resumen.capitalInmovilizado)}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Merma registrada</p>
          <h2 className="text-2xl font-black mt-2 text-emerald-300">{resumen.mermaRegistrada.toFixed(1)}%</h2>
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
    </div>
  );
};

export default CostosPage;
