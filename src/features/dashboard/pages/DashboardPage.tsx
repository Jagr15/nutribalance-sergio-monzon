import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../shared/components/card";
import { ApiService } from "../../../infrastructure/api";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../app/config/routes";
import type { StockMateriaPrima } from "../../insumos/types";
import type { Insumo } from "../../insumos/types";
import { EstadoOrden, type OrdenProduccion } from "../../ordenes/types";
import { FiAlertTriangle, FiArrowUpRight, FiClipboard, FiPackage, FiTruck, FiUsers } from "react-icons/fi";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const safePercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const productosTerminadosDemo = [
  { stockKg: 18400, capacidadKg: 30000, costoArsTon: 196500 },
  { stockKg: 7900, capacidadKg: 22000, costoArsTon: 214200 },
  { stockKg: 3200, capacidadKg: 18000, costoArsTon: 228900 },
  { stockKg: 5600, capacidadKg: 25000, costoArsTon: 221400 },
];

const getEstadoByRatio = (stock: number, capacidad: number) => {
  if (capacidad <= 0) return "Crítico";
  const ratio = (stock / capacidad) * 100;
  if (ratio <= 20) return "Crítico";
  if (ratio <= 40) return "Bajo";
  return "OK";
};

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
    const alertasCriticasMP = insumos.filter((insumo) => {
      const totalInsumo = lotes
        .filter((l) => l.id_insumo === insumo.uid)
        .reduce((acc, l) => acc + (l.cantidad_actual || 0), 0);
      const capacidadInsumo = lotes
        .filter((l) => l.id_insumo === insumo.uid)
        .reduce((acc, l) => acc + (l.cantidad_inicial || 0), 0);
      const ratio = capacidadInsumo > 0 ? (totalInsumo / capacidadInsumo) * 100 : 0;
      return ratio <= 20 || totalInsumo <= insumo.umbral_alerta;
    }).length;
    const alertasBajasMP = insumos.filter((insumo) => {
      const totalInsumo = lotes
        .filter((l) => l.id_insumo === insumo.uid)
        .reduce((acc, l) => acc + (l.cantidad_actual || 0), 0);
      const capacidadInsumo = lotes
        .filter((l) => l.id_insumo === insumo.uid)
        .reduce((acc, l) => acc + (l.cantidad_inicial || 0), 0);
      const ratio = capacidadInsumo > 0 ? (totalInsumo / capacidadInsumo) * 100 : 0;
      return ratio > 20 && ratio <= 40;
    }).length;

    const alertasPT = productosTerminadosDemo.filter((item) => getEstadoByRatio(item.stockKg, item.capacidadKg) !== "OK").length;
    const valorPT = productosTerminadosDemo.reduce((acc, item) => acc + (item.stockKg / 1000) * item.costoArsTon, 0);
    const ordenesActivas = ordenes.filter((o) => o.estado !== EstadoOrden.FINALIZADO && o.estado !== EstadoOrden.ANULADO).length;
    const produccionDelDia = ordenes
      .filter((o) => o.estado === EstadoOrden.FINALIZADO)
      .reduce((acc, o) => acc + (o.cantidad_real || 0), 0);

    const capacidadTotal = lotes.reduce((acc, item) => acc + (item.cantidad_inicial || 0), 0);
    const stockPercent = capacidadTotal > 0 ? (totalStockMP / capacidadTotal) * 100 : 0;
    const produccionObjetivo = ordenes.reduce((acc, item) => acc + (item.cantidad_objetivo || 0), 0);
    const produccionPercent = produccionObjetivo > 0 ? (produccionDelDia / produccionObjetivo) * 100 : 0;

    const costoPromedioKg = totalStockMP > 0 ? valorInventario / totalStockMP : 0;
    const costoBase = 450;
    const costoPercent = costoBase > 0 ? (costoPromedioKg / costoBase) * 100 : 0;

    return {
      totalStockMP,
      valorInventario: valorInventario + valorPT,
      alertasAutomaticas: alertasCriticasMP + alertasBajasMP + alertasPT,
      ordenesActivas,
      produccionDelDia,
      stockPercent: safePercent(stockPercent),
      produccionPercent: safePercent(produccionPercent),
      costoPercent: safePercent(costoPercent),
      costoPromedioKg,
    };
  }, [insumos, lotes, ordenes]);

  const ultimosMovimientos = useMemo(() => {
    return lotes
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((lote) => {
        const insumo = insumos.find((item) => item.uid === lote.id_insumo);
        const restante = lote.cantidad_inicial > 0 ? (lote.cantidad_actual / lote.cantidad_inicial) * 100 : 0;
        return {
          id: lote.uid,
          titulo: insumo?.nombre || "Materia prima",
          detalle: `${lote.lote} · ${lote.ubicacion || "Ubicación operativa"}`,
          cantidad: `${(lote.cantidad_actual || 0).toLocaleString("es-AR")} kg`,
          restante: safePercent(restante),
        };
      });
  }, [insumos, lotes]);

  const ordenesRecientes = useMemo(() => {
    return ordenes
      .slice()
      .sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime())
      .slice(0, 5);
  }, [ordenes]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#0f2239] via-[#163355] to-[#0f1e33] p-7 md:p-9 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Estado operativo</p>
            <h1 className="text-3xl md:text-4xl font-black mt-2">Centro Ejecutivo de Producción</h1>
            <p className="text-slate-200/90 mt-3 max-w-3xl leading-relaxed">
              Inventario unificado de stock de materia prima y stock de productos terminados, con alertas automáticas, valorización ARS y foco operativo.
            </p>
          </div>

          <button
            type="button"
            aria-label="Nuevo producto"
            onClick={openNuevoProductoModal}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-3 rounded-xl transition"
          >
            Nuevo Producto
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <Card className="bg-[#132235]">
          <p className="text-xs uppercase tracking-widest text-cyan-200">Inventario integral</p>
          <h3 className="text-2xl font-black mt-2 text-cyan-100">Stock consolidado</h3>
          <p className="text-sm text-slate-300 mt-2">Materia prima y producto terminado en una vista ejecutiva.</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Valor inventario ARS</p>
          <h3 className="text-3xl font-black mt-2 text-emerald-300">{formatCurrency(metrics.valorInventario)}</h3>
          <p className="text-sm text-gray-400 mt-2">Valuación consolidada de stock actual.</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Órdenes activas</p>
          <h3 className="text-3xl font-black mt-2 text-blue-300">{metrics.ordenesActivas}</h3>
          <p className="text-sm text-gray-400 mt-2">Órdenes abiertas entre pendientes y en proceso.</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Alertas automáticas</p>
          <h3 className="text-3xl font-black mt-2 text-red-300">{metrics.alertasAutomaticas}</h3>
          <p className="text-sm text-gray-400 mt-2">Total de alertas entre MP y productos terminados.</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Producción del día</p>
          <h3 className="text-3xl font-black mt-2 text-cyan-300">{metrics.produccionDelDia.toLocaleString("es-AR")} kg</h3>
          <p className="text-sm text-gray-400 mt-2">Volumen finalizado en lotes productivos.</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Stock materia prima</p>
          <h3 className="text-3xl font-black mt-2 text-violet-300">{metrics.totalStockMP.toLocaleString("es-AR")} kg</h3>
          <p className="text-sm text-gray-400 mt-2">Disponibilidad base para continuidad productiva.</p>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Últimos movimientos</h2>
              <p className="text-sm text-gray-400 mt-1">Cambios recientes en stock y disponibilidad por lote.</p>
            </div>
            <FiArrowUpRight className="text-cyan-300" />
          </div>

          <div className="space-y-3">
            {ultimosMovimientos.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.titulo}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.detalle}</p>
                  </div>
                  <p className="text-sm font-medium text-cyan-200">{item.cantidad}</p>
                </div>
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${item.restante}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold mb-4">Indicadores visuales</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Stock MP</span>
                <span className="text-cyan-200">{metrics.stockPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyan-500" style={{ width: `${metrics.stockPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Producción</span>
                <span className="text-emerald-200">{metrics.produccionPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${metrics.produccionPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Costos</span>
                <span className="text-amber-200">{metrics.costoPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${metrics.costoPercent}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Costo promedio actual: {formatCurrency(metrics.costoPromedioKg)} / kg
              </p>
            </div>
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Órdenes recientes</h2>
            <p className="text-sm text-gray-400 mt-1">Seguimiento rápido del avance operativo por orden.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-gray-400 text-sm">
                <th className="py-3">Lote</th>
                <th className="py-3">Producto</th>
                <th className="py-3">Responsable</th>
                <th className="py-3">Objetivo</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ordenesRecientes.map((orden) => {
                const estadoClass =
                  orden.estado === EstadoOrden.FINALIZADO
                    ? "bg-emerald-500/20 text-emerald-300"
                    : orden.estado === EstadoOrden.EN_PROCESO
                      ? "bg-blue-500/20 text-blue-300"
                      : orden.estado === EstadoOrden.ANULADO
                        ? "bg-gray-500/25 text-gray-300"
                        : "bg-amber-500/20 text-amber-300";

                return (
                  <tr key={orden.id} className="border-b border-white/5">
                    <td className="py-3 text-sm font-medium">{orden.lote || "Sin lote"}</td>
                    <td className="py-3 text-sm text-gray-300">{orden.nombre_producto || "Sin producto"}</td>
                    <td className="py-3 text-sm text-gray-300">{orden.usuario_responsable || "Sin responsable"}</td>
                    <td className="py-3 text-sm text-gray-300">{(orden.cantidad_objetivo || 0).toLocaleString("es-AR")} kg</td>
                    <td className="py-3 text-sm">
                      <span className={`px-3 py-1 rounded-lg ${estadoClass}`}>{orden.estado}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="flex items-start gap-3">
          <FiPackage className="text-cyan-300 mt-1" />
          <div>
            <h3 className="font-semibold">Inventario por lotes</h3>
            <p className="text-sm text-gray-400 mt-1">Trazabilidad más clara para sostener abastecimiento y continuidad de producción.</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <FiClipboard className="text-emerald-300 mt-1" />
          <div>
            <h3 className="font-semibold">Ejecución de órdenes</h3>
            <p className="text-sm text-gray-400 mt-1">Seguimiento directo de objetivos, estado y responsables por lote operativo.</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <FiAlertTriangle className="text-amber-300 mt-1" />
          <div>
            <h3 className="font-semibold">Gestión de alertas</h3>
            <p className="text-sm text-gray-400 mt-1">Priorización temprana de insumos críticos para reducir riesgo de quiebre.</p>
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Accesos rápidos de gestión</h3>
            <p className="text-sm text-gray-400 mt-1">Navegación directa a módulos comerciales y de costos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={ROUTES.CLIENTES} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2">
              <FiUsers size={14} /> Clientes
            </Link>
            <Link to={ROUTES.STOCK} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2">
              <FiTruck size={14} /> Resumen de Stock
            </Link>
            <Link to={ROUTES.COSTOS} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2">
              <FiClipboard size={14} /> Costos
            </Link>
            <Link to={ROUTES.TRAZABILIDAD} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2">
              <FiPackage size={14} /> Trazabilidad
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
