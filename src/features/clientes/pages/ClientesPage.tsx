import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";

type EstadoCliente = "Activo" | "En riesgo" | "Suspendido";

interface ClienteDemo {
  uid: string;
  nombre: string;
  segmento: string;
  ubicacion: string;
  contacto: string;
  estado: EstadoCliente;
  ultimaCompra: string;
  saldoPendienteArs: number;
  productoPrincipal: string;
}

interface CompraDemo {
  fecha: string;
  producto: string;
  cantidadKg: number;
  montoArs: number;
  estado: "Entregado" | "Pendiente" | "Facturado";
}

interface FacturaDemo {
  numero: string;
  fecha: string;
  vencimiento: string;
  montoArs: number;
  estado: "pendiente" | "pagado" | "vencido";
}

interface CuentaCorrienteDemo {
  limiteCreditoArs: number;
  condicionPago: string;
  facturas: FacturaDemo[];
}

interface ClienteInfoDemo {
  notasComerciales: string;
  observaciones: string;
  historialCompras: CompraDemo[];
  cuentaCorriente: CuentaCorrienteDemo;
}

const clientesDemo: ClienteDemo[] = [
  {
    uid: "cli-001",
    nombre: "Estancia La Esperanza",
    segmento: "Tambo",
    ubicacion: "Rafaela, Santa Fe",
    contacto: "Marina Gómez · +54 3492 445112",
    estado: "Activo",
    ultimaCompra: "2026-05-15",
    saldoPendienteArs: 325000,
    productoPrincipal: "Alimento Lechera",
  },
  {
    uid: "cli-002",
    nombre: "Agropecuaria Don Sergio",
    segmento: "Mixto agrícola-ganadero",
    ubicacion: "Pergamino, Buenos Aires",
    contacto: "Julián Díaz · +54 2477 518223",
    estado: "En riesgo",
    ultimaCompra: "2026-05-08",
    saldoPendienteArs: 1185000,
    productoPrincipal: "Ración Recría/Engorde",
  },
  {
    uid: "cli-003",
    nombre: "Tambo San Miguel",
    segmento: "Tambo",
    ubicacion: "Villa María, Córdoba",
    contacto: "Natalia Ferreyra · +54 353 4869012",
    estado: "Activo",
    ultimaCompra: "2026-05-17",
    saldoPendienteArs: 0,
    productoPrincipal: "Alimento Lechera",
  },
  {
    uid: "cli-004",
    nombre: "Feedlot Los Álamos",
    segmento: "Feedlot",
    ubicacion: "Trenque Lauquen, Buenos Aires",
    contacto: "Federico Luna · +54 2392 441908",
    estado: "Suspendido",
    ultimaCompra: "2026-04-26",
    saldoPendienteArs: 2400000,
    productoPrincipal: "Ración Recría/Engorde",
  },
  {
    uid: "cli-005",
    nombre: "Distribuidora Rural Norte",
    segmento: "Distribución",
    ubicacion: "Resistencia, Chaco",
    contacto: "Lucía Benítez · +54 362 4559012",
    estado: "Activo",
    ultimaCompra: "2026-05-12",
    saldoPendienteArs: 780000,
    productoPrincipal: "Pellet Cerdo Crecimiento",
  },
];

const clientesInfoDemo: Record<string, ClienteInfoDemo> = {
  "cli-001": {
    notasComerciales: "Cliente estable con compras quincenales y foco en eficiencia de conversión.",
    observaciones: "Priorizar seguimiento de volumen para campaña de invierno.",
    historialCompras: [
      { fecha: "2026-05-15", producto: "Alimento Lechera", cantidadKg: 18000, montoArs: 3537000, estado: "Facturado" },
      { fecha: "2026-05-02", producto: "Alimento Lechera", cantidadKg: 12000, montoArs: 2358000, estado: "Entregado" },
      { fecha: "2026-04-20", producto: "Núcleo Vitamínico", cantidadKg: 600, montoArs: 954000, estado: "Entregado" },
    ],
    cuentaCorriente: {
      limiteCreditoArs: 2500000,
      condicionPago: "30 días fecha factura",
      facturas: [
        { numero: "FAC-0001-004587", fecha: "2026-05-15", vencimiento: "2026-06-14", montoArs: 3537000, estado: "pendiente" },
        { numero: "FAC-0001-004542", fecha: "2026-05-02", vencimiento: "2026-06-01", montoArs: 2358000, estado: "pagado" },
      ],
    },
  },
  "cli-002": {
    notasComerciales: "Cliente con alto volumen, pero tensionado por cobranzas en los últimos 45 días.",
    observaciones: "Revisar condición de pago y plan de regularización comercial.",
    historialCompras: [
      { fecha: "2026-05-08", producto: "Ración Recría/Engorde", cantidadKg: 25000, montoArs: 5722500, estado: "Pendiente" },
      { fecha: "2026-04-27", producto: "Ración Recría/Engorde", cantidadKg: 15000, montoArs: 3433500, estado: "Facturado" },
      { fecha: "2026-04-11", producto: "Afrechillo", cantidadKg: 8000, montoArs: 1160000, estado: "Entregado" },
    ],
    cuentaCorriente: {
      limiteCreditoArs: 1800000,
      condicionPago: "21 días",
      facturas: [
        { numero: "FAC-0001-004566", fecha: "2026-05-08", vencimiento: "2026-05-29", montoArs: 5722500, estado: "vencido" },
        { numero: "FAC-0001-004513", fecha: "2026-04-27", vencimiento: "2026-05-18", montoArs: 3433500, estado: "pendiente" },
        { numero: "FAC-0001-004477", fecha: "2026-04-11", vencimiento: "2026-05-02", montoArs: 1160000, estado: "pagado" },
      ],
    },
  },
  "cli-003": {
    notasComerciales: "Cuenta saneada; excelente comportamiento de pago y recompra semanal.",
    observaciones: "Apto para propuesta de volumen trimestral.",
    historialCompras: [
      { fecha: "2026-05-17", producto: "Alimento Lechera", cantidadKg: 14500, montoArs: 2849250, estado: "Entregado" },
      { fecha: "2026-05-06", producto: "Alimento Lechera", cantidadKg: 9500, montoArs: 1866750, estado: "Facturado" },
    ],
    cuentaCorriente: {
      limiteCreditoArs: 2000000,
      condicionPago: "Contado contra entrega",
      facturas: [
        { numero: "FAC-0001-004598", fecha: "2026-05-17", vencimiento: "2026-05-17", montoArs: 2849250, estado: "pagado" },
        { numero: "FAC-0001-004553", fecha: "2026-05-06", vencimiento: "2026-05-06", montoArs: 1866750, estado: "pagado" },
      ],
    },
  },
  "cli-004": {
    notasComerciales: "Cuenta suspendida de forma preventiva por mora acumulada.",
    observaciones: "No liberar nuevos despachos hasta regularización mínima.",
    historialCompras: [
      { fecha: "2026-04-26", producto: "Ración Recría/Engorde", cantidadKg: 30000, montoArs: 6867000, estado: "Pendiente" },
      { fecha: "2026-04-12", producto: "Ración Recría/Engorde", cantidadKg: 22000, montoArs: 5035800, estado: "Pendiente" },
    ],
    cuentaCorriente: {
      limiteCreditoArs: 1500000,
      condicionPago: "15 días",
      facturas: [
        { numero: "FAC-0001-004521", fecha: "2026-04-26", vencimiento: "2026-05-11", montoArs: 6867000, estado: "vencido" },
        { numero: "FAC-0001-004489", fecha: "2026-04-12", vencimiento: "2026-04-27", montoArs: 5035800, estado: "vencido" },
      ],
    },
  },
  "cli-005": {
    notasComerciales: "Canal de distribución en crecimiento, con buen mix de productos porcinos.",
    observaciones: "Proponer convenio de volumen mensual con bonificación.",
    historialCompras: [
      { fecha: "2026-05-12", producto: "Pellet Cerdo Crecimiento", cantidadKg: 20000, montoArs: 4284000, estado: "Facturado" },
      { fecha: "2026-04-29", producto: "Pellet Cerdo Crecimiento", cantidadKg: 14000, montoArs: 2998800, estado: "Entregado" },
      { fecha: "2026-04-14", producto: "Sal", cantidadKg: 1000, montoArs: 180000, estado: "Entregado" },
    ],
    cuentaCorriente: {
      limiteCreditoArs: 3200000,
      condicionPago: "30/60 días mixto",
      facturas: [
        { numero: "FAC-0001-004571", fecha: "2026-05-12", vencimiento: "2026-06-11", montoArs: 4284000, estado: "pendiente" },
        { numero: "FAC-0001-004527", fecha: "2026-04-29", vencimiento: "2026-05-29", montoArs: 2998800, estado: "pagado" },
      ],
    },
  },
};

const statusStyle: Record<EstadoCliente, string> = {
  Activo: "bg-emerald-500/20 text-emerald-300",
  "En riesgo": "bg-amber-500/20 text-amber-300",
  Suspendido: "bg-red-500/20 text-red-300",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const formatKg = (value: number) => `${value.toLocaleString("es-AR")} kg`;

const openDetalleCliente = (cliente: ClienteDemo) => {
  const info = clientesInfoDemo[cliente.uid];
  const historial = info?.historialCompras ?? [];
  const historialRows = historial.length
    ? historial
        .map(
          (item) => `<tr>
              <td style="padding: 6px 0; color:#e5e7eb;">${formatDate(item.fecha)}</td>
              <td style="padding: 6px 0; color:#e5e7eb;">${item.producto || "Sin dato"}</td>
              <td style="padding: 6px 0; text-align:right; color:#cbd5e1;">${formatKg(item.cantidadKg)}</td>
              <td style="padding: 6px 0; text-align:right; color:#93c5fd;">${formatCurrency(item.montoArs)}</td>
              <td style="padding: 6px 0; text-align:right; color:#cbd5e1;">${item.estado}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="padding: 8px 0; color:#9ca3af;">Sin dato</td></tr>`;

  void Swal.fire({
    title: `Detalle de ${cliente.nombre}`,
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <p style="margin:0 0 6px;"><strong>Segmento:</strong> ${cliente.segmento || "Sin dato"}</p>
        <p style="margin:0 0 6px;"><strong>Ubicación:</strong> ${cliente.ubicacion || "Sin dato"}</p>
        <p style="margin:0 0 6px;"><strong>Contacto:</strong> ${cliente.contacto || "Sin dato"}</p>
        <p style="margin:0 0 6px;"><strong>Estado:</strong> ${cliente.estado || "Sin dato"}</p>
        <p style="margin:0 0 6px;"><strong>Producto principal:</strong> ${cliente.productoPrincipal || "Sin dato"}</p>
        <p style="margin:0 0 6px;"><strong>Última compra:</strong> ${cliente.ultimaCompra ? formatDate(cliente.ultimaCompra) : "Sin dato"}</p>
        <p style="margin:0 0 10px;"><strong>Cuenta pendiente:</strong> ${formatCurrency(cliente.saldoPendienteArs)}</p>
        <p style="margin:0 0 12px; color:#9ca3af;"><strong>Notas comerciales:</strong> ${info?.notasComerciales || "Sin dato"}</p>
        <h4 style="margin:0 0 8px; color:#93c5fd; font-size:13px; text-transform:uppercase;">Historial compras demo</h4>
        <table style="width:100%; border-collapse:collapse; border-top:1px solid rgba(255,255,255,0.12); border-bottom:1px solid rgba(255,255,255,0.12);">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px 0; color:#93c5fd;">Fecha</th>
              <th style="text-align:left; padding:8px 0; color:#93c5fd;">Producto</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">Cantidad</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">Monto</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">Estado</th>
            </tr>
          </thead>
          <tbody>${historialRows}</tbody>
        </table>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Cerrar",
    width: 860,
  });
};

const openCuentaCorriente = (cliente: ClienteDemo) => {
  const cuenta = clientesInfoDemo[cliente.uid]?.cuentaCorriente;
  const facturas = cuenta?.facturas ?? [];
  const totalFacturado = facturas.reduce((acc, item) => acc + item.montoArs, 0);
  const totalPendiente = facturas.filter((item) => item.estado !== "pagado").reduce((acc, item) => acc + item.montoArs, 0);
  const totalVencido = facturas.filter((item) => item.estado === "vencido").reduce((acc, item) => acc + item.montoArs, 0);

  const facturaRows = facturas.length
    ? facturas
        .map(
          (factura) => `<tr>
            <td style="padding:6px 0; color:#e5e7eb;">${factura.numero || "Sin dato"}</td>
            <td style="padding:6px 0; color:#e5e7eb;">${factura.fecha ? formatDate(factura.fecha) : "Sin dato"}</td>
            <td style="padding:6px 0; color:#e5e7eb;">${factura.vencimiento ? formatDate(factura.vencimiento) : "Sin dato"}</td>
            <td style="padding:6px 0; text-align:right; color:#93c5fd;">${formatCurrency(factura.montoArs)}</td>
            <td style="padding:6px 0; text-align:right; color:#cbd5e1; text-transform:capitalize;">${factura.estado}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="padding:8px 0; color:#9ca3af;">Sin dato</td></tr>`;

  void Swal.fire({
    title: `Cuenta corriente · ${cliente.nombre}`,
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <p style="margin:0 0 6px;"><strong>Saldo pendiente:</strong> ${formatCurrency(cliente.saldoPendienteArs)}</p>
        <p style="margin:0 0 6px;"><strong>Límite de crédito demo:</strong> ${cuenta ? formatCurrency(cuenta.limiteCreditoArs) : "Sin dato"}</p>
        <p style="margin:0 0 10px;"><strong>Condición de pago:</strong> ${cuenta?.condicionPago || "Sin dato"}</p>
        <h4 style="margin:0 0 8px; color:#93c5fd; font-size:13px; text-transform:uppercase;">Facturas demo</h4>
        <table style="width:100%; border-collapse:collapse; border-top:1px solid rgba(255,255,255,0.12); border-bottom:1px solid rgba(255,255,255,0.12); margin-bottom:10px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px 0; color:#93c5fd;">Número</th>
              <th style="text-align:left; padding:8px 0; color:#93c5fd;">Fecha</th>
              <th style="text-align:left; padding:8px 0; color:#93c5fd;">Vencimiento</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">Monto</th>
              <th style="text-align:right; padding:8px 0; color:#93c5fd;">Estado</th>
            </tr>
          </thead>
          <tbody>${facturaRows}</tbody>
        </table>
        <p style="margin:0 0 6px;"><strong>Total facturado:</strong> ${formatCurrency(totalFacturado)}</p>
        <p style="margin:0 0 6px;"><strong>Total pendiente:</strong> ${formatCurrency(totalPendiente)}</p>
        <p style="margin:0; color:#9ca3af;"><strong>Vencido:</strong> ${totalVencido > 0 ? formatCurrency(totalVencido) : "Sin dato"}</p>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Cerrar",
    width: 900,
  });
};

const openEditarCliente = (cliente: ClienteDemo) => {
  const info = clientesInfoDemo[cliente.uid];
  const [contactoNombre, contactoTelefono] = cliente.contacto.split("·").map((part) => part.trim());

  void Swal.fire({
    title: `Editar cliente (demo)`,
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <label style="display:block; margin:0 0 6px;">Nombre</label>
        <input id="cli-nombre" value="${cliente.nombre}" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Segmento</label>
        <input id="cli-segmento" value="${cliente.segmento}" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Ubicación</label>
        <input id="cli-ubicacion" value="${cliente.ubicacion}" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Contacto</label>
        <input id="cli-contacto" value="${contactoNombre || ""}" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Producto principal</label>
        <input id="cli-producto" value="${cliente.productoPrincipal}" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Estado</label>
        <select id="cli-estado" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">
          <option value="Activo" ${cliente.estado === "Activo" ? "selected" : ""}>Activo</option>
          <option value="En riesgo" ${cliente.estado === "En riesgo" ? "selected" : ""}>En riesgo</option>
          <option value="Suspendido" ${cliente.estado === "Suspendido" ? "selected" : ""}>Suspendido</option>
        </select>
        <label style="display:block; margin:0 0 6px;">Observaciones</label>
        <textarea id="cli-observaciones" rows="3" style="width:100%; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;">${info?.observaciones || contactoTelefono || "Sin dato"}</textarea>
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Guardar demo",
    cancelButtonText: "Cerrar",
    width: 680,
    preConfirm: () => {
      const nombre = (document.getElementById("cli-nombre") as HTMLInputElement | null)?.value.trim();
      const segmento = (document.getElementById("cli-segmento") as HTMLInputElement | null)?.value.trim();
      if (!nombre || !segmento) {
        Swal.showValidationMessage("Nombre y segmento son obligatorios para simular edición.");
        return;
      }
      return true;
    },
  }).then((result) => {
    if (!result.isConfirmed) return;
    void Swal.fire({
      icon: "success",
      title: "Edición simulada",
      text: "Cambios simulados para demo. En la siguiente fase se conectará a persistencia real.",
      background: "#0d121b",
      color: "#fff",
      confirmButtonColor: "#2563eb",
    });
  });
};

const openNuevoCliente = () => {
  void Swal.fire({
    title: "Nuevo cliente (demo)",
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <label style="display:block; margin:0 0 6px;">Nombre</label>
        <input id="new-cli-nombre" placeholder="Nombre o razón social" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Segmento</label>
        <input id="new-cli-segmento" placeholder="Ej: Tambo" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Ubicación</label>
        <input id="new-cli-ubicacion" placeholder="Ciudad, provincia" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Contacto</label>
        <input id="new-cli-contacto" placeholder="Nombre · teléfono" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Producto principal</label>
        <input id="new-cli-producto" placeholder="Producto de mayor demanda" style="width:100%; margin-bottom:10px; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Condición comercial</label>
        <input id="new-cli-condicion" placeholder="Ej: 30 días / contado" style="width:100%; background:#111827; color:#fff; border:1px solid #374151; border-radius:8px; padding:8px;" />
      </div>
    `,
    background: "#0d121b",
    color: "#fff",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Simular alta",
    cancelButtonText: "Cerrar",
    width: 680,
    preConfirm: () => {
      const nombre = (document.getElementById("new-cli-nombre") as HTMLInputElement | null)?.value.trim();
      const segmento = (document.getElementById("new-cli-segmento") as HTMLInputElement | null)?.value.trim();
      if (!nombre || !segmento) {
        Swal.showValidationMessage("Completá al menos nombre y segmento para simular alta.");
        return;
      }
      return true;
    },
  }).then((result) => {
    if (!result.isConfirmed) return;
    void Swal.fire({
      icon: "success",
      title: "Alta simulada",
      text: "Cliente generado solo para demo. En la siguiente fase se conectará a persistencia real.",
      background: "#0d121b",
      color: "#fff",
      confirmButtonColor: "#2563eb",
    });
  });
};

const ClientesPage = () => {
  const [search, setSearch] = useState("");

  const filteredClientes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clientesDemo;
    return clientesDemo.filter((cliente) =>
      [cliente.nombre, cliente.segmento, cliente.ubicacion, cliente.contacto, cliente.productoPrincipal]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  const totalPendiente = filteredClientes.reduce((acc, item) => acc + item.saldoPendienteArs, 0);
  const clientesActivos = filteredClientes.filter((cliente) => cliente.estado === "Activo").length;
  const ultimaVentaRegistrada = filteredClientes.length
    ? filteredClientes.map((cliente) => new Date(`${cliente.ultimaCompra}T00:00:00`).getTime()).reduce((max, current) => Math.max(max, current), 0)
    : null;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Módulo comercial</p>
        <h1 className="text-3xl font-bold mt-2">Clientes</h1>
        <p className="text-gray-400 mt-2">Vista demo para seguimiento comercial, segmentación y cuentas pendientes.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Total clientes</p>
          <h2 className="text-3xl font-black mt-2">{filteredClientes.length}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Clientes activos</p>
          <h2 className="text-3xl font-black mt-2 text-emerald-300">{clientesActivos}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Saldo pendiente</p>
          <h2 className="text-3xl font-black mt-2 text-amber-300">{formatCurrency(totalPendiente)}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-gray-400">Última venta registrada</p>
          <h2 className="text-xl font-black mt-3 text-blue-300">
            {ultimaVentaRegistrada
              ? new Date(ultimaVentaRegistrada).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
              : "Sin dato"}
          </h2>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
          <h2 className="text-xl font-semibold">Listado de clientes</h2>
          <div className="flex gap-2 w-full md:w-auto">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, segmento, ubicación o producto"
              className="w-full md:w-[340px] bg-[#0f1623] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => openNuevoCliente()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-medium"
            >
              Nuevo cliente
            </button>
          </div>
        </div>

        {filteredClientes.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No se encontraron clientes con ese criterio.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="text-left border-b border-white/10 text-gray-400 text-sm">
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Segmento</th>
                  <th className="pb-3">Ubicación</th>
                  <th className="pb-3">Contacto</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3">Producto principal</th>
                  <th className="pb-3">Última compra</th>
                  <th className="pb-3">Cuenta pendiente</th>
                  <th className="pb-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.uid} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 font-medium">{cliente.nombre}</td>
                    <td className="py-3">{cliente.segmento}</td>
                    <td className="py-3">{cliente.ubicacion}</td>
                    <td className="py-3">{cliente.contacto}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[cliente.estado]}`}>
                        {cliente.estado}
                      </span>
                    </td>
                    <td className="py-3">{cliente.productoPrincipal}</td>
                    <td className="py-3">{formatDate(cliente.ultimaCompra)}</td>
                    <td className="py-3">{formatCurrency(cliente.saldoPendienteArs)}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openDetalleCliente(cliente)}
                          className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditarCliente(cliente)}
                          className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openCuentaCorriente(cliente)}
                          className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                        >
                          Cuenta corriente
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientesPage;
