import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../shared/components/card";
import { ApiService } from "../../../infrastructure/api";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../app/config/routes";
import type { StockMateriaPrima } from "../../insumos/types";
import type { Insumo } from "../../insumos/types";
import { EstadoOrden, type OrdenProduccion } from "../../ordenes/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

export const DashboardPage = () => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lotes, setLotes] = useState<StockMateriaPrima[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);

  const openNuevoProductoModal = () => {
    void Swal.fire({
      title: "Nuevo producto",
      html: `
        <div style="text-align:left; color:#f8fafc; font-size:14px;">
          <label style="display:block; margin:0 0 6px;">Nombre del producto</label>
          <input id="np-nombre" placeholder="Ej: Lechera Premium Invierno" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
          <label style="display:block; margin:0 0 6px;">Tipo / segmento</label>
          <select id="np-segmento" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">
            <option value="">Seleccionar segmento</option>
            <option value="Lechera">Lechera</option>
            <option value="Recría">Recría</option>
            <option value="Engorde">Engorde</option>
            <option value="Porcino">Porcino</option>
            <option value="Distribución">Distribución</option>
          </select>
          <label style="display:block; margin:0 0 6px;">Fórmula base sugerida</label>
          <select id="np-formula" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">
            <option value="">Seleccionar fórmula</option>
            <option value="Lechera Alta Producción v3">Lechera Alta Producción v3</option>
            <option value="Cerdo Crecimiento 28-70 v2">Cerdo Crecimiento 28-70 v2</option>
            <option value="Recría Engorde 18% v1">Recría Engorde 18% v1</option>
            <option value="Engorde Intensivo v2">Engorde Intensivo v2</option>
          </select>
          <label style="display:block; margin:0 0 6px;">Silo destino</label>
          <input id="np-silo" placeholder="Ej: Silo PT-05" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
          <label style="display:block; margin:0 0 6px;">Costo estimado ARS / ton</label>
          <input id="np-costo" type="number" min="0" step="100" placeholder="Ej: 210000" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
          <label style="display:block; margin:0 0 6px;">Stock inicial (kg)</label>
          <input id="np-stock" type="number" min="0" step="100" placeholder="Ej: 5000" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
          <label style="display:block; margin:0 0 6px;">Estado inicial</label>
          <select id="np-estado" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">
            <option value="OK">OK</option>
            <option value="Bajo">Bajo</option>
            <option value="Crítico">Crítico</option>
          </select>
          <label style="display:block; margin:0 0 6px;">Observaciones</label>
          <textarea id="np-obs" rows="3" placeholder="Notas comerciales y operativas" style="width:100%; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;"></textarea>
        </div>
      `,
      background: "#0d121b",
      color: "#fff",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#334155",
      confirmButtonText: "Registrar operación",
      cancelButtonText: "Cancelar",
      width: 720,
      preConfirm: () => {
        const nombre = (document.getElementById("np-nombre") as HTMLInputElement | null)?.value.trim() || "";
        const costo = Number((document.getElementById("np-costo") as HTMLInputElement | null)?.value || 0);
        const stock = Number((document.getElementById("np-stock") as HTMLInputElement | null)?.value || 0);

        if (!nombre) {
          Swal.showValidationMessage("Ingresá el nombre del producto para registrar la operación.");
          return;
        }
        if (costo < 0 || stock < 0) {
          Swal.showValidationMessage("Costo y stock inicial no pueden ser negativos.");
          return;
        }

        return {
          nombre,
          segmento: (document.getElementById("np-segmento") as HTMLSelectElement | null)?.value || "Sin dato",
          formula: (document.getElementById("np-formula") as HTMLSelectElement | null)?.value || "Sin dato",
          silo: (document.getElementById("np-silo") as HTMLInputElement | null)?.value.trim() || "Sin dato",
          costo,
          stock,
          estado: (document.getElementById("np-estado") as HTMLSelectElement | null)?.value || "Sin dato",
          observaciones: (document.getElementById("np-obs") as HTMLTextAreaElement | null)?.value.trim() || "Sin dato",
        };
      },
    }).then((result) => {
      if (!result.isConfirmed || !result.value) return;
      const data = result.value as {
        nombre: string;
        segmento: string;
        formula: string;
        silo: string;
        costo: number;
        stock: number;
        estado: string;
        observaciones: string;
      };

      void Swal.fire({
        icon: "success",
        title: "Operación registrada correctamente",
        html: `
          <div style="text-align:left; color:#f8fafc; font-size:14px;">
            <p style="margin:0 0 8px;">Producto preparado: <strong>${data.nombre}</strong>.</p>
            <p style="margin:0 0 6px;"><strong>Segmento:</strong> ${data.segmento}</p>
            <p style="margin:0 0 6px;"><strong>Fórmula base:</strong> ${data.formula}</p>
            <p style="margin:0 0 6px;"><strong>Silo destino:</strong> ${data.silo}</p>
            <p style="margin:0 0 6px;"><strong>Costo estimado:</strong> ${formatCurrency(data.costo)} / ton</p>
            <p style="margin:0 0 6px;"><strong>Stock inicial:</strong> ${data.stock.toLocaleString("es-AR")} kg</p>
            <p style="margin:0 0 6px;"><strong>Estado inicial:</strong> ${data.estado}</p>
            <p style="margin:0 0 10px;"><strong>Observaciones:</strong> ${data.observaciones}</p>
            <p style="margin:0; color:#9ca3af;">Pendiente de integración avanzada con fórmulas, stock y persistencia central.</p>
          </div>
        `,
        background: "#0d121b",
        color: "#fff",
        confirmButtonColor: "#2563eb",
      });
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [insumosData, lotesData, ordenesData] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.stockMP.getAllLotes(),
          ApiService.ordenes.getAll(),
        ]);
        setInsumos(insumosData);
        setLotes(lotesData);
        setOrdenes(ordenesData);
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      }
    };
    void loadData();
  }, []);

  const metrics = useMemo(() => {
    const totalStockMP = lotes.reduce((acc, item) => acc + (item.cantidad_actual || 0), 0);
    const valorInventario = lotes.reduce((acc, item) => acc + (item.costo_total || 0), 0);
    const insumosCriticos = insumos.filter((insumo) => {
      const totalInsumo = lotes
        .filter((l) => l.id_insumo === insumo.uid)
        .reduce((acc, l) => acc + (l.cantidad_actual || 0), 0);
      return totalInsumo <= insumo.umbral_alerta;
    }).length;
    const ordenesActivas = ordenes.filter((o) => o.estado !== EstadoOrden.FINALIZADO).length;
    const produccionDelDia = ordenes
      .filter((o) => o.estado === EstadoOrden.FINALIZADO)
      .reduce((acc, o) => acc + (o.cantidad_real || 0), 0);

    return {
      totalStockMP,
      valorInventario,
      insumosCriticos,
      ordenesActivas,
      produccionDelDia,
    };
  }, [insumos, lotes, ordenes]);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">
          Estado operativo
        </p>
        <h1 className="text-4xl font-bold mt-2">
          Panel de Producción e Inventario
        </h1>
        <p className="text-gray-400 mt-3 max-w-3xl">
          Vista ejecutiva para decisiones rápidas sobre stock, producción, alertas y costo operativo.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Inventario</p>
          <h3 className="text-3xl font-black mt-2">{metrics.totalStockMP.toLocaleString()} kg</h3>
          <p className="text-sm text-gray-400 mt-2">Total stock MP</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Alertas</p>
          <h3 className="text-3xl font-black mt-2 text-red-400">{metrics.insumosCriticos}</h3>
          <p className="text-sm text-gray-400 mt-2">Insumos críticos</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Producción</p>
          <h3 className="text-3xl font-black mt-2 text-blue-400">{metrics.ordenesActivas}</h3>
          <p className="text-sm text-gray-400 mt-2">Órdenes activas</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Producción del día</p>
          <h3 className="text-3xl font-black mt-2 text-emerald-400">{metrics.produccionDelDia.toLocaleString()} kg</h3>
          <p className="text-sm text-gray-400 mt-2">Lotes finalizados</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Costo</p>
          <h3 className="text-3xl font-black mt-2 text-emerald-400">ARS {metrics.valorInventario.toLocaleString()}</h3>
          <p className="text-sm text-gray-400 mt-2">Valor inventario ARS</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Estado del proyecto</p>
          <h3 className="text-xl font-black mt-2 text-blue-400">Operación en avance</h3>
          <p className="text-sm text-gray-400 mt-2">Módulos core operativos</p>
        </Card>
      </section>
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">
              Inventario y Alertas
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Lectura rápida de estado operativo por rubro
            </p>
          </div>

          <button
            type="button"
            aria-label="Nuevo producto"
            onClick={openNuevoProductoModal}
            className="bg-blue-600 hover:bg-blue-700 transition px-4 py-2 rounded-xl text-sm font-medium"
          >
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
                  Maíz
                </td>
                <td>
                  Grano
                </td>
                <td>
                  7,800 kg
                </td>
                <td>
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-sm">
                    OK
                  </span>
                </td>
              </tr>

              <tr className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Soja
                </td>
                <td>
                  Grano
                </td>
                <td>
                  1,100 kg
                </td>
                <td>
                  <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-lg text-sm">
                    Bajo
                  </span>
                </td>
              </tr>

              <tr className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Núcleo Vitamínico
                </td>
                <td>
                  Suplemento
                </td>
                <td>
                  140 kg
                </td>
                <td>
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-sm">
                    Crítico
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-white/5 transition">
                <td className="py-4 font-medium">
                  Afrechillo
                </td>
                <td>
                  Suplemento
                </td>
                <td>
                  2,600 kg
                </td>
                <td>
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-sm">
                    OK
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Impacto de Negocio</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>Menor dependencia de Excel.</li>
            <li>Control de lotes de producción.</li>
            <li>Visibilidad de stock en tiempo real.</li>
            <li>Control de costos por orden.</li>
            <li>Alertas tempranas de faltantes.</li>
            <li>Base preparada para trazabilidad y finanzas.</li>
          </ul>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Etapa de Implementación</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-blue-400 font-semibold">Etapa 1:</span> Producción, Inventario doble, Alertas.</p>
            <p><span className="text-amber-400 font-semibold">Configuración avanzada:</span> FIFO completo, Finanzas, Cheques y Roles avanzados.</p>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Modo Presentación</h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            Información operativa disponible para validación del flujo comercial y productivo.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Incluye inventario, stock, fórmulas y órdenes con inicio/finalización y merma.
          </p>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Accesos rápidos de gestión</h3>
            <p className="text-sm text-gray-400 mt-1">Navegación directa a módulos comerciales y de costos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={ROUTES.CLIENTES} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium">
              Clientes
            </Link>
            <Link to={ROUTES.PRODUCTOS} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium">
              Productos
            </Link>
            <Link to={ROUTES.COSTOS} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium">
              Costos
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};
export default DashboardPage;
