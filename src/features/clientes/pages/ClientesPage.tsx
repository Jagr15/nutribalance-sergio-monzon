import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";
import { formatDateDDMMYYYY } from "../../../shared/utils/formatters";
import { clienteService } from "../services/clienteService";
import { EstadoCliente, type Cliente, type ClienteCreatePayload, type ClienteEstadoCuentaItem, type EstadoCliente as EstadoClienteType, type ClientePagoHistorial } from "../types/cliente";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const statusStyle: Record<EstadoClienteType, string> = {
  [EstadoCliente.ACTIVO]: "bg-emerald-500/20 text-emerald-300",
  [EstadoCliente.EN_RIESGO]: "bg-amber-500/20 text-amber-300",
  [EstadoCliente.SUSPENDIDO]: "bg-red-500/20 text-red-300",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const formatCuentaCantidad = (row: ClienteEstadoCuentaItem) => {
  if (row.cantidad === null || row.cantidad === undefined) return "—";
  const cantidad = row.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 3 });
  if (!row.unidad) return cantidad;
  return `${cantidad} ${row.unidad === "tonelada" ? "tn" : row.unidad}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateDDMMYYYY(date);
};

const normalizeText = (value?: string | null) => value?.trim() || "—";

const ESTADO_FILTERS = ['Todos', EstadoCliente.ACTIVO, EstadoCliente.EN_RIESGO, EstadoCliente.SUSPENDIDO] as const;

const toInputValue = (value?: string | null) => value ?? "";

const preserveExisting = (rawValue?: string, currentValue?: string | null) => {
  const trimmed = rawValue?.trim() ?? "";
  if (trimmed) return trimmed;
  return currentValue ?? undefined;
};

const validateOptionalContactData = (email: string, cuit: string) => {
  if (email && !EMAIL_REGEX.test(email)) return "Ingresa un email válido.";
  if (cuit && !CUIT_REGEX.test(cuit)) return "Ingresa un CUIT válido.";
  return null;
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
        <style>
          .cliente-modal-shell { display:grid; gap:16px; }
          .cliente-modal-grid { display:grid; gap:14px; grid-template-columns:repeat(2, minmax(0, 1fr)); }
          .cliente-modal-card { padding:16px; border-radius:18px; border:1px solid #e2e8f0; background:#fff; box-shadow:0 10px 24px rgba(15, 23, 42, 0.04); }
          .cliente-modal-title { margin:0; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b; }
          .cliente-modal-field { display:grid; gap:6px; }
          .cliente-modal-label { display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155; }
          .cliente-modal-input { width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:12px; padding:10px 12px; outline:none; transition:border-color .15s ease, box-shadow .15s ease; }
          .cliente-modal-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
          .cliente-modal-textarea { min-height:104px; resize:vertical; }
          .cliente-modal-summary { display:grid; gap:10px; }
          .cliente-modal-summary-item { display:grid; gap:4px; padding:14px; border-radius:16px; background:#f8fafc; border:1px solid #e2e8f0; }
          .cliente-modal-summary-value { color:#0f172a; font-weight:700; font-size:15px; }
          .cliente-modal-summary-badge { display:inline-flex; align-items:center; align-self:flex-start; border-radius:999px; padding:5px 10px; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; }
          @media (max-width: 768px) { .cliente-modal-grid { grid-template-columns:1fr; } }
        </style>
        <div class="cliente-modal-shell">
          <p style="margin:0; color:#475569; font-size:13px; line-height:1.5;">Actualiza la información comercial del cliente en una ficha ordenada y editable.</p>
          <div class="cliente-modal-grid">
            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Información general</p>
              <div style="margin-top:12px; display:grid; gap:12px;">
                <div class="cliente-modal-field">
                  <label for="cli-nombre" class="cliente-modal-label">Nombre</label>
                  <input id="cli-nombre" class="cliente-modal-input" value="${toInputValue(cliente.nombre)}" placeholder="Nombre del cliente" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-razonsocial" class="cliente-modal-label">Razón social</label>
                  <input id="cli-razonsocial" class="cliente-modal-input" value="${toInputValue(cliente.razonSocial)}" placeholder="Razón social registrada" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-cuit" class="cliente-modal-label">CUIT</label>
                  <input id="cli-cuit" class="cliente-modal-input" value="${toInputValue(cliente.cuit)}" placeholder="XX-XXXXXXXX-X" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-segmento" class="cliente-modal-label">Segmento</label>
                  <input id="cli-segmento" class="cliente-modal-input" value="${toInputValue(cliente.segmento)}" placeholder="Ej: Tambo" />
                </div>
              </div>
            </div>
            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Contacto y ubicación</p>
              <div style="margin-top:12px; display:grid; gap:12px;">
                <div class="cliente-modal-field">
                  <label for="cli-email" class="cliente-modal-label">Email</label>
                  <input id="cli-email" class="cliente-modal-input" value="${toInputValue(cliente.email)}" placeholder="correo@dominio.com" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-telefono" class="cliente-modal-label">Teléfono</label>
                  <input id="cli-telefono" class="cliente-modal-input" value="${toInputValue(cliente.telefono)}" placeholder="Número de contacto" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-direccion" class="cliente-modal-label">Dirección</label>
                  <input id="cli-direccion" class="cliente-modal-input" value="${toInputValue(cliente.direccion)}" placeholder="Dirección comercial" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-localidad" class="cliente-modal-label">Localidad</label>
                  <input id="cli-localidad" class="cliente-modal-input" value="${toInputValue(cliente.localidad)}" placeholder="Ciudad o localidad" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-provincia" class="cliente-modal-label">Provincia</label>
                  <input id="cli-provincia" class="cliente-modal-input" value="${toInputValue(cliente.provincia)}" placeholder="Provincia" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-ubicacion" class="cliente-modal-label">Ubicación</label>
                  <input id="cli-ubicacion" class="cliente-modal-input" value="${toInputValue(cliente.ubicacion)}" placeholder="Ubicación operativa" />
                </div>
              </div>
            </div>
            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Gestión comercial</p>
              <div style="margin-top:12px; display:grid; gap:12px;">
                <div class="cliente-modal-field">
                  <label for="cli-contacto" class="cliente-modal-label">Contacto</label>
                  <input id="cli-contacto" class="cliente-modal-input" value="${toInputValue(cliente.contacto)}" placeholder="Contacto principal" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-producto" class="cliente-modal-label">Producto principal</label>
                  <input id="cli-producto" class="cliente-modal-input" value="${toInputValue(cliente.productoPrincipal)}" placeholder="Producto principal" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-condicion" class="cliente-modal-label">Condición comercial</label>
                  <input id="cli-condicion" class="cliente-modal-input" value="${toInputValue(cliente.condicionComercial)}" placeholder="Condición comercial" />
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-estado" class="cliente-modal-label">Estado</label>
                  <select id="cli-estado" class="cliente-modal-input">
                    <option value="Activo" ${cliente.estado === "Activo" ? "selected" : ""}>Activo</option>
                    <option value="En riesgo" ${cliente.estado === "En riesgo" ? "selected" : ""}>En riesgo</option>
                    <option value="Suspendido" ${cliente.estado === "Suspendido" ? "selected" : ""}>Suspendido</option>
                  </select>
                </div>
                <div class="cliente-modal-field">
                  <label for="cli-observaciones" class="cliente-modal-label">Observaciones</label>
                  <textarea id="cli-observaciones" rows="4" class="cliente-modal-input cliente-modal-textarea" placeholder="Notas comerciales">${toInputValue(cliente.observaciones)}</textarea>
                </div>
              </div>
            </div>
            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Resumen no editable</p>
              <div class="cliente-modal-summary" style="margin-top:12px;">
                <div class="cliente-modal-summary-item">
                  <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;">Última compra</span>
                  <span class="cliente-modal-summary-value">${formatDate(cliente.ultimaCompra)}</span>
                </div>
                <div class="cliente-modal-summary-item">
                  <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;">Saldo pendiente</span>
                  <span class="cliente-modal-summary-value" style="font-size:20px; color:#1d4ed8;">${formatCurrency(cliente.saldoPendienteArs)}</span>
                </div>
                <div class="cliente-modal-summary-item">
                  <span style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;">Activo</span>
                  <span class="cliente-modal-summary-badge ${cliente.estaActivo ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"}">${cliente.estaActivo ? "Sí" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    background: "#f8fafc",
    color: "#0f172a",
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Guardar cambios",
    cancelButtonText: "Cancelar",
    width: 980,
    customClass: {
      popup: "clientes-modal-popup",
      htmlContainer: "clientes-modal-html",
      actions: "clientes-modal-actions",
      confirmButton: "clientes-modal-confirm",
      cancelButton: "clientes-modal-cancel",
      closeButton: "clientes-modal-close",
    },
    buttonsStyling: true,
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
      const contactError = validateOptionalContactData(email, cuit);
      if (contactError) {
        Swal.showValidationMessage(contactError);
        return;
      }
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
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <style>
          .cliente-modal-shell { display:grid; gap:16px; }
          .cliente-modal-grid { display:grid; gap:14px; grid-template-columns:repeat(2, minmax(0, 1fr)); }
          .cliente-modal-card { padding:16px; border-radius:18px; border:1px solid #e2e8f0; background:#fff; box-shadow:0 10px 24px rgba(15, 23, 42, 0.04); }
          .cliente-modal-title { margin:0; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b; }
          .cliente-modal-field { display:grid; gap:6px; }
          .cliente-modal-label { display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155; }
          .cliente-modal-input { width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:12px; padding:10px 12px; outline:none; transition:border-color .15s ease, box-shadow .15s ease; }
          .cliente-modal-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
          .cliente-modal-textarea { min-height:104px; resize:vertical; }
          @media (max-width: 768px) { .cliente-modal-grid { grid-template-columns:1fr; } }
        </style>
        <div class="cliente-modal-shell">
          <p style="margin:0; color:#475569; font-size:13px; line-height:1.5;">Crea un nuevo cliente con sus datos comerciales y de contacto principales.</p>
          <div class="cliente-modal-grid">
            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Información general</p>
              <div style="margin-top:12px; display:grid; gap:12px;">
                <div class="cliente-modal-field">
                  <label for="new-cli-nombre" class="cliente-modal-label">Nombre</label>
                  <input id="new-cli-nombre" class="cliente-modal-input" placeholder="Nombre del cliente" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-razonsocial" class="cliente-modal-label">Razón social</label>
                  <input id="new-cli-razonsocial" class="cliente-modal-input" placeholder="Razón social registrada" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-cuit" class="cliente-modal-label">CUIT</label>
                  <input id="new-cli-cuit" class="cliente-modal-input" placeholder="XX-XXXXXXXX-X" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-segmento" class="cliente-modal-label">Segmento</label>
                  <input id="new-cli-segmento" class="cliente-modal-input" placeholder="Ej: Tambo" />
                </div>
              </div>
            </div>

            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Contacto y ubicación</p>
              <div style="margin-top:12px; display:grid; gap:12px;">
                <div class="cliente-modal-field">
                  <label for="new-cli-email" class="cliente-modal-label">Email</label>
                  <input id="new-cli-email" class="cliente-modal-input" placeholder="correo@dominio.com" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-telefono" class="cliente-modal-label">Teléfono</label>
                  <input id="new-cli-telefono" class="cliente-modal-input" placeholder="Número de contacto" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-direccion" class="cliente-modal-label">Dirección</label>
                  <input id="new-cli-direccion" class="cliente-modal-input" placeholder="Dirección comercial" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-localidad" class="cliente-modal-label">Localidad</label>
                  <input id="new-cli-localidad" class="cliente-modal-input" placeholder="Ciudad o localidad" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-provincia" class="cliente-modal-label">Provincia</label>
                  <input id="new-cli-provincia" class="cliente-modal-input" placeholder="Provincia" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-ubicacion" class="cliente-modal-label">Ubicación</label>
                  <input id="new-cli-ubicacion" class="cliente-modal-input" placeholder="Ubicación operativa" />
                </div>
              </div>
            </div>

            <div class="cliente-modal-card">
              <p class="cliente-modal-title">Gestión comercial</p>
              <div style="margin-top:12px; display:grid; gap:12px;">
                <div class="cliente-modal-field">
                  <label for="new-cli-contacto" class="cliente-modal-label">Contacto</label>
                  <input id="new-cli-contacto" class="cliente-modal-input" placeholder="Contacto principal" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-producto" class="cliente-modal-label">Producto principal</label>
                  <input id="new-cli-producto" class="cliente-modal-input" placeholder="Producto principal" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-condicion" class="cliente-modal-label">Condición comercial</label>
                  <input id="new-cli-condicion" class="cliente-modal-input" placeholder="Condición comercial" />
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-estado" class="cliente-modal-label">Estado</label>
                  <select id="new-cli-estado" class="cliente-modal-input">
                    <option value="Activo" selected>Activo</option>
                    <option value="En riesgo">En riesgo</option>
                    <option value="Suspendido">Suspendido</option>
                  </select>
                </div>
                <div class="cliente-modal-field">
                  <label for="new-cli-observaciones" class="cliente-modal-label">Observaciones</label>
                  <textarea id="new-cli-observaciones" rows="4" class="cliente-modal-input cliente-modal-textarea" placeholder="Notas comerciales"></textarea>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `,
    background: "#f8fafc",
    color: "#0f172a",
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#334155",
    confirmButtonText: "Crear cliente",
    cancelButtonText: "Cancelar",
    width: 980,
    customClass: {
      popup: "clientes-modal-popup",
      htmlContainer: "clientes-modal-html",
      actions: "clientes-modal-actions",
      confirmButton: "clientes-modal-confirm",
      cancelButton: "clientes-modal-cancel",
      closeButton: "clientes-modal-close",
    },
    buttonsStyling: true,
    preConfirm: () => {
      const nombre = (document.getElementById("new-cli-nombre") as HTMLInputElement | null)?.value.trim();
      if (!nombre) {
        Swal.showValidationMessage("El nombre es obligatorio.");
        return;
      }

      const razonSocial = (document.getElementById("new-cli-razonsocial") as HTMLInputElement | null)?.value.trim() ?? "";
      const cuit = (document.getElementById("new-cli-cuit") as HTMLInputElement | null)?.value.trim() ?? "";
      const email = (document.getElementById("new-cli-email") as HTMLInputElement | null)?.value.trim() ?? "";
      const telefono = (document.getElementById("new-cli-telefono") as HTMLInputElement | null)?.value.trim() ?? "";
      const direccion = (document.getElementById("new-cli-direccion") as HTMLInputElement | null)?.value.trim() ?? "";
      const localidad = (document.getElementById("new-cli-localidad") as HTMLInputElement | null)?.value.trim() ?? "";
      const provincia = (document.getElementById("new-cli-provincia") as HTMLInputElement | null)?.value.trim() ?? "";
      const segmento = (document.getElementById("new-cli-segmento") as HTMLInputElement | null)?.value.trim() ?? "";
      const ubicacion = (document.getElementById("new-cli-ubicacion") as HTMLInputElement | null)?.value.trim() ?? "";
      const contacto = (document.getElementById("new-cli-contacto") as HTMLInputElement | null)?.value.trim() ?? "";
      const productoPrincipal = (document.getElementById("new-cli-producto") as HTMLInputElement | null)?.value.trim() ?? "";
      const condicionComercial = (document.getElementById("new-cli-condicion") as HTMLInputElement | null)?.value.trim() ?? "";
      const estado = ((document.getElementById("new-cli-estado") as HTMLSelectElement | null)?.value ?? "Activo") as EstadoClienteType;
      const observaciones = (document.getElementById("new-cli-observaciones") as HTMLTextAreaElement | null)?.value.trim() ?? "";
      const contactError = validateOptionalContactData(email, cuit);
      if (contactError) {
        Swal.showValidationMessage(contactError);
        return;
      }
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
    <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 20px; border-radius:20px; background:linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color:#fff; margin-bottom:16px;">
      <div style="min-width:0;">
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <h2 style="margin:0; font-size:22px; line-height:1.1; font-weight:800;">${normalizeText(cliente.nombre)}</h2>
          <span style="display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; background:rgba(255,255,255,0.18);">${cliente.estado}</span>
        </div>
        <p style="margin:8px 0 0; color:rgba(255,255,255,0.82); font-size:13px; font-weight:600;">${normalizeText(cliente.segmento)}</p>
      </div>
      ${cliente.saldoPendienteArs > 0 ? `
        <button id="btn-registrar-pago-detalle" style="flex-shrink:0; background:#22c55e; color:#fff; border:none; padding:10px 16px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(34,197,94,0.3); transition:background .15s;">
          Registrar Pago
        </button>
      ` : ''}
    </div>

    <div style="display:grid; gap:14px;">
      <div style="display:grid; gap:10px; grid-template-columns:repeat(2, minmax(0, 1fr));">
        <div style="padding:16px; border-radius:18px; border:1px solid #e2e8f0; background:#fff;">
          <p style="margin:0; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;">Información general</p>
          <div style="margin-top:12px; display:grid; gap:10px;">
            <div><p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em;">Ubicación</p><p style="margin:4px 0 0; font-weight:600;">${normalizeText(cliente.ubicacion)}</p></div>
            <div><p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em;">Contacto</p><p style="margin:4px 0 0; font-weight:600;">${normalizeText(cliente.contacto)}</p></div>
            <div><p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em;">Producto principal</p><p style="margin:4px 0 0; font-weight:600;">${normalizeText(cliente.productoPrincipal)}</p></div>
          </div>
        </div>

        <div style="padding:16px; border-radius:18px; border:1px solid #e2e8f0; background:#fff;">
          <p style="margin:0; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;">Estado comercial</p>
          <div style="margin-top:12px; display:grid; gap:10px;">
            <div><p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em;">Condición comercial</p><p style="margin:4px 0 0; font-weight:600;">${normalizeText(cliente.condicionComercial)}</p></div>
            <div><p style="margin:0; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em;">Última compra</p><p style="margin:4px 0 0; font-weight:600;">${formatDate(cliente.ultimaCompra)}</p></div>
            <div style="padding:14px; border-radius:16px; background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border:1px solid #bfdbfe;">
              <p style="margin:0; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#1d4ed8;">Saldo pendiente</p>
              <p style="margin:6px 0 0; font-size:24px; line-height:1.1; font-weight:900; color:#0f172a;">${formatCurrency(cliente.saldoPendienteArs)}</p>
            </div>
          </div>
        </div>
      </div>

      <div style="padding:16px; border-radius:18px; border:1px solid #e2e8f0; background:#fff;">
        <p style="margin:0; font-size:11px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#64748b;">Observaciones</p>
        <p style="margin:10px 0 0; color:#334155; line-height:1.6;">${normalizeText(cliente.observaciones)}</p>
      </div>
    </div>
  </div>
`;

const ClientesPage = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<(typeof ESTADO_FILTERS)[number]>('Todos');
  const [cuentaCliente, setCuentaCliente] = useState<Cliente | null>(null);
  const [cuentaRows, setCuentaRows] = useState<ClienteEstadoCuentaItem[]>([]);
  const [cuentaLoading, setCuentaLoading] = useState(false);
  const [cuentaError, setCuentaError] = useState<string | null>(null);
  const [cuentaOpen, setCuentaOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'clientes' | 'pagos'>('clientes');
  const [pagos, setPagos] = useState<ClientePagoHistorial[]>([]);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [pagosError, setPagosError] = useState<string | null>(null);

  const [pagoClienteFilter, setPagoClienteFilter] = useState("");
  const [pagoFechaDesde, setPagoFechaDesde] = useState("");
  const [pagoFechaHasta, setPagoFechaHasta] = useState("");

  const loadPagos = async () => {
    try {
      setPagosLoading(true);
      setPagosError(null);
      const data = await clienteService.getPagos();
      setPagos(data);
    } catch {
      setPagos([]);
      setPagosError("No se pudieron cargar los pagos.");
    } finally {
      setPagosLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pagos') {
      void loadPagos();
    }
  }, [activeTab]);

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

  const handleOpenCuentaCorriente = async (cliente: Cliente) => {
    setCuentaCliente(cliente);
    setCuentaOpen(true);
    setCuentaLoading(true);
    setCuentaError(null);
    setCuentaRows([]);

    try {
      const rows = await clienteService.getEstadoCuentaCliente(cliente.uid);
      setCuentaRows(rows);
    } catch (error: unknown) {
      setCuentaError(error instanceof Error ? error.message : 'No se pudo cargar el estado de cuenta.');
    } finally {
      setCuentaLoading(false);
    }
  };

  const handleCloseCuentaCorriente = () => {
    setCuentaOpen(false);
    setCuentaCliente(null);
    setCuentaRows([]);
    setCuentaError(null);
    setCuentaLoading(false);
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
      });
    }
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    const result = await Swal.fire({
      title: `¿Eliminar a ${cliente.nombre}?`,
      text: "Esta acción no se puede deshacer. Se validarán las relaciones del cliente en el sistema.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#ffffff",
      color: "#0f172a",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#334155",
    });

    if (!result.isConfirmed) return;

    try {
      await clienteService.delete(cliente.uid);
      await loadClientes();
      await Swal.fire({
        icon: "success",
        title: "Cliente eliminado",
        text: "El cliente ha sido eliminado correctamente.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: error instanceof Error ? error.message : "Revisá la configuración de Supabase o el modo mock.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
    }
  };

  const openRegistrarPago = (cliente: Cliente, targetComprobanteId?: string) => {
    if (cliente.saldoPendienteArs <= 0) {
      void Swal.fire({
        icon: "info",
        title: "Sin saldo pendiente",
        text: "Este cliente no tiene saldo pendiente actualmente.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    void Swal.fire({
      title: "Cargando facturas...",
      didOpen: () => {
        Swal.showLoading();
      },
      allowOutsideClick: false,
    });

    clienteService.getEstadoCuentaCliente(cliente.uid).then((rows) => {
      const outstandingFacturas = rows.filter((r) => r.saldo > 0);

      void Swal.fire({
        title: "Registrar pago de cliente",
        html: `
          <div style="text-align:left; color:#0f172a; font-size:14px;">
            <style>
              .pago-modal-shell { display:grid; gap:16px; }
              .pago-modal-card { padding:16px; border-radius:18px; border:1px solid #e2e8f0; background:#fff; box-shadow:0 10px 24px rgba(15, 23, 42, 0.04); }
              .pago-modal-field { display:grid; gap:6px; margin-bottom:12px; }
              .pago-modal-label { display:block; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#334155; }
              .pago-modal-input { width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:12px; padding:10px 12px; outline:none; transition:border-color .15s ease, box-shadow .15s ease; }
              .pago-modal-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
              .cheque-fields-container { display:none; border:1px dashed #cbd5e1; border-radius:16px; padding:14px; background:#f8fafc; margin-top:10px; }
            </style>
            <div class="pago-modal-shell">
              <div class="pago-modal-card">
                <div class="pago-modal-field">
                  <label class="pago-modal-label">Cliente</label>
                  <input class="pago-modal-input" value="${cliente.nombre}" readonly style="background:#f1f5f9; color:#64748b;" />
                </div>
                <div class="pago-modal-field">
                  <label class="pago-modal-label">Saldo pendiente actual</label>
                  <input class="pago-modal-input" value="${formatCurrency(cliente.saldoPendienteArs)}" readonly style="background:#f8fafc; font-weight:700; color:#1d4ed8;" />
                </div>
                <div class="pago-modal-field">
                  <label for="pago-factura" class="pago-modal-label">Aplicar a Factura Específica</label>
                  <select id="pago-factura" class="pago-modal-input">
                    <option value="">-- Aplicar automáticamente al saldo más antiguo --</option>
                    ${outstandingFacturas.map((f) => `
                      <option value="${f.id}" ${targetComprobanteId === f.id ? "selected" : ""}>
                        Factura ${f.comprobanteNumero || f.id} (Saldo: ${formatCurrency(f.saldo)})
                      </option>
                    `).join("")}
                  </select>
                </div>
                <div class="pago-modal-field">
                  <label for="pago-monto" class="pago-modal-label">Monto del pago</label>
                  <input id="pago-monto" type="number" step="any" min="0.01" class="pago-modal-input" placeholder="Monto a abonar" />
                </div>
                <div class="pago-modal-field">
                  <label for="pago-fecha" class="pago-modal-label">Fecha de pago</label>
                  <input id="pago-fecha" type="date" class="pago-modal-input" value="${new Date().toISOString().slice(0, 10)}" />
                </div>
                <div class="pago-modal-field">
                  <label for="pago-metodo" class="pago-modal-label">Método de pago</label>
                  <select id="pago-metodo" class="pago-modal-input">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                
                <div id="pago-cheque-fields" class="cheque-fields-container">
                  <p style="margin:0 0 10px; font-size:11px; font-weight:800; text-transform:uppercase; color:#64748b;">Datos del Cheque Recibido</p>
                  <div class="pago-modal-field">
                    <label for="ch-numero" class="pago-modal-label">Número de Cheque</label>
                    <input id="ch-numero" class="pago-modal-input" placeholder="Ej: 11111" />
                  </div>
                  <div class="pago-modal-field">
                    <label for="ch-banco" class="pago-modal-label">Banco</label>
                    <input id="ch-banco" class="pago-modal-input" placeholder="Ej: Banco Nación" />
                  </div>
                  <div class="pago-modal-field">
                    <label for="ch-fecha-emision" class="pago-modal-label">Fecha de Emisión</label>
                    <input id="ch-fecha-emision" type="date" class="pago-modal-input" value="${new Date().toISOString().slice(0, 10)}" />
                  </div>
                  <div class="pago-modal-field">
                    <label for="ch-fecha-vencimiento" class="pago-modal-label">Fecha de Depósito/Cobro</label>
                    <input id="ch-fecha-vencimiento" type="date" class="pago-modal-input" value="${new Date().toISOString().slice(0, 10)}" />
                  </div>
                </div>

                <div class="pago-modal-field" style="margin-top:12px;">
                  <label for="pago-referencia" class="pago-modal-label">Referencia / Comprobante</label>
                  <input id="pago-referencia" class="pago-modal-input" placeholder="Ej: Transferencia Nº 45398" />
                </div>
                <div class="pago-modal-field">
                  <label for="pago-observaciones" class="pago-modal-label">Observaciones</label>
                  <textarea id="pago-observaciones" rows="3" class="pago-modal-input" style="min-height:70px;" placeholder="Notas adicionales"></textarea>
                </div>
              </div>
            </div>
          </div>
        `,
        background: "#f8fafc",
        color: "#0f172a",
        showCancelButton: true,
        showCloseButton: true,
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#334155",
        confirmButtonText: "Registrar Pago",
        cancelButtonText: "Cancelar",
        width: 600,
        didOpen: () => {
          const metodoSelect = document.getElementById("pago-metodo") as HTMLSelectElement | null;
          const chequeFields = document.getElementById("pago-cheque-fields") as HTMLDivElement | null;
          if (metodoSelect && chequeFields) {
            metodoSelect.addEventListener("change", () => {
              if (metodoSelect.value === "cheque") {
                chequeFields.style.display = "block";
              } else {
                chequeFields.style.display = "none";
              }
            });
          }
        },
        preConfirm: () => {
          const montoRaw = (document.getElementById("pago-monto") as HTMLInputElement | null)?.value;
          const monto = Number(montoRaw);
          if (!montoRaw || Number.isNaN(monto) || monto <= 0) {
            Swal.showValidationMessage("El monto debe ser un número mayor a 0.");
            return;
          }

          if (monto > cliente.saldoPendienteArs) {
            Swal.showValidationMessage(`El monto del pago no puede superar el saldo pendiente ($${cliente.saldoPendienteArs.toLocaleString('es-AR')}).`);
            return;
          }

          const fechaPago = (document.getElementById("pago-fecha") as HTMLInputElement | null)?.value;
          if (!fechaPago) {
            Swal.showValidationMessage("La fecha de pago es obligatoria.");
            return;
          }

          const metodoPago = (document.getElementById("pago-metodo") as HTMLSelectElement | null)?.value as any;
          if (!metodoPago) {
            Swal.showValidationMessage("El método de pago es obligatorio.");
            return;
          }

          const referencia = (document.getElementById("pago-referencia") as HTMLInputElement | null)?.value.trim() ?? "";
          const observaciones = (document.getElementById("pago-observaciones") as HTMLTextAreaElement | null)?.value.trim() ?? "";
          const comprobanteId = (document.getElementById("pago-factura") as HTMLSelectElement | null)?.value || undefined;

          let cheque = undefined;
          if (metodoPago === "cheque") {
            const chNumero = (document.getElementById("ch-numero") as HTMLInputElement | null)?.value.trim() ?? "";
            const chBanco = (document.getElementById("ch-banco") as HTMLInputElement | null)?.value.trim() ?? "";
            const chFechaEmision = (document.getElementById("ch-fecha-emision") as HTMLInputElement | null)?.value ?? "";
            const chFechaVencimiento = (document.getElementById("ch-fecha-vencimiento") as HTMLInputElement | null)?.value ?? "";

            if (!chNumero) {
              Swal.showValidationMessage("El número de cheque es obligatorio.");
              return;
            }
            if (!chBanco) {
              Swal.showValidationMessage("El banco del cheque es obligatorio.");
              return;
            }
            if (!chFechaEmision) {
              Swal.showValidationMessage("La fecha de emisión del cheque es obligatoria.");
              return;
            }
            if (!chFechaVencimiento) {
              Swal.showValidationMessage("La fecha de cobro/depósito del cheque es obligatoria.");
              return;
            }

            cheque = {
              numero: chNumero,
              banco: chBanco,
              fechaEmision: chFechaEmision,
              fechaVencimiento: chFechaVencimiento,
            };
          }

          return {
            clienteId: cliente.uid,
            monto,
            fechaPago,
            metodoPago,
            referencia,
            observaciones,
            comprobanteId,
            cheque,
          };
        }
      }).then(async (result) => {
        if (!result.isConfirmed || !result.value) return;

        try {
          Swal.fire({
            title: "Registrando pago...",
            didOpen: () => {
              Swal.showLoading();
            },
            allowOutsideClick: false,
          });

          await clienteService.registrarPago(result.value);

          await loadClientes();

          void Swal.fire({
            icon: "success",
            title: "Pago registrado",
            text: "El pago fue aplicado correctamente.",
            background: "#ffffff",
            color: "#0f172a",
            confirmButtonColor: "#2563eb",
          });
        } catch (e: any) {
          void Swal.fire({
            icon: "error",
            title: "Error al registrar pago",
            text: e instanceof Error ? e.message : "Intente nuevamente más tarde.",
            background: "#ffffff",
            color: "#0f172a",
            confirmButtonColor: "#2563eb",
          });
        }
      });
    }).catch(() => {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron obtener las facturas pendientes.",
        background: "#ffffff",
        color: "#0f172a",
        confirmButtonColor: "#2563eb",
      });
    });
  };

  const filteredClientes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const estadoNormalizado = estadoFilter.toLowerCase();
    return clientes.filter((cliente) => {
      if (estadoFilter !== 'Todos' && cliente.estado.toLowerCase() !== estadoNormalizado) return false;
      if (!query) return true;
      return [cliente.nombre, cliente.segmento, cliente.ubicacion, cliente.contacto, cliente.productoPrincipal, cliente.condicionComercial]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [estadoFilter, search, clientes]);

  const totalPendiente = filteredClientes.reduce((acc, item) => acc + item.saldoPendienteArs, 0);
  const clientesActivos = filteredClientes.filter((cliente) => cliente.estaActivo).length;
  const ultimaVentaRegistrada = filteredClientes
    .map((cliente) => (cliente.ultimaCompra ? new Date(`${cliente.ultimaCompra}T00:00:00`).getTime() : null))
    .filter((value): value is number => value !== null)
    .reduce<number | null>((max, current) => (max === null ? current : Math.max(max, current)), null);
  const totalCuentaPendiente = cuentaRows.reduce((acc, item) => acc + item.saldo, 0);

  const filteredPagos = useMemo(() => {
    return pagos.filter((pago) => {
      if (pagoClienteFilter && pago.clienteId !== pagoClienteFilter) {
        return false;
      }
      if (pagoFechaDesde) {
        const pDate = pago.fecha.split('T')[0];
        if (pDate < pagoFechaDesde) return false;
      }
      if (pagoFechaHasta) {
        const pDate = pago.fecha.split('T')[0];
        if (pDate > pagoFechaHasta) return false;
      }
      return true;
    });
  }, [pagos, pagoClienteFilter, pagoFechaDesde, pagoFechaHasta]);

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
              ? formatDateDDMMYYYY(new Date(ultimaVentaRegistrada))
              : "Sin dato"}
          </h2>
        </Card>
      </section>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('clientes')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'clientes'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Listado de clientes
        </button>
        <button
          onClick={() => setActiveTab('pagos')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'pagos'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Historial de pagos
        </button>
      </div>

      {activeTab === 'clientes' ? (
        <Card>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
            <h2 className="text-xl font-semibold">Listado de clientes</h2>
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={estadoFilter}
                onChange={(event) => setEstadoFilter(event.target.value as typeof estadoFilter)}
                className="w-full md:w-[180px] bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {ESTADO_FILTERS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
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
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-4 font-semibold">Cliente</th>
                    <th className="px-4 py-4 font-semibold">Segmento</th>
                    <th className="px-4 py-4 font-semibold">Ubicación</th>
                    <th className="px-4 py-4 font-semibold text-right">Saldo pendiente</th>
                    <th className="px-4 py-4 font-semibold">Estado</th>
                    <th className="px-4 py-4 font-semibold">Última compra</th>
                    <th className="px-4 py-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.uid} className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900">{cliente.nombre}</p>
                          <p className="text-xs text-slate-500">{normalizeText(cliente.contacto)}</p>
                          <p className="text-xs text-slate-500">{cliente.productoPrincipal?.trim() ? cliente.productoPrincipal : <span className="text-slate-400">-</span>}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{normalizeText(cliente.segmento)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{normalizeText(cliente.ubicacion)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(cliente.saldoPendienteArs)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[cliente.estado]}`}>
                          {cliente.estado}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDate(cliente.ultimaCompra)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
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
                                didOpen: () => {
                                  const btn = document.getElementById("btn-registrar-pago-detalle");
                                  if (btn) {
                                    btn.addEventListener("click", () => {
                                      Swal.close();
                                      openRegistrarPago(cliente);
                                    });
                                  }
                                }
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
                          <details className="relative">
                            <summary className="flex h-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                              •••
                            </summary>
                            <div className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                              <button
                                type="button"
                                onClick={() => { void handleOpenCuentaCorriente(cliente); }}
                                className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                Cuenta corriente
                              </button>
                              <button
                                type="button"
                                onClick={() => openRegistrarPago(cliente)}
                                className="block w-full px-4 py-3 text-left text-sm text-emerald-600 hover:bg-emerald-50/50 font-medium"
                              >
                                Registrar pago
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleEstado(cliente)}
                                className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                {cliente.estado === EstadoCliente.SUSPENDIDO ? "Reactivar" : "Suspender"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteCliente(cliente)}
                                className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50/50 font-medium"
                              >
                                Eliminar
                              </button>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold">Historial de pagos</h2>
              <p className="text-xs text-slate-500 mt-1">
                Visualización general de cobros y pagos realizados por clientes.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Total pagado</span>
              <span className="text-lg font-bold text-blue-900">{formatCurrency(filteredPagos.filter((p) => p.estado !== 'ANULADO' && p.estado !== 'CANCELADO').reduce((acc, p) => acc + p.monto, 0))}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Filtrar por Cliente</label>
              <select
                value={pagoClienteFilter}
                onChange={(e) => setPagoClienteFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Todos los clientes</option>
                {clientes.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
              <input
                type="date"
                value={pagoFechaDesde}
                onChange={(e) => setPagoFechaDesde(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={pagoFechaHasta}
                onChange={(e) => setPagoFechaHasta(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setPagoClienteFilter("");
                  setPagoFechaDesde("");
                  setPagoFechaHasta("");
                }}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {pagosLoading ? (
            <div className="text-center py-10 text-slate-500">Cargando historial de pagos...</div>
          ) : pagosError ? (
            <div className="text-center py-10 text-red-600">{pagosError}</div>
          ) : filteredPagos.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No se encontraron pagos con ese criterio.</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-4 font-semibold">Fecha</th>
                      <th className="px-4 py-4 font-semibold">Cliente</th>
                      <th className="px-4 py-4 font-semibold text-right">Monto</th>
                      <th className="px-4 py-4 font-semibold">Método</th>
                      <th className="px-4 py-4 font-semibold">Referencia</th>
                      <th className="px-4 py-4 font-semibold">Concepto / Descripción</th>
                      <th className="px-4 py-4 font-semibold">Estado</th>
                      <th className="px-4 py-4 font-semibold">Relación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPagos.map((pago) => (
                      <tr key={pago.id} className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                        <td className="px-4 py-4 text-sm text-slate-700 font-medium">
                          {formatDate(pago.fecha)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-900 font-semibold">
                          {pago.clienteNombre}
                        </td>
                        <td className="px-4 py-4 text-sm text-right font-black text-slate-900">
                          {formatCurrency(pago.monto)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 capitalize">
                            {pago.metodoPago || 'Efectivo'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {pago.referencia ? pago.referencia : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {pago.concepto}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            pago.estado === 'CONFIRMADO' || pago.estado === 'PAGADO' || pago.estado === 'COBRADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pago.estado === 'PENDIENTE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {pago.estado}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <div className="space-y-1">
                            {pago.movimientoId && <p><span className="font-semibold">Mov:</span> {pago.movimientoId}</p>}
                            {pago.comprobanteId && <p><span className="font-semibold">Recibo:</span> {pago.comprobanteId}</p>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {cuentaOpen && cuentaCliente ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">Cuenta corriente</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{cuentaCliente.nombre}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Estado de cuenta basado en movimientos financieros confirmados del cliente.
                </p>
              </div>
              <div className="flex gap-2">
                {cuentaCliente.saldoPendienteArs > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseCuentaCorriente();
                      openRegistrarPago(cuentaCliente);
                    }}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm"
                  >
                    Registrar Pago
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseCuentaCorriente}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-6 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Saldo total pendiente</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(totalCuentaPendiente)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Registros</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{cuentaRows.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Observación técnica</p>
                  <p className="mt-2 text-sm text-slate-600">El importe puede basarse en costo estimado y no en precio comercial.</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-5">
              {cuentaLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Cargando estado de cuenta...
                </div>
              ) : cuentaError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{cuentaError}</div>
              ) : cuentaRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No hay movimientos o comprobantes asociados a este cliente.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[1080px] text-left">
                     <thead>
                       <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Producto / concepto</th>
                        <th className="px-4 py-3">Cantidad</th>
                        <th className="px-4 py-3 text-right">Importe</th>
                        <th className="px-4 py-3 text-right">Saldo pendiente</th>
                        <th className="px-4 py-3">Referencia</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentaRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-3 text-sm text-slate-700">{formatDate(row.fecha)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{row.producto || '—'}</div>
                            {row.comprobanteNumero ? <div className="text-xs text-slate-500">Comprobante {row.comprobanteNumero}</div> : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatCuentaCantidad(row)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatCurrency(row.importe)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{formatCurrency(row.saldo)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.referencia || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                              {row.estado || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.saldo > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleCloseCuentaCorriente();
                                  openRegistrarPago(cuentaCliente, row.id);
                                }}
                                className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
                              >
                                Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
};

export default ClientesPage;
