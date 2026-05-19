import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";

type EstadoProducto = "OK" | "Bajo" | "Crítico";

interface ProductoDemo {
  uid: string;
  nombre: string;
  stockKg: number;
  silo: string;
  costoArsTon: number;
  estado: EstadoProducto;
  ultimaProduccion: string;
  formula: string;
  ultimaOrden: string;
}

interface IngredienteDemo {
  nombre: string;
  porcentaje: number;
}

interface FormulaDemo {
  nombre: string;
  version: number;
  ingredientes: IngredienteDemo[];
  costoArsTon: number;
}

interface StockDetalleDemo {
  capacidadSiloKg: number;
  notaSalida: string;
}

const productosDemo: ProductoDemo[] = [
  {
    uid: "pt-001",
    nombre: "Alimento Lechera",
    stockKg: 18400,
    silo: "Silo PT-01",
    costoArsTon: 196500,
    estado: "OK",
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
    estado: "Bajo",
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
    estado: "Crítico",
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
    estado: "Bajo",
    ultimaProduccion: "2026-05-16",
    formula: "Engorde Intensivo v2",
    ultimaOrden: "OP-452",
  },
];

const formulasDemo: Record<string, FormulaDemo> = {
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

const stockDetalleDemo: Record<string, StockDetalleDemo> = {
  "pt-001": {
    capacidadSiloKg: 30000,
    notaSalida: "Sin dato",
  },
  "pt-002": {
    capacidadSiloKg: 22000,
    notaSalida: "Próxima salida estimada a cliente mayorista en siguiente fase.",
  },
  "pt-003": {
    capacidadSiloKg: 18000,
    notaSalida: "Sin dato",
  },
  "pt-004": {
    capacidadSiloKg: 25000,
    notaSalida: "Reserva de despacho proyectada; integración comercial en siguiente fase.",
  },
};

const statusStyle: Record<EstadoProducto, string> = {
  OK: "bg-emerald-500/20 text-emerald-300",
  Bajo: "bg-amber-500/20 text-amber-300",
  Crítico: "bg-red-500/20 text-red-300",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const formatKg = (value: number) => `${value.toLocaleString("es-AR")} kg`;

const formatTon = (value: number) => `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ton`;

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const openFormulaDetail = (producto: ProductoDemo) => {
  const formula = formulasDemo[producto.uid];
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
        <p style="margin:0; color:#9ca3af;">Fórmula demo basada en datos simulados.</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Cerrar",
    width: 760,
  });
};

const openStockDetail = (producto: ProductoDemo) => {
  const detalle = stockDetalleDemo[producto.uid];
  const capacidad = detalle?.capacidadSiloKg ?? 0;
  const ocupacion = capacidad > 0 ? Math.min(100, Math.round((producto.stockKg / capacidad) * 100)) : null;
  const valorEstimado = (producto.stockKg / 1000) * producto.costoArsTon;

  void Swal.fire({
    title: `Stock de ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Silo asociado:</strong> ${producto.silo || "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Stock disponible:</strong> ${formatKg(producto.stockKg)}</p>
        <p style="margin:0 0 8px;"><strong>Capacidad estimada silo:</strong> ${capacidad ? formatKg(capacidad) : "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Ocupación:</strong> ${ocupacion !== null ? `${ocupacion}%` : "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Estado:</strong> ${producto.estado}</p>
        <p style="margin:0 0 8px;"><strong>Última producción:</strong> ${producto.ultimaProduccion ? formatDate(producto.ultimaProduccion) : "Sin dato"}</p>
        <p style="margin:0 0 8px;"><strong>Valor estimado:</strong> ${formatCurrency(Math.round(valorEstimado))}</p>
        <p style="margin:0; color:#9ca3af;"><strong>Nota salida/venta:</strong> ${detalle?.notaSalida || "Siguiente fase"}</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Cerrar",
    width: 640,
  });
};

const openProgramacionModal = (productoPreseleccionado?: ProductoDemo) => {
  const options = productosDemo
    .map((producto) => `<option value="${producto.uid}" ${productoPreseleccionado?.uid === producto.uid ? "selected" : ""}>${producto.nombre}</option>`)
    .join("");

  void Swal.fire({
    title: "Programar producción (demo)",
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
        <p id="prod-mp" style="margin:0; color:#9ca3af;"><strong>Stock materia prima estimado:</strong> Siguiente fase</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Simular programación",
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
        const selected = productosDemo.find((item) => item.uid === select?.value);
        const formula = selected ? formulasDemo[selected.uid] : null;
        if (formulaLine) {
          formulaLine.innerHTML = `<strong>Fórmula sugerida:</strong> ${formula ? `${formula.nombre} v${formula.version}` : "Sin dato"}`;
        }
        if (siloLine) {
          siloLine.innerHTML = `<strong>Silo destino:</strong> ${selected?.silo || "Sin dato"}`;
        }
        if (stockLine) {
          stockLine.innerHTML = `<strong>Stock materia prima estimado:</strong> ${selected ? "Cobertura demo suficiente para 1 lote estándar." : "Siguiente fase"}`;
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

      const selected = productosDemo.find((item) => item.uid === selectedUid);
      const cantidad = Number(cantidadRaw);

      if (!selected) {
        Swal.showValidationMessage("Seleccioná un producto para simular la programación.");
        return;
      }

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        Swal.showValidationMessage("Ingresá una cantidad válida mayor a 0.");
        return;
      }

      return {
        producto: selected,
        formula: formulasDemo[selected.uid],
        cantidad,
        unidad,
        fecha: fecha || "Sin dato",
      };
    },
  }).then((result) => {
    if (!result.isConfirmed || !result.value) return;

    const { producto, formula, cantidad, unidad, fecha } = result.value as {
      producto: ProductoDemo;
      formula?: FormulaDemo;
      cantidad: number;
      unidad: string;
      fecha: string;
    };

    const cantidadLabel = unidad === "ton" ? formatTon(cantidad) : formatKg(cantidad);
    void Swal.fire({
      icon: "success",
      title: "Programación simulada",
      html: `
        <div style="text-align:left; color:#f8fafc; font-size:14px;">
          <p style="margin:0 0 8px;">Orden demo preparada para <strong>${cantidadLabel}</strong> de <strong>${producto.nombre}</strong>, usando fórmula <strong>${formula ? `${formula.nombre} v${formula.version}` : "Sin dato"}</strong>.</p>
          <p style="margin:0 0 8px;"><strong>Silo destino:</strong> ${producto.silo || "Sin dato"}</p>
          <p style="margin:0;"><strong>Fecha estimada:</strong> ${fecha === "Sin dato" ? "Sin dato" : formatDate(fecha)}</p>
          <p style="margin:10px 0 0; color:#9ca3af;">En la siguiente fase se integrará con órdenes reales.</p>
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
  const totalStock = productosDemo.reduce((acc, item) => acc + item.stockKg, 0);
  const productosConRiesgo = productosDemo.filter((item) => item.estado !== "OK").length;
  const valorEstimado = productosDemo.reduce((acc, item) => acc + (item.stockKg / 1000) * item.costoArsTon, 0);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Módulo comercial</p>
        <h1 className="text-3xl font-bold mt-2">Productos Terminados</h1>
        <p className="text-gray-400 mt-2">Vista comercial de stock final y conexión operativa con fórmulas y órdenes.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Total productos</p>
          <h2 className="text-3xl font-black mt-2">{productosDemo.length}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Stock producto terminado</p>
          <h2 className="text-3xl font-black mt-2">{totalStock.toLocaleString("es-AR")} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Producto crítico/bajo</p>
          <h2 className="text-3xl font-black mt-2 text-amber-300">{productosConRiesgo}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Valor estimado ARS</p>
          <h2 className="text-2xl font-black mt-2 text-blue-300">{formatCurrency(Math.round(valorEstimado))}</h2>
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">Productos terminados</h2>
          <button
            type="button"
            onClick={() => openProgramacionModal()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            Registrar producción
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="text-left border-b border-white/10 text-gray-400 text-sm">
                <th className="pb-3">Producto</th>
                <th className="pb-3">Fórmula asociada</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Silo asociado</th>
                <th className="pb-3">Costo estimado</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Última producción</th>
                <th className="pb-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosDemo.map((producto) => (
                <tr key={producto.uid} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 font-medium">{producto.nombre}</td>
                  <td className="py-3">{producto.formula}</td>
                  <td className="py-3">{producto.stockKg.toLocaleString("es-AR")} kg</td>
                  <td className="py-3">{producto.silo}</td>
                  <td className="py-3">{formatCurrency(producto.costoArsTon)}/ton</td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[producto.estado]}`}>
                      {producto.estado}
                    </span>
                  </td>
                  <td className="py-3">{formatDate(producto.ultimaProduccion)}</td>
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
