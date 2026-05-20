import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";

type EstadoProducto = "OK" | "Bajo" | "Crítico";

interface ProductoComercial {
  uid: string;
  nombre: string;
  stockKg: number;
  silo: string;
  costoArsTon: number;
  ultimaProduccion: string;
  formula: string;
  ultimaOrden: string;
}

interface IngredienteComercial {
  nombre: string;
  porcentaje: number;
}

interface FormulaComercial {
  nombre: string;
  version: number;
  ingredientes: IngredienteComercial[];
  costoArsTon: number;
}

interface StockDetalleComercial {
  capacidadSiloKg: number;
  notaSalida: string;
}

const productosComerciales: ProductoComercial[] = [
  {
    uid: "pt-001",
    nombre: "Alimento Lechera",
    stockKg: 18400,
    silo: "Silo PT-01",
    costoArsTon: 196500,
    ultimaProduccion: "2026-05-18",
    formula: "Lechera Alta Producción v3",
    ultimaOrden: "OP-458",
  },
  {
    uid: "pt-002",
    nombre: "Pellet Cerdo Crecimiento",
    stockKg: 7900,
    silo: "Silo PT-02",
    costoArsTon: 214200,
    ultimaProduccion: "2026-05-17",
    formula: "Cerdo Crecimiento 28-70 v2",
    ultimaOrden: "OP-455",
  },
  {
    uid: "pt-003",
    nombre: "Recría 18%",
    stockKg: 3200,
    silo: "Silo PT-03",
    costoArsTon: 228900,
    ultimaProduccion: "2026-05-14",
    formula: "Recría Engorde 350kg v1",
    ultimaOrden: "OP-449",
  },
  {
    uid: "pt-004",
    nombre: "Engorde Intensivo",
    stockKg: 5600,
    silo: "Silo PT-04",
    costoArsTon: 221400,
    ultimaProduccion: "2026-05-16",
    formula: "Engorde Intensivo v2",
    ultimaOrden: "OP-452",
  },
];

const formulasComerciales: Record<string, FormulaComercial> = {
  "pt-001": {
    nombre: "Lechera Alta Producción",
    version: 3,
    costoArsTon: 196500,
    ingredientes: [
      { nombre: "Maíz", porcentaje: 30 },
      { nombre: "Soja", porcentaje: 22 },
      { nombre: "Afrechillo", porcentaje: 18 },
      { nombre: "Núcleo vitamínico", porcentaje: 5 },
      { nombre: "Sal", porcentaje: 1 },
      { nombre: "Otros", porcentaje: 24 },
    ],
  },
  "pt-002": {
    nombre: "Cerdo Crecimiento 28-70",
    version: 2,
    costoArsTon: 214200,
    ingredientes: [
      { nombre: "Maíz", porcentaje: 42 },
      { nombre: "Soja", porcentaje: 26 },
      { nombre: "Afrechillo", porcentaje: 18 },
      { nombre: "Núcleo vitamínico", porcentaje: 4 },
      { nombre: "Sal", porcentaje: 2 },
      { nombre: "Otros", porcentaje: 8 },
    ],
  },
  "pt-003": {
    nombre: "Recría Engorde 18%",
    version: 1,
    costoArsTon: 228900,
    ingredientes: [
      { nombre: "Maíz", porcentaje: 36 },
      { nombre: "Soja", porcentaje: 28 },
      { nombre: "Afrechillo", porcentaje: 14 },
      { nombre: "Núcleo vitamínico", porcentaje: 6 },
      { nombre: "Sal", porcentaje: 2 },
      { nombre: "Otros", porcentaje: 14 },
    ],
  },
  "pt-004": {
    nombre: "Engorde Intensivo",
    version: 2,
    costoArsTon: 221400,
    ingredientes: [
      { nombre: "Maíz", porcentaje: 40 },
      { nombre: "Soja", porcentaje: 24 },
      { nombre: "Afrechillo", porcentaje: 20 },
      { nombre: "Núcleo vitamínico", porcentaje: 5 },
      { nombre: "Sal", porcentaje: 1 },
      { nombre: "Otros", porcentaje: 10 },
    ],
  },
};

const stockDetalleComercial: Record<string, StockDetalleComercial> = {
  "pt-001": {
    capacidadSiloKg: 30000,
    notaSalida: "Sin dato",
  },
  "pt-002": {
    capacidadSiloKg: 22000,
    notaSalida: "Próxima salida estimada a cliente mayorista en etapa operativa.",
  },
  "pt-003": {
    capacidadSiloKg: 18000,
    notaSalida: "Sin dato",
  },
  "pt-004": {
    capacidadSiloKg: 25000,
    notaSalida: "Reserva de despacho proyectada; integración comercial en etapa operativa.",
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const formatKg = (value: number) => `${value.toLocaleString("es-AR")} kg`;

const formatTon = (value: number) => `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ton`;

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const getStatusByRatio = (stockKg: number, capacidadKg: number): EstadoProducto => {
  if (capacidadKg <= 0) return "Crítico";
  const ratio = (stockKg / capacidadKg) * 100;
  if (ratio <= 20) return "Crítico";
  if (ratio <= 40) return "Bajo";
  return "OK";
};

const getStatusStyles = (status: EstadoProducto) => {
  if (status === "Crítico") return "bg-red-500/20 text-red-300";
  if (status === "Bajo") return "bg-amber-500/20 text-amber-300";
  return "bg-emerald-500/20 text-emerald-300";
};

const getRecomendacionOperativa = (estado: EstadoProducto) => {
  if (estado === "Crítico") return "Priorizar orden inmediata y reservar capacidad de silo para reposición.";
  if (estado === "Bajo") return "Programar corrida de producción en el próximo turno operativo.";
  return "Mantener ritmo actual y monitorear cobertura comercial semanal.";
};

const openFormulaDetail = (producto: ProductoComercial) => {
  const formula = formulasComerciales[producto.uid];
  const ingredientes = formula?.ingredientes ?? [];
  const costoTon = formula?.costoArsTon ?? producto.costoArsTon;

  const ingredientesHtml = ingredientes.length
    ? ingredientes
        .map((item) => {
          const kgTon = item.porcentaje * 10;
          return `<tr>
            <td style="padding: 8px 0; color: #e5e7eb;">${item.nombre}</td>
            <td style="padding: 8px 0; color: #93c5fd; text-align: right;">${item.porcentaje}%</td>
            <td style="padding: 8px 0; color: #cbd5e1; text-align: right;">${kgTon.toLocaleString("es-AR")} kg/ton</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" style="padding: 8px 0; color: #9ca3af;">Sin dato</td></tr>`;

  void Swal.fire({
    title: `Fórmula de ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <p style="margin:0 0 6px;"><strong>Fórmula asociada:</strong> ${formula?.nombre ?? "Sin dato"}</p>
        <p style="margin:0 0 14px;"><strong>Versión:</strong> ${formula ? `v${formula.version}` : "Sin dato"}</p>
        <table style="width:100%; border-collapse:collapse; border-top:1px solid rgba(255,255,255,0.12); border-bottom:1px solid rgba(255,255,255,0.12); margin: 8px 0 12px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px 0; color:#93c5fd;">Ingrediente</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">%</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">kg/ton</th>
            </tr>
          </thead>
          <tbody>${ingredientesHtml}</tbody>
        </table>
        <p style="margin:0 0 6px;"><strong>Costo estimado por tonelada:</strong> ${formatCurrency(costoTon)}</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Cerrar",
    width: 760,
  });
};

const openStockDetail = (producto: ProductoComercial) => {
  const detalle = stockDetalleComercial[producto.uid];
  const formula = formulasComerciales[producto.uid];
  const capacidad = detalle?.capacidadSiloKg ?? 0;
  const ocupacion = capacidad > 0 ? Math.min(100, Math.round((producto.stockKg / capacidad) * 100)) : 0;
  const valorEstimado = (producto.stockKg / 1000) * producto.costoArsTon;
  const estado = getStatusByRatio(producto.stockKg, capacidad);
  const ingredientes = formula?.ingredientes.slice(0, 4).map((item) => item.nombre).join(", ") || "Sin dato";

  void Swal.fire({
    title: `Ficha técnica · ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Fórmula asociada:</strong> ${producto.formula}</p>
        <p style="margin:0 0 8px;"><strong>Ingredientes principales:</strong> ${ingredientes}</p>
        <p style="margin:0 0 8px;"><strong>Costo por tonelada:</strong> ${formatCurrency(producto.costoArsTon)}</p>
        <p style="margin:0 0 8px;"><strong>Silo asociado:</strong> ${producto.silo || "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Stock disponible:</strong> ${formatKg(producto.stockKg)}</p>
        <p style="margin:0 0 8px;"><strong>Capacidad estimada silo:</strong> ${capacidad ? formatKg(capacidad) : "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Ocupación:</strong> ${ocupacion}%</p>
        <p style="margin:0 0 8px;"><strong>Estado operativo:</strong> ${estado}</p>
        <p style="margin:0 0 8px;"><strong>Última producción:</strong> ${producto.ultimaProduccion ? formatDate(producto.ultimaProduccion) : "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Valor estimado:</strong> ${formatCurrency(Math.round(valorEstimado))}</p>
        <p style="margin:0 0 8px;"><strong>Recomendación operativa:</strong> ${getRecomendacionOperativa(estado)}</p>
        <p style="margin:0; color:#9ca3af;"><strong>Nota salida/venta:</strong> ${detalle?.notaSalida || "Información disponible en etapa operativa"}</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Cerrar",
    width: 640,
  });
};

const openProgramacionModal = (productoPreseleccionado?: ProductoComercial) => {
  const options = productosComerciales
    .map((producto) => `<option value="${producto.uid}" ${productoPreseleccionado?.uid === producto.uid ? "selected" : ""}>${producto.nombre}</option>`)
    .join("");

  void Swal.fire({
    title: "Programar producción",
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <label style="display:block; margin: 0 0 6px;">Producto</label>
        <select id="prod-select" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">
          <option value="">Seleccionar producto</option>
          ${options}
        </select>
        <label style="display:block; margin: 0 0 6px;">Cantidad a producir</label>
        <input id="prod-cantidad" type="number" min="1" step="100" placeholder="Ej: 10000" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin: 0 0 6px;">Unidad</label>
        <select id="prod-unidad" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">
          <option value="kg">kg</option>
          <option value="ton">ton</option>
        </select>
        <label style="display:block; margin: 0 0 6px;">Fecha estimada</label>
        <input id="prod-fecha" type="date" style="width:100%; margin-bottom:12px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <p id="prod-formula" style="margin:0 0 6px; color:#cbd5e1;"><strong>Fórmula sugerida:</strong> Sin dato</p>
        <p id="prod-silo" style="margin:0 0 6px; color:#cbd5e1;"><strong>Silo destino:</strong> Sin dato</p>
        <p id="prod-mp" style="margin:0; color:#9ca3af;"><strong>Stock materia prima estimado:</strong> Información disponible en etapa operativa</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Programar",
    cancelButtonText: "Cerrar",
    width: 680,
    didOpen: () => {
      const select = document.getElementById("prod-select") as HTMLSelectElement | null;
      const formulaLine = document.getElementById("prod-formula");
      const siloLine = document.getElementById("prod-silo");
      const stockLine = document.getElementById("prod-mp");
      const fechaInput = document.getElementById("prod-fecha") as HTMLInputElement | null;

      if (fechaInput) {
        const today = new Date();
        const isoDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
        fechaInput.value = isoDate;
      }

      const refreshPreview = () => {
        const selected = productosComerciales.find((item) => item.uid === select?.value);
        const formula = selected ? formulasComerciales[selected.uid] : null;
        if (formulaLine) {
          formulaLine.innerHTML = `<strong>Fórmula sugerida:</strong> ${formula ? `${formula.nombre} v${formula.version}` : "Sin dato"}`;
        }
        if (siloLine) {
          siloLine.innerHTML = `<strong>Silo destino:</strong> ${selected?.silo || "Sin dato"}`;
        }
        if (stockLine) {
          stockLine.innerHTML = `<strong>Stock materia prima estimado:</strong> ${selected ? "Cobertura operativa suficiente para 1 lote estándar." : "Información disponible en etapa operativa"}`;
        }
      };

      select?.addEventListener("change", refreshPreview);
      refreshPreview();
    },
    preConfirm: () => {
      const selectedUid = (document.getElementById("prod-select") as HTMLSelectElement | null)?.value;
      const cantidadRaw = (document.getElementById("prod-cantidad") as HTMLInputElement | null)?.value;
      const unidad = (document.getElementById("prod-unidad") as HTMLSelectElement | null)?.value || "kg";
      const fecha = (document.getElementById("prod-fecha") as HTMLInputElement | null)?.value;

      const selected = productosComerciales.find((item) => item.uid === selectedUid);
      const cantidad = Number(cantidadRaw);

      if (!selected) {
        Swal.showValidationMessage("Seleccioná un producto para programar.");
        return;
      }

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        Swal.showValidationMessage("Ingresá una cantidad válida mayor a 0.");
        return;
      }

      return {
        producto: selected,
        formula: formulasComerciales[selected.uid],
        cantidad,
        unidad,
        fecha: fecha || "Sin dato",
      };
    },
  }).then((result) => {
    if (!result.isConfirmed || !result.value) return;

    const { producto, formula, cantidad, unidad, fecha } = result.value as {
      producto: ProductoComercial;
      formula?: FormulaComercial;
      cantidad: number;
      unidad: string;
      fecha: string;
    };

    const cantidadLabel = unidad === "ton" ? formatTon(cantidad) : formatKg(cantidad);
    void Swal.fire({
      icon: "success",
      title: "Programación preparada",
      html: `
        <div style="text-align:left; color:#f8fafc; font-size:14px;">
          <p style="margin:0 0 8px;">Orden preparada para <strong>${cantidadLabel}</strong> de <strong>${producto.nombre}</strong>, usando fórmula <strong>${formula ? `${formula.nombre} v${formula.version}` : "Sin dato"}</strong>.</p>
          <p style="margin:0 0 8px;"><strong>Silo destino:</strong> ${producto.silo || "Sin dato"}</p>
          <p style="margin:0;"><strong>Fecha estimada:</strong> ${fecha === "Sin dato" ? "Sin dato" : formatDate(fecha)}</p>
        </div>
      `,
      background: "#0d121b",
      color: "#fff",
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Aceptar",
    });
  });
};

const ProductosPage = () => {
  const productosConMetricas = productosComerciales.map((item) => {
    const capacidadKg = stockDetalleComercial[item.uid]?.capacidadSiloKg || 0;
    const ocupacionPct = capacidadKg > 0 ? Math.min(100, Math.round((item.stockKg / capacidadKg) * 100)) : 0;
    const estado = getStatusByRatio(item.stockKg, capacidadKg);
    const valorEstimado = (item.stockKg / 1000) * item.costoArsTon;

    return {
      ...item,
      capacidadKg,
      ocupacionPct,
      estado,
      valorEstimado,
    };
  });

  const totalStock = productosConMetricas.reduce((acc, item) => acc + item.stockKg, 0);
  const productosConRiesgo = productosConMetricas.filter((item) => item.estado !== "OK").length;
  const valorEstimado = productosConMetricas.reduce((acc, item) => acc + item.valorEstimado, 0);
  const capacidadPromedio = productosConMetricas.length
    ? Math.round(productosConMetricas.reduce((acc, item) => acc + item.ocupacionPct, 0) / productosConMetricas.length)
    : 0;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Inventario</p>
        <h1 className="text-3xl font-bold mt-2">Stock de Productos Terminados</h1>
        <p className="text-gray-400 mt-2">Control operativo de producto terminado con alertas automáticas, capacidad y valorización en ARS.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Stock total PT</p>
          <h2 className="text-3xl font-black mt-2">{totalStock.toLocaleString("es-AR")} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Productos críticos/bajos</p>
          <h2 className="text-3xl font-black mt-2 text-amber-300">{productosConRiesgo}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Valor estimado PT</p>
          <h2 className="text-2xl font-black mt-2 text-blue-300">{formatCurrency(Math.round(valorEstimado))}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Capacidad ocupada promedio</p>
          <h2 className="text-3xl font-black mt-2 text-cyan-300">{capacidadPromedio}%</h2>
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">Stock de Productos Terminados</h2>
          <button
            type="button"
            onClick={() => openProgramacionModal()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            Registrar producción
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1300px]">
            <thead>
              <tr className="text-left border-b border-white/10 text-gray-400 text-sm">
                <th className="pb-3">Producto</th>
                <th className="pb-3">Fórmula asociada</th>
                <th className="pb-3">Silo</th>
                <th className="pb-3">Stock disponible</th>
                <th className="pb-3">Capacidad</th>
                <th className="pb-3">Ocupación %</th>
                <th className="pb-3">Costo estimado ARS/ton</th>
                <th className="pb-3">Valor estimado ARS</th>
                <th className="pb-3">Última producción</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosConMetricas.map((producto) => (
                <tr key={producto.uid} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 font-medium">{producto.nombre}</td>
                  <td className="py-3">{producto.formula}</td>
                  <td className="py-3">{producto.silo || "Sin dato"}</td>
                  <td className="py-3">{formatKg(producto.stockKg)}</td>
                  <td className="py-3">{producto.capacidadKg > 0 ? formatKg(producto.capacidadKg) : "Sin dato"}</td>
                  <td className="py-3">{producto.ocupacionPct}%</td>
                  <td className="py-3">{formatCurrency(producto.costoArsTon)}/ton</td>
                  <td className="py-3">{formatCurrency(Math.round(producto.valorEstimado))}</td>
                  <td className="py-3">{formatDate(producto.ultimaProduccion)}</td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusStyles(producto.estado)}`}>
                      {producto.estado}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openFormulaDetail(producto)}
                        className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                      >
                        Ver fórmula
                      </button>
                      <button
                        type="button"
                        onClick={() => openStockDetail(producto)}
                        className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                      >
                        Ver stock
                      </button>
                      <button
                        type="button"
                        onClick={() => openProgramacionModal(producto)}
                        className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                      >
                        Programar producción
                      </button>
                    </div>
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

export default ProductosPage;
