import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";
import { clienteService } from "../services/clienteService";
import { EstadoCliente, type Cliente, type ClienteCreatePayload, type EstadoCliente as EstadoClienteType } from "../types/cliente";

type ClienteFormPayload = {
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  segmento?: string;
  ubicacion?: string;
  contacto?: string;
  productoPrincipal?: string;
  condicionComercial?: string;
  estado: EstadoClienteType;
  observaciones?: string;
};

const statusStyle: Record<EstadoClienteType, string> = {
  [EstadoCliente.ACTIVO]: "bg-emerald-500/20 text-emerald-300",
  [EstadoCliente.EN_RIESGO]: "bg-amber-500/20 text-amber-300",
  [EstadoCliente.SUSPENDIDO]: "bg-red-500/20 text-red-300",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "Sin dato";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin dato";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
};

const normalizeText = (value?: string | null) => value?.trim() || "Sin dato";

const toInputValue = (value?: string | null) => value ?? "";

const preserveExisting = (rawValue?: string, currentValue?: string | null) => {
  const trimmed = rawValue?.trim() ?? "";
  if (trimmed) return trimmed;
  return currentValue ?? undefined;
};

const buildCreatePayload = (payload: ClienteFormPayload): ClienteCreatePayload => ({
  nombre: payload.nombre,
  razonSocial: payload.razonSocial || payload.nombre,
  cuit: payload.cuit || undefined,
  email: payload.email || undefined,
  telefono: payload.telefono || undefined,
  direccion: payload.direccion || undefined,
  localidad: payload.localidad || undefined,
  provincia: payload.provincia || undefined,
  segmento: payload.segmento || undefined,
  ubicacion: payload.ubicacion || undefined,
  contacto: payload.contacto || undefined,
  productoPrincipal: payload.productoPrincipal || undefined,
  condicionComercial: payload.condicionComercial || undefined,
  estado: payload.estado,
  observaciones: payload.observaciones || undefined,
  saldoPendienteArs: 0,
  estaActivo: payload.estado !== EstadoCliente.SUSPENDIDO,
});

const buildUpdatePayload = (payload: ClienteFormPayload, current: Cliente): Partial<Omit<Cliente, "uid">> => ({
  nombre: preserveExisting(payload.nombre, current.nombre) ?? current.nombre,
  razonSocial: preserveExisting(payload.razonSocial, current.razonSocial) ?? current.nombre,
  cuit: preserveExisting(payload.cuit, current.cuit),
  email: preserveExisting(payload.email, current.email),
  telefono: preserveExisting(payload.telefono, current.telefono),
  direccion: preserveExisting(payload.direccion, current.direccion),
  localidad: preserveExisting(payload.localidad, current.localidad),
  provincia: preserveExisting(payload.provincia, current.provincia),
  segmento: preserveExisting(payload.segmento, current.segmento),
  ubicacion: preserveExisting(payload.ubicacion, current.ubicacion),
  contacto: preserveExisting(payload.contacto, current.contacto),
  productoPrincipal: preserveExisting(payload.productoPrincipal, current.productoPrincipal),
  condicionComercial: preserveExisting(payload.condicionComercial, current.condicionComercial),
  estado: payload.estado,
  observaciones: preserveExisting(payload.observaciones, current.observaciones),
  ultimaCompra: current.ultimaCompra,
  saldoPendienteArs: current.saldoPendienteArs,
  estaActivo: payload.estado !== EstadoCliente.SUSPENDIDO,
  createdAt: current.createdAt,
  updatedAt: current.updatedAt,
});

const openEditarCliente = (cliente: Cliente, onSave: (payload: ClienteFormPayload) => Promise<void>) => {
  void Swal.fire({
    title: "Editar cliente",
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <div style="display:grid; gap:10px;">
          <div style="display:grid; gap:6px;">
            <label for="cli-nombre" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Nombre</label>
            <input id="cli-nombre" value="${toInputValue(cliente.nombre)}" placeholder="Nombre del cliente" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-razonsocial" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Razón social</label>
            <input id="cli-razonsocial" value="${toInputValue(cliente.razonSocial)}" placeholder="Razón social" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-cuit" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">CUIT</label>
            <input id="cli-cuit" value="${toInputValue(cliente.cuit)}" placeholder="CUIT / Documento" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-email" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Email</label>
            <input id="cli-email" value="${toInputValue(cliente.email)}" placeholder="correo@dominio.com" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-telefono" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Teléfono</label>
            <input id="cli-telefono" value="${toInputValue(cliente.telefono)}" placeholder="Número de contacto" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-direccion" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Dirección</label>
            <input id="cli-direccion" value="${toInputValue(cliente.direccion)}" placeholder="Dirección comercial" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-localidad" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Localidad</label>
            <input id="cli-localidad" value="${toInputValue(cliente.localidad)}" placeholder="Ciudad o localidad" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-provincia" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Provincia</label>
            <input id="cli-provincia" value="${toInputValue(cliente.provincia)}" placeholder="Provincia" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-segmento" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Segmento</label>
            <input id="cli-segmento" value="${toInputValue(cliente.segmento)}" placeholder="Ej: Tambo" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-ubicacion" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Ubicación</label>
            <input id="cli-ubicacion" value="${toInputValue(cliente.ubicacion)}" placeholder="Ubicación operativa" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-contacto" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Contacto</label>
            <input id="cli-contacto" value="${toInputValue(cliente.contacto)}" placeholder="Contacto principal" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-producto" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Producto principal</label>
            <input id="cli-producto" value="${toInputValue(cliente.productoPrincipal)}" placeholder="Producto principal" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-condicion" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Condición comercial</label>
            <input id="cli-condicion" value="${toInputValue(cliente.condicionComercial)}" placeholder="Condición comercial" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-estado" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Estado</label>
            <select id="cli-estado" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
              <option value="Activo" ${cliente.estado === "Activo" ? "selected" : ""}>Activo</option>
              <option value="En riesgo" ${cliente.estado === "En riesgo" ? "selected" : ""}>En riesgo</option>
              <option value="Suspendido" ${cliente.estado === "Suspendido" ? "selected" : ""}>Suspendido</option>
            </select>
          </div>
          <div style="display:grid; gap:6px;">
            <label for="cli-observaciones" style="display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Observaciones</label>
            <textarea id="cli-observaciones" rows="3" placeholder="Notas comerciales" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">${toInputValue(cliente.observaciones)}</textarea>
          </div>
          <div style="display:grid; gap:6px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
            <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Última compra</span>
            <span style="color:#0f172a; font-weight:600;">${formatDate(cliente.ultimaCompra)}</span>
          </div>
          <div style="display:grid; gap:6px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
            <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Saldo pendiente</span>
            <span style="color:#0f172a; font-weight:700;">${formatCurrency(cliente.saldoPendienteArs)}</span>
          </div>
          <div style="display:grid; gap:6px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
            <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155;">Activo</span>
            <span style="color:#0f172a; font-weight:600;">${cliente.estaActivo ? "Sí" : "No"}</span>
          </div>
        </div>
      </div>
    `,
    background: "#ffffff",
    color: "#0f172a",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Guardar cambios",
    cancelButtonText: "Cerrar",
    width: 680,
    preConfirm: () => {
      const nombre = (document.getElementById("cli-nombre") as HTMLInputElement | null)?.value.trim();
      if (!nombre) {
        Swal.showValidationMessage("El nombre es obligatorio.");
        return;
      }

      const razonSocial = (document.getElementById("cli-razonsocial") as HTMLInputElement | null)?.value.trim() ?? "";
      const cuit = (document.getElementById("cli-cuit") as HTMLInputElement | null)?.value.trim() ?? "";
      const email = (document.getElementById("cli-email") as HTMLInputElement | null)?.value.trim() ?? "";
      const telefono = (document.getElementById("cli-telefono") as HTMLInputElement | null)?.value.trim() ?? "";
      const direccion = (document.getElementById("cli-direccion") as HTMLInputElement | null)?.value.trim() ?? "";
      const localidad = (document.getElementById("cli-localidad") as HTMLInputElement | null)?.value.trim() ?? "";
      const provincia = (document.getElementById("cli-provincia") as HTMLInputElement | null)?.value.trim() ?? "";
      const segmento = (document.getElementById("cli-segmento") as HTMLInputElement | null)?.value.trim() ?? "";
      const ubicacion = (document.getElementById("cli-ubicacion") as HTMLInputElement | null)?.value.trim() ?? "";
      const contacto = (document.getElementById("cli-contacto") as HTMLInputElement | null)?.value.trim() ?? "";
      const productoPrincipal = (document.getElementById("cli-producto") as HTMLInputElement | null)?.value.trim() ?? "";
      const condicionComercial = (document.getElementById("cli-condicion") as HTMLInputElement | null)?.value.trim() ?? "";
      const estado = ((document.getElementById("cli-estado") as HTMLSelectElement | null)?.value ?? "Activo") as EstadoClienteType;
      const observaciones = (document.getElementById("cli-observaciones") as HTMLTextAreaElement | null)?.value.trim() ?? "";
      return {
        nombre,
        razonSocial,
        cuit,
        email,
        telefono,
        direccion,
        localidad,
        provincia,
        segmento,
        ubicacion,
        contacto,
        productoPrincipal,
        condicionComercial,
        estado,
        observaciones,
      } satisfies ClienteFormPayload;
    },
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;

    await onSave(result.value);
    void Swal.fire({
      icon: "success",
      title: "Actualización guardada",
      text: "Cliente actualizado correctamente en Supabase o en demo local.",
      background: "#ffffff",
      color: "#0f172a",
      confirmButtonColor: "#2563eb",
    });
  });
};

const openNuevoCliente = (onCreate: (payload: ClienteFormPayload) => Promise<void>) => {
  void Swal.fire({
    title: "Nuevo cliente",
    html: `
      <div style="text-align:left; color:#f8fafc; font-size:14px;">
        <label style="display:block; margin:0 0 6px;">Nombre</label>
        <input id="new-cli-nombre" placeholder="Nombre o razón social" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Segmento</label>
        <input id="new-cli-segmento" placeholder="Ej: Tambo" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Ubicación</label>
        <input id="new-cli-ubicacion" placeholder="Ciudad, provincia" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Contacto</label>
        <input id="new-cli-contacto" placeholder="Nombre · teléfono" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Producto principal</label>
        <input id="new-cli-producto" placeholder="Producto de mayor demanda" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #374151; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Observaciones</label>
        <textarea id="new-cli-observaciones" rows="3" placeholder="Notas comerciales" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #374151; border-radius:8px; padding:8px;"></textarea>
      </div>
    `,
    background: "#ffffff",
    color: "#0f172a",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Registrar alta",
    cancelButtonText: "Cerrar",
    width: 680,
    preConfirm: () => {
      const nombre = (document.getElementById("new-cli-nombre") as HTMLInputElement | null)?.value.trim();
      if (!nombre) {
        Swal.showValidationMessage("El nombre es obligatorio.");
        return;
      }

      const segmento = (document.getElementById("new-cli-segmento") as HTMLInputElement | null)?.value.trim() ?? "";
      const ubicacion = (document.getElementById("new-cli-ubicacion") as HTMLInputElement | null)?.value.trim() ?? "";
      const contacto = (document.getElementById("new-cli-contacto") as HTMLInputElement | null)?.value.trim() ?? "";
      const productoPrincipal = (document.getElementById("new-cli-producto") as HTMLInputElement | null)?.value.trim() ?? "";
      const observaciones = (document.getElementById("new-cli-observaciones") as HTMLTextAreaElement | null)?.value.trim() ?? "";
      return { nombre, segmento, ubicacion, contacto, productoPrincipal, estado: EstadoCliente.ACTIVO, observaciones } satisfies ClienteFormPayload;
    },
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;

    await onCreate(result.value);
    void Swal.fire({
      icon: "success",
      title: "Alta guardada",
      text: "Cliente creado correctamente en Supabase o en demo local.",
      background: "#ffffff",
      color: "#0f172a",
      confirmButtonColor: "#2563eb",
    });
  });
};

const buildDetalleHtml = (cliente: Cliente) => `
  <div style="text-align:left; color:#0f172a; font-size:14px;">
    <div style="display:grid; gap:10px;">
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Nombre</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.nombre)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Segmento</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.segmento)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Ubicación</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.ubicacion)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Contacto</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.contacto)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Producto principal</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.productoPrincipal)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Estado</span>
        <span style="color:#1d4ed8; font-weight:700;">${cliente.estado}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Condición comercial</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.condicionComercial)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Última compra</span>
        <span style="color:#0f172a; font-weight:600;">${formatDate(cliente.ultimaCompra)}</span>
      </div>
      <div style="display:grid; gap:3px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Saldo pendiente</span>
        <span style="color:#0f172a; font-weight:800;">${formatCurrency(cliente.saldoPendienteArs)}</span>
      </div>
      <div style="display:grid; gap:3px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Observaciones</span>
        <span style="color:#334155; line-height:1.5;">${normalizeText(cliente.observaciones)}</span>
      </div>
    </div>
  </div>
`;

const buildCuentaHtml = (cliente: Cliente) => `
  <div style="text-align:left; color:#0f172a; font-size:14px;">
    <div style="display:grid; gap:10px;">
      <div style="display:grid; gap:3px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Saldo pendiente</span>
        <span style="color:#0f172a; font-weight:800;">${formatCurrency(cliente.saldoPendienteArs)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Condición comercial</span>
        <span style="color:#0f172a; font-weight:600;">${normalizeText(cliente.condicionComercial)}</span>
      </div>
      <div style="display:grid; gap:3px;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Estado comercial</span>
        <span style="color:#1d4ed8; font-weight:700;">${cliente.estado}</span>
      </div>
      <div style="display:grid; gap:3px; padding:12px 14px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
        <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">Observaciones</span>
        <span style="color:#334155; line-height:1.5;">${normalizeText(cliente.observaciones)}</span>
      </div>
    </div>
  </div>
`;

const ClientesPage = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadClientes = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await clienteService.findAll();
      setClientes(data);
    } catch {
      setClientes([]);
      setLoadError("No se pudieron cargar clientes en este momento.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClientes();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleCreate = async (payload: ClienteFormPayload) => {
    try {
      await clienteService.create(buildCreatePayload(payload));
      await loadClientes();
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo crear el cliente",
        text: error instanceof Error ? error.message : "Revisá la configuración de Supabase o el modo mock.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
    }
  };

  const handleEdit = async (uid: string, payload: ClienteFormPayload) => {
    try {
      const current = clientes.find((cliente) => cliente.uid === uid);
      if (!current) {
        throw new Error("No se encontró el cliente seleccionado.");
      }
      await clienteService.update(uid, buildUpdatePayload(payload, current));
      await loadClientes();
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo actualizar el cliente",
        text: error instanceof Error ? error.message : "Revisá la configuración de Supabase o el modo mock.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
    }
  };

  const handleToggleEstado = async (cliente: Cliente) => {
    const nextEstado: EstadoClienteType = cliente.estado === EstadoCliente.SUSPENDIDO ? EstadoCliente.ACTIVO : EstadoCliente.SUSPENDIDO;
    const result = await Swal.fire({
      title: nextEstado === EstadoCliente.SUSPENDIDO ? "¿Suspender cliente?" : "¿Reactivar cliente?",
      text: nextEstado === EstadoCliente.SUSPENDIDO ? "El cliente quedará desactivado." : "El cliente volverá a estado activo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: nextEstado === EstadoCliente.SUSPENDIDO ? "Sí, suspender" : "Sí, reactivar",
      cancelButtonText: "Cancelar",
      background: "#ffffff",
      color: "#0f172a",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#334155",
    });

    if (!result.isConfirmed) return;

    try {
      if (nextEstado === EstadoCliente.SUSPENDIDO) {
        await clienteService.delete(cliente.uid);
      } else {
        await clienteService.update(cliente.uid, { estado: EstadoCliente.ACTIVO, estaActivo: true });
      }
      await loadClientes();
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo actualizar el estado",
        text: error instanceof Error ? error.message : "Revisá la configuración de Supabase o el modo mock.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
    }
  };

  const filteredClientes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clientes;
    return clientes.filter((cliente) =>
      [cliente.nombre, cliente.segmento, cliente.ubicacion, cliente.contacto, cliente.productoPrincipal, cliente.condicionComercial]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, clientes]);

  const totalPendiente = filteredClientes.reduce((acc, item) => acc + item.saldoPendienteArs, 0);
  const clientesActivos = filteredClientes.filter((cliente) => cliente.estaActivo).length;
  const ultimaVentaRegistrada = filteredClientes
    .map((cliente) => (cliente.ultimaCompra ? new Date(`${cliente.ultimaCompra}T00:00:00`).getTime() : null))
    .filter((value): value is number => value !== null)
    .reduce<number | null>((max, current) => (max === null ? current : Math.max(max, current)), null);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Módulo comercial</p>
        <h1 className="text-3xl font-bold mt-2">Clientes</h1>
        <p className="text-slate-500 mt-2">Vista comercial para seguimiento de segmentación, cuentas pendientes y actividad de compra.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Total clientes</p>
          <h2 className="text-3xl font-black mt-2">{filteredClientes.length}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Clientes activos</p>
          <h2 className="text-3xl font-black mt-2 text-emerald-300">{clientesActivos}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Saldo pendiente</p>
          <h2 className="text-3xl font-black mt-2 text-amber-300">{formatCurrency(totalPendiente)}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Última venta registrada</p>
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
              className="w-full md:w-[340px] bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => openNuevoCliente(handleCreate)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              Nuevo cliente
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-slate-500">Cargando clientes...</div>
        ) : loadError ? (
          <div className="text-center py-10 text-red-600">{loadError}</div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-10 text-slate-500">No se encontraron clientes con ese criterio.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
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
                  <tr key={cliente.uid} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 font-medium">{cliente.nombre}</td>
                    <td className="py-3">{normalizeText(cliente.segmento)}</td>
                    <td className="py-3">{normalizeText(cliente.ubicacion)}</td>
                    <td className="py-3">{normalizeText(cliente.contacto)}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusStyle[cliente.estado]}`}>
                        {cliente.estado}
                      </span>
                    </td>
                    <td className="py-3">{normalizeText(cliente.productoPrincipal)}</td>
                    <td className="py-3">{formatDate(cliente.ultimaCompra)}</td>
                    <td className="py-3">{formatCurrency(cliente.saldoPendienteArs)}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void Swal.fire({
                              title: `Detalle de ${cliente.nombre}`,
                              html: buildDetalleHtml(cliente),
                              background: "#ffffff",
                              color: "#0f172a",
                              confirmButtonColor: "#2563eb",
                              confirmButtonText: "Cerrar",
                              width: 700,
                            })
                          }
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditarCliente(cliente, (payload) => handleEdit(cliente.uid, payload))}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void Swal.fire({
                              title: `Cuenta corriente · ${cliente.nombre}`,
                              html: buildCuentaHtml(cliente),
                              background: "#ffffff",
                              color: "#0f172a",
                              confirmButtonColor: "#2563eb",
                              confirmButtonText: "Cerrar",
                              width: 700,
                            })
                          }
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Cuenta corriente
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleEstado(cliente)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {cliente.estado === EstadoCliente.SUSPENDIDO ? "Reactivar" : "Suspender"}
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
