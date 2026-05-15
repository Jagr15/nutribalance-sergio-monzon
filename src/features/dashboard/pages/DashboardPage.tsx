import { KPI } from "../components/KPI";
import { Card } from "../../../shared/components/card";
export const DashboardPage = () => {
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <section>
        <p className="text-sm uppercase tracking-widest text-orange-400">
          Inventarios en tiempo real
        </p>

        <h1 className="text-4xl font-bold mt-2">
          Stock de materia prima
        </h1>

        <p className="text-gray-400 mt-3 max-w-3xl">
          Gestión avanzada de inventarios, trazabilidad y control ERP.
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <KPI
          title="SKUs monitoreados"
          value="148"
          hint="Incluye mezclas y micros"
        />

        <KPI
          title="Alertas activas"
          value="12"
          hint="Stock bajo mínimo"
        />

        <KPI
          title="Movimientos hoy"
          value="28"
          hint="Entradas y salidas"
        />

      </section>

      {/* TABLE */}
      <Card>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">
              Inventario por categoría
            </h2>

            <p className="text-sm text-gray-400 mt-1">
              Productos monitoreados en tiempo real
            </p>
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 transition px-4 py-2 rounded-xl text-sm font-medium">
            Nuevo Producto
          </button>
        </div>

        <div className="overflow-auto">

          <table className="w-full">

            <thead>
              <tr className="border-b border-white/10 text-left text-gray-400 text-sm">

                <th className="pb-4">Producto</th>
                <th className="pb-4">Tipo</th>
                <th className="pb-4">Existencia</th>
                <th className="pb-4">Estado</th>

              </tr>
            </thead>

            <tbody>

              <tr className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Maíz amarillo
                </td>

                <td>
                  Grano
                </td>

                <td>
                  1800 kg
                </td>

                <td>
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-sm">
                    Disponible
                  </span>
                </td>
              </tr>

              <tr className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Harina proteica
                </td>

                <td>
                  Suplemento
                </td>

                <td>
                  240 kg
                </td>

                <td>
                  <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-sm">
                    Bajo stock
                  </span>
                </td>
              </tr>

              <tr className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Fosfato cálcico
                </td>

                <td>
                  Mineral
                </td>

                <td>
                  80 kg
                </td>

                <td>
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-sm">
                    Crítico
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Vitaminas premix
                </td>

                <td>
                  Micronutriente
                </td>

                <td>
                  420 kg
                </td>

                <td>
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-sm">
                    Disponible
                  </span>
                </td>
              </tr>

            </tbody>

          </table>

        </div>

      </Card>

    </div>
  );
};
export default DashboardPage;