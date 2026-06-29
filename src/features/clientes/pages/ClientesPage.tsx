import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";
import { formatDateDDMMYYYY } from "../../../shared/utils/formatters";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

const statusStyle: Record<EstadoClienteType, string> = {
  [EstadoCliente.ACTIVO]: "bg-emerald-500/20 text-emerald-300",
  [EstadoCliente.EN_RIESGO]: "bg-amber-500/20 text-amber-300",
  [EstadoCliente.SUSPENDIDO]: "bg-red-500/20 text-red-300",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
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
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:18px 20px; border-radius:20px; background:linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color:#fff; margin-bottom:16px;">
      <div style="min-width:0;">
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <h2 style="margin:0; font-size:22px; line-height:1.1; font-weight:800;">${normalizeText(cliente.nombre)}</h2>
          <span style="display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:10px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; background:rgba(255,255,255,0.18);">${cliente.estado}</span>
        </div>
        <p style="margin:8px 0 0; color:rgba(255,255,255,0.82); font-size:13px; font-weight:600;">${normalizeText(cliente.segmento)}</p>
      </div>
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
  const [estadoFilter, setEstadoFilter] = useState<(typeof ESTADO_FILTERS)[number]>('Todos');

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
                              className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Cuenta corriente
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleEstado(cliente)}
                              className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {cliente.estado === EstadoCliente.SUSPENDIDO ? "Reactivar" : "Suspender"}
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
    </div>
  );
};

export default ClientesPage;
