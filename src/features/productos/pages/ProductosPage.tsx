import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { Card } from '../../../shared/components/card';
import { ApiService } from '../../../infrastructure/api';
import { getSessionUser } from '../../auth/session';
import { useOrdenes } from '../../ordenes/hooks/useOrdenes';
import { useOrdenService } from '../../ordenes/services';
import { EstadoOrden, type DetalleInsumoLote, type OrdenProduccion } from '../../ordenes/types';
import { getTodayDateInputValue } from '../../../shared/utils/formatters';
import { ControlEstado, type MovimientoStockPT, type StockProductoTerminado, type StockProductoTerminadoResumen } from '../types';
import type { Formula } from '../../formulas/types';
import type { Cliente } from '../../clientes/types/cliente';
import { buildStockPTResumen } from '../utils/stockPtResumen';
import type { Silo } from '../../silos/types';

type EstadoProductoUi = 'OK' | 'Bajo' | 'Crítico';

interface ProductoUi {
  dbId: string;
  uid: string;
  ordenId: string | null;
  nombre: string;
  stockKg: number;
  valorEstimado: number;
  silo: string;
  siloLegacyUid: string | null;
  lote: string;
  estadoUi: EstadoProductoUi;
  fechaIngreso: string;
  orden: string;
  fechaProgramada: string | null;
  idFormula?: string | null;
  versionFormula?: number | null;
  costoArsTon?: number;
  proteinaObjetivoPct?: number;
  detalleInsumos: Array<{
    nombre_insumo: string;
    cantidad: number;
    unidad_medida: string;
  }>;
}

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin dato';
  return formatDateDDMMYYYY(d);
};

const mapEstado = (estado: StockProductoTerminado['estado']): EstadoProductoUi => {
  if (estado === ControlEstado.CRITICO) return 'Crítico';
  if (estado === ControlEstado.BAJO) return 'Bajo';
  return 'OK';
};

const getStatusStyles = (status: EstadoProductoUi) => {
  if (status === 'Crítico') return 'bg-red-500/20 text-red-300';
  if (status === 'Bajo') return 'bg-amber-500/20 text-amber-300';
  return 'bg-emerald-500/20 text-emerald-300';
};

const toArrayDetalle = (detalle: StockProductoTerminado['detalle_insumos']) => {
  if (!detalle) return [];
  const items = Array.isArray(detalle) ? detalle : [detalle];
  return items
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => {
      if (Array.isArray(item)) return item[0] ?? null;
      if ('cantidad_usada' in item) {
        return {
          nombre_insumo: item.nombre_insumo,
          cantidad: Number(item.cantidad_usada ?? 0),
          unidad_medida: item.tipo_unidad,
        };
      }

      return {
        nombre_insumo: item.nombre_insumo,
        cantidad: Number(item.cantidad ?? 0),
        unidad_medida: item.unidad_medida,
      };
    })
    .filter((item): item is { nombre_insumo: string; cantidad: number; unidad_medida: string } => Boolean(item));
};

const toUi = (item: StockProductoTerminado): ProductoUi => ({
  dbId: item.id,
  uid: item.uid,
  ordenId: item.id_orden || null,
  nombre: item.nombre_producto || 'Sin dato',
  stockKg: Number(item.cantidad_total ?? 0),
  valorEstimado: Number(item.costo_total ?? 0) > 0
    ? Number(item.costo_total ?? 0)
    : Number(item.cantidad_total ?? 0) * Number(item.costo_unitario_estimado ?? 0),
  silo: item.nombre_silo || 'Sin dato',
  siloLegacyUid: item.id_silo || null,
  lote: item.lote || 'Sin dato',
  estadoUi: mapEstado(item.estado),
  fechaIngreso: item.fecha_ingreso,
  orden: item.numero_orden || item.id_orden || 'Sin dato',
  fechaProgramada: null,
  idFormula: item.id_formula ?? null,
  versionFormula: item.version_formula ?? null,
  costoArsTon: undefined,
  proteinaObjetivoPct: undefined,
  detalleInsumos: toArrayDetalle(item.detalle_insumos),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveStockPtId = (lotes: ProductoUi[], loteId: string) => {
  const selected = lotes.find((lote) => lote.dbId === loteId);
  return {
    selected,
    stockPtId: selected?.dbId ?? '',
  };
};

const normalizeKey = (value?: string | null) => (value ?? '').trim().toLowerCase();

const findOrdenExacta = (ordenes: OrdenProduccion[], producto: ProductoUi) => {
  if (producto.ordenId) {
    const byOrderId = ordenes.find((orden) => orden.id === producto.ordenId);
    if (byOrderId) return byOrderId;
  }

  const ordenRef = normalizeKey(producto.orden);
  if (ordenRef) {
    const byLote = ordenes.find((orden) => normalizeKey(orden.lote) === ordenRef);
    if (byLote) return byLote;

    const byId = ordenes.find((orden) => normalizeKey(orden.id) === ordenRef);
    if (byId) return byId;
  }

  return null;
};

const findOrdenEditable = (ordenes: OrdenProduccion[], producto: ProductoUi) => {
  const orden = findOrdenExacta(ordenes, producto);
  if (!orden) return null;
  return orden.estado === EstadoOrden.PENDIENTE || orden.estado === EstadoOrden.EN_PROCESO ? orden : null;
};

const formatProteina = (value?: number) => (
  typeof value === 'number' ? `${value.toFixed(2)}%` : 'Sin dato'
);

const openOrdenProgramadaDetail = (orden: OrdenProduccion, formula?: Formula | null) => {
  const formulaLabel = orden.id_formula || orden.version_formula
    ? `${orden.id_formula ?? 'Sin fórmula'} ${orden.version_formula ? `v${orden.version_formula}` : ''}`
    : formula
      ? `${formula.uid} v${formula.version}`
      : 'Sin dato';

  const insumos = orden.detalle_insumos
    ?.slice(0, 8)
    .map((item) => `${item.nombre_insumo || 'Sin dato'} · ${Number(item.cantidad_usada ?? 0).toLocaleString('es-AR')} ${item.tipo_unidad || 'KG'}`)
    .join('<br/>') || 'Sin dato';

  void Swal.fire({
    title: `Detalle de OP · ${orden.lote}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Producto:</strong> ${orden.nombre_producto || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>OP / lote:</strong> ${orden.lote || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Estado:</strong> ${orden.estado}</p>
        <p style="margin:0 0 8px;"><strong>Cantidad objetivo:</strong> ${formatKg(Number(orden.cantidad_objetivo ?? 0))}</p>
        <p style="margin:0 0 8px;"><strong>Fecha programada:</strong> ${orden.fecha_programada || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Silo destino:</strong> ${orden.destino_silo || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Fórmula / versión:</strong> ${formulaLabel}</p>
        <p style="margin:0 0 8px;"><strong>Cantidad real:</strong> ${orden.cantidad_real ? formatKg(Number(orden.cantidad_real)) : 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Merma:</strong> ${orden.merma_manual !== undefined && orden.merma_manual !== null ? `${Number(orden.merma_manual).toLocaleString('es-AR')} kg` : 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Costo total insumos:</strong> ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(orden.costo_total_insumos ?? 0))}</p>
        <p style="margin:0 0 8px;"><strong>Detalle insumos:</strong><br/>${insumos}</p>
        <p style="margin:0 0 8px;"><strong>ID técnico:</strong> ${orden.id}</p>
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Cerrar',
    width: 700,
  });
};

const openStockDetail = (producto: ProductoUi, movimientosPT: MovimientoStockPT[], orden?: OrdenProduccion | null) => {
  const ingredientes = producto.detalleInsumos
    .slice(0, 5)
    .map((i) => `${i.nombre_insumo || 'Sin dato'} (${Number(i.cantidad ?? 0).toLocaleString('es-AR')} ${i.unidad_medida || 'KG'})`)
    .join(', ');
  const movimientos = movimientosPT
    .filter((mov) => mov.stock_pt_id === producto.dbId || mov.lote === producto.lote || mov.numero_orden === producto.orden)
    .slice(0, 8);
  const trazabilidad = movimientos.length > 0
    ? movimientos.map((mov) => `${mov.created_at.slice(0, 10)} · ${mov.tipo} · ${Number(mov.cantidad ?? 0).toLocaleString('es-AR')} ${mov.unidad}`).join('<br/>')
    : 'Sin movimientos registrados';
  const fechaProgramada = orden?.fecha_programada ?? producto.fechaProgramada ?? 'Sin dato';
  const cantidadObjetivo = orden?.cantidad_objetivo ?? null;
  const cantidadReal = orden?.cantidad_real ?? null;
  const merma = orden?.merma_manual ?? null;
  const costoUnitario = orden?.costo_total_insumos && Number(orden.cantidad_real ?? 0) > 0
    ? Number(orden.costo_total_insumos) / Number(orden.cantidad_real ?? 0)
    : null;
  const valorTotal = orden?.costo_total_insumos ?? producto.valorEstimado;

  void Swal.fire({
    title: `Detalle de lote · ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Lote PT:</strong> ${producto.lote || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Orden asociada:</strong> ${producto.orden || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Silo asociado:</strong> ${producto.silo || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Stock disponible:</strong> ${formatKg(producto.stockKg)}</p>
        <p style="margin:0 0 8px;"><strong>Estado operativo:</strong> ${producto.estadoUi}</p>
        <p style="margin:0 0 8px;"><strong>Último ingreso:</strong> ${formatDate(producto.fechaIngreso)}</p>
        <p style="margin:0 0 8px;"><strong>Fecha programada:</strong> ${fechaProgramada || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Cantidad objetivo:</strong> ${typeof cantidadObjetivo === 'number' ? formatKg(cantidadObjetivo) : 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Cantidad real:</strong> ${typeof cantidadReal === 'number' ? formatKg(cantidadReal) : 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Merma:</strong> ${typeof merma === 'number' ? `${merma.toLocaleString('es-AR')} kg` : 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Costo unitario:</strong> ${costoUnitario !== null ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(costoUnitario) : 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Valor total:</strong> ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valorTotal)}</p>
        <p style="margin:0 0 8px;"><strong>Proteína objetivo:</strong> ${formatProteina(producto.proteinaObjetivoPct)}</p>
        <p style="margin:0 0 8px;"><strong>Detalle insumos:</strong> ${ingredientes || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Trazabilidad:</strong><br/>${trazabilidad}</p>
        <p style="margin:0 0 8px;"><strong>ID técnico stock PT:</strong> ${producto.dbId}</p>
        <p style="margin:0;"><strong>Legacy UID:</strong> ${producto.uid}</p>
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Cerrar',
    width: 640,
  });
};

const openSalidaModal = async (
  producto: ProductoUi,
  lotes: ProductoUi[],
  clientes: Cliente[],
  onSuccess: () => Promise<void> | void
) => {
  const opciones = lotes
    .map((lote) => `<option value="${lote.dbId}">${lote.lote} · ${formatKg(lote.stockKg)} · ${lote.silo}</option>`)
    .join('');

  const result = await Swal.fire({
    title: `Registrar salida · ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Saldo consolidado:</strong> ${formatKg(producto.stockKg)}</p>
        <p style="margin:0 0 8px;"><strong>Valor estimado:</strong> ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(producto.valorEstimado)}</p>
        <label style="display:block; margin: 0 0 6px;">Lote / OP</label>
        <select id="salida-lote" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
          ${opciones}
        </select>
        <label style="display:block; margin: 0 0 6px;">Cliente destino</label>
        <select id="salida-cliente" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
          <option value="">Sin cliente asociado</option>
          ${clientes.map((cliente) => `<option value="${cliente.uid}">${cliente.nombre}</option>`).join('')}
        </select>
        <label style="display:block; margin: 0 0 6px;">Cantidad a salir</label>
        <input id="salida-cantidad" type="number" min="1" step="0.001" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <label style="display:block; margin: 0 0 6px;">Motivo</label>
        <input id="salida-motivo" type="text" placeholder="Venta / entrega / egreso manual" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <label style="display:block; margin: 0 0 6px;">Referencia</label>
        <input id="salida-ref" type="text" placeholder="Factura, remito o referencia interna" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Registrar salida',
    cancelButtonText: 'Cancelar',
    width: 680,
    showLoaderOnConfirm: true,
    preConfirm: async () => {
      try {
        const loteId = (document.getElementById('salida-lote') as HTMLSelectElement | null)?.value;
        const clienteId = (document.getElementById('salida-cliente') as HTMLSelectElement | null)?.value || null;
        const cliente = clientes.find((item) => item.uid === clienteId) ?? null;
        const cantidad = Number((document.getElementById('salida-cantidad') as HTMLInputElement | null)?.value);
        const motivo = (document.getElementById('salida-motivo') as HTMLInputElement | null)?.value.trim();
        const referencia = (document.getElementById('salida-ref') as HTMLInputElement | null)?.value.trim();
        const { selected, stockPtId: selectedStockPtId } = resolveStockPtId(lotes, loteId ?? '');

        if (!selected) {
          Swal.showValidationMessage('Seleccioná un lote válido.');
          return false;
        }
        if (!UUID_REGEX.test(selectedStockPtId)) {
          console.error('UUID inválido al registrar salida de PT', {
            producto,
            loteId,
            selected,
            selectedStockPtId,
            lotes,
          });
          Swal.showValidationMessage('No se pudo resolver el UUID real del lote. Recargá el stock de PT e intentá nuevamente.');
          return false;
        }
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          Swal.showValidationMessage('Ingresá una cantidad válida mayor a 0.');
          return false;
        }
        if (cantidad > selected.stockKg) {
          Swal.showValidationMessage('La cantidad no puede superar el saldo del lote.');
          return false;
        }
        if (!motivo) {
          Swal.showValidationMessage('Ingresá un motivo de salida.');
          return false;
        }

        await ApiService.stockPT.registrarSalida({
          stock_pt_id: selectedStockPtId,
          cantidad,
          motivo,
          referencia: referencia || undefined,
          cliente_id: cliente?.uid ?? null,
          cliente_nombre: cliente?.nombre ?? null,
        });

        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo registrar la salida.';
        Swal.showValidationMessage(message);
        return false;
      }
    },
  });

  if (result.isConfirmed) {
    try {
      await onSuccess();
      void Swal.fire({
        icon: 'success',
        title: 'Salida registrada',
        text: `Se descontó stock de ${producto.nombre}.`,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb',
      });
    } catch (error) {
      void Swal.fire({
        icon: 'error',
        title: 'Salida registrada, pero falló la recarga',
        text: error instanceof Error ? error.message : 'No se pudo refrescar el stock de PT.',
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb',
      });
    }
  }
};

const openProgramacionModal = (
  productos: ProductoUi[],
  formulaByNombre: Map<string, Formula>,
  productoPreseleccionado?: ProductoUi,
  ordenProgramable?: OrdenProduccion | null,
  onSaved?: () => Promise<void> | void
) => {
  const editMode = Boolean(ordenProgramable);
  const currentProducto = productoPreseleccionado ?? productos[0];
  const fechaProgramadaInicial = ordenProgramable?.fecha_programada ?? getTodayDateInputValue();
  const cantidadInicial = editMode ? String(Number(ordenProgramable?.cantidad_objetivo ?? 0)) : '';
  const productoNombre = editMode
    ? ordenProgramable?.nombre_producto ?? currentProducto?.nombre ?? 'Sin dato'
    : currentProducto?.nombre ?? 'Sin dato';
  const formulaLabel = editMode
    ? `${ordenProgramable?.id_formula ?? 'Sin fórmula'} ${ordenProgramable?.version_formula ? `v${ordenProgramable.version_formula}` : ''}`.trim()
    : 'Información de fórmula disponible en módulo Fórmulas';
  const siloLabel = editMode
    ? ordenProgramable?.destino_silo ?? 'Sin dato'
    : currentProducto?.silo || 'Sin dato';
  const mermaLabel = editMode
    ? String(ordenProgramable?.merma_manual ?? 0)
    : 'Se calculará al finalizar';
  const loteLabel = editMode
    ? ordenProgramable?.lote ?? 'Sin dato'
    : 'Se asignará automáticamente';

  const options = productos
    .map((producto) => `<option value="${producto.uid}" ${!editMode && productoPreseleccionado?.uid === producto.uid ? 'selected' : ''}>${producto.nombre} · ${producto.lote}</option>`)
    .join('');

  const html = editMode
    ? `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <div style="margin: 0 0 12px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc;">
          <p style="margin:0 0 6px;"><strong>OP actual:</strong> ${loteLabel}</p>
          <p style="margin:0 0 6px;"><strong>Producto:</strong> ${productoNombre}</p>
          <p style="margin:0 0 6px;"><strong>Fórmula:</strong> ${formulaLabel}</p>
          <p style="margin:0 0 6px;"><strong>Cantidad:</strong> ${cantidadInicial || 'Sin dato'} kg</p>
          <p style="margin:0 0 6px;"><strong>Merma:</strong> ${mermaLabel}</p>
          <p style="margin:0;"><strong>Silo destino:</strong> ${siloLabel}</p>
        </div>
        <label style="display:block; margin: 0 0 6px;">Fecha programada</label>
        <input id="prod-fecha" type="date" value="${fechaProgramadaInicial}" style="width:100%; margin-bottom:12px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <p style="margin:0; color:#475569;">Solo la fecha programada se puede editar en esta reprogramación.</p>
      </div>
    `
    : `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <label style="display:block; margin: 0 0 6px;">Producto</label>
        <select id="prod-select" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
          <option value="">Seleccionar producto</option>
          ${options}
        </select>
        <label style="display:block; margin: 0 0 6px;">Cantidad a producir</label>
        <input id="prod-cantidad" type="number" min="1" step="100" placeholder="Ej: 10000" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <label style="display:block; margin: 0 0 6px;">Unidad</label>
        <select id="prod-unidad" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
          <option value="kg" selected>kg</option>
          <option value="ton">ton</option>
        </select>
        <label style="display:block; margin: 0 0 6px;">Fecha programada</label>
        <input id="prod-fecha" type="date" value="${fechaProgramadaInicial}" style="width:100%; margin-bottom:12px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <div style="margin:0 0 10px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; color:#334155;">
          <strong>Número de OP:</strong> se asignará automáticamente al guardar.
        </div>
        <p id="prod-formula" style="margin:0 0 6px; color:#334155;"><strong>Fórmula sugerida:</strong> Información de fórmula disponible en módulo Fórmulas</p>
        <p id="prod-silo" style="margin:0 0 6px; color:#334155;"><strong>Silo destino:</strong> Sin dato</p>
        <p id="prod-mp" style="margin:0; color:#64748b;"><strong>Stock materia prima estimado:</strong> Se validará al guardar la OP pendiente</p>
      </div>
    `;

  void Swal.fire({
    title: editMode ? 'Reprogramar producción' : 'Programar producción',
    html: `
      ${html}
    `,
    background: '#ffffff',
    color: '#0f172a',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#334155',
    confirmButtonText: editMode ? 'Actualizar fecha' : 'Programar',
    cancelButtonText: 'Cerrar',
    width: 680,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    didOpen: () => {
      const select = document.getElementById('prod-select') as HTMLSelectElement | null;
      const siloLine = document.getElementById('prod-silo');
      const fechaInput = document.getElementById('prod-fecha') as HTMLInputElement | null;

      if (fechaInput) {
        fechaInput.value = fechaProgramadaInicial;
      }

      const refreshPreview = () => {
        const selected = productos.find((item) => item.uid === select?.value);
        if (siloLine && !editMode) {
          siloLine.innerHTML = `<strong>Silo destino:</strong> ${selected?.silo || 'Sin dato'}`;
        }
      };

      if (select && !editMode) {
        select.addEventListener('change', refreshPreview);
        refreshPreview();
      }
    },
    preConfirm: async () => {
      if (editMode) {
        if (!ordenProgramable) {
          Swal.showValidationMessage('No se encontró la orden a reprogramar.');
          return false;
        }
        const fecha = (document.getElementById('prod-fecha') as HTMLInputElement | null)?.value;
        const fechaProgramada = fecha || ordenProgramable.fecha_programada || getTodayDateInputValue();
        return useOrdenService.update(ordenProgramable.id, {
          fecha_programada: fechaProgramada,
        }).catch((error: unknown) => {
          Swal.showValidationMessage(error instanceof Error ? error.message : 'No se pudo actualizar la orden de producción.');
          return false as unknown as Awaited<ReturnType<typeof useOrdenService.update>>;
        });
      }

      const selectedUid = (document.getElementById('prod-select') as HTMLSelectElement | null)?.value;
      const cantidadRaw = (document.getElementById('prod-cantidad') as HTMLInputElement | null)?.value;
      const unidad = (document.getElementById('prod-unidad') as HTMLSelectElement | null)?.value || 'kg';
      const fecha = (document.getElementById('prod-fecha') as HTMLInputElement | null)?.value;

      const selected = productos.find((item) => item.uid === selectedUid);
      const cantidad = Number(cantidadRaw);

      if (!selected) {
        Swal.showValidationMessage('Seleccioná un producto para programar.');
        return;
      }

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        Swal.showValidationMessage('Ingresá una cantidad válida mayor a 0.');
        return;
      }

      const selectedFormula = formulaByNombre.get(selected.nombre.trim().toLowerCase());
      if (!selectedFormula) {
        Swal.showValidationMessage('No se encontró una fórmula activa para este producto.');
        return;
      }

      const fechaProgramada = fecha || getTodayDateInputValue();
      const cantidadKg = unidad === 'ton' ? cantidad * 1000 : cantidad;
      const fechaCreacion = new Date(`${fechaProgramada}T00:00:00`).toISOString();
      const sessionUserName = getSessionUser().name;
      const usuarioResponsable = ['Edwin', 'Sergio Monzón', 'Usuario Admin'].includes(sessionUserName)
        ? sessionUserName
        : 'Edwin';

      return useOrdenService.create({
        lote: '',
        id_formula: selectedFormula.uid,
        nombre_producto: selectedFormula.nombre_producto,
        version_formula: selectedFormula.version,
        cantidad_objetivo: cantidadKg,
        cantidad_real: undefined,
        merma_manual: undefined,
        estado: EstadoOrden.PENDIENTE,
        fecha_creacion: fechaCreacion,
        fecha_programada: fechaProgramada,
        usuario_responsable: usuarioResponsable,
        id_silo: selected.siloLegacyUid,
        destino_silo: selected.siloLegacyUid ? selected.silo : null,
        detalle_insumos: [] as DetalleInsumoLote[],
        costo_total_insumos: 0,
      }).catch((error: unknown) => {
        Swal.showValidationMessage(error instanceof Error ? error.message : 'No se pudo crear la orden de producción.');
        return false as unknown as Awaited<ReturnType<typeof useOrdenService.create>>;
      });
    },
  }).then(async (result) => {
    if (!result.isConfirmed || !result.value) return;

    await onSaved?.();

    if (editMode) {
      const actualizada = result.value as Awaited<ReturnType<typeof useOrdenService.update>>;
      void Swal.fire({
        icon: 'success',
        title: 'OP reprogramada',
        html: `
          <div style="text-align:left; color:#0f172a; font-size:14px;">
            <p style="margin:0 0 8px;">La orden <strong>${actualizada.lote}</strong> actualizó su fecha programada.</p>
            <p style="margin:0;"><strong>Fecha programada:</strong> ${actualizada.fecha_programada || fechaProgramadaInicial}</p>
          </div>
        `,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Aceptar',
      });
      return;
    }

    const creada = result.value as Awaited<ReturnType<typeof useOrdenService.create>>;

    void Swal.fire({
      icon: 'success',
      title: 'OP pendiente creada',
      html: `
        <div style="text-align:left; color:#0f172a; font-size:14px;">
          <p style="margin:0 0 8px;">La orden <strong>${creada.lote}</strong> quedó registrada en estado <strong>${creada.estado}</strong>.</p>
          <p style="margin:0 0 8px;"><strong>Producto:</strong> ${creada.nombre_producto}</p>
          <p style="margin:0 0 8px;"><strong>Cantidad programada:</strong> ${formatKg(creada.cantidad_objetivo)}</p>
          <p style="margin:0 0 8px;"><strong>Fórmula:</strong> ${creada.id_formula}</p>
          <p style="margin:0;"><strong>Destino:</strong> ${creada.destino_silo || 'Sin dato'}</p>
        </div>
      `,
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Aceptar',
    });
  });
};

const openIngresoPTModal = async (
  ordenesEnProceso: Array<{ id: string; lote: string; nombre_producto: string; cantidad_objetivo: number; destino_silo: string | null; estado: string }>,
  silosDisponibles: Silo[],
  onConfirm: (payload: { ordenId: string; loteSalida: string; cantidadReal: number; merma: number; destinoSilo: string }) => Promise<void>
) => {
  if (ordenesEnProceso.length === 0) {
    void Swal.fire({
      icon: 'info',
      title: 'Sin órdenes en proceso',
      text: 'No hay órdenes en proceso para registrar un ingreso de PT.',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#2563eb',
    });
    return;
  }

  const options = ordenesEnProceso
    .map((orden) => `<option value="${orden.id}">${orden.lote} · ${orden.nombre_producto}</option>`)
    .join('');
  const silosOptions = silosDisponibles
    .map((silo) => `<option value="${silo.uid}">${silo.nombre}</option>`)
    .join('');

  const result = await Swal.fire({
    title: 'Registrar ingreso PT',
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <label style="display:block; margin:0 0 6px;">Orden en proceso</label>
        <select id="ingreso-pt-orden" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
          ${options}
        </select>
        <label style="display:block; margin:0 0 6px;">Lote PT</label>
        <input id="ingreso-pt-lote" type="text" placeholder="PT-2026-001" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Cantidad real</label>
        <input id="ingreso-pt-cantidad" type="number" min="1" step="0.001" placeholder="0.00" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Merma</label>
        <input id="ingreso-pt-merma" type="number" min="0" step="0.001" placeholder="0.00" value="0" style="width:100%; margin-bottom:10px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <label style="display:block; margin:0 0 6px;">Destino / silo</label>
        <select id="ingreso-pt-destino" style="width:100%; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" ${silosDisponibles.length === 0 ? 'disabled' : ''}>
          <option value="">Seleccionar silo</option>
          ${silosOptions}
        </select>
        ${silosDisponibles.length === 0 ? '<p style="margin:8px 0 0; color:#b45309; font-size:12px;">No existen silos disponibles. Cree un silo antes de registrar un ingreso PT.</p>' : ''}
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Registrar ingreso',
    cancelButtonText: 'Cancelar',
    width: 680,
    showLoaderOnConfirm: true,
    didOpen: () => {
      if (silosDisponibles.length === 0) {
        const confirmButton = Swal.getConfirmButton();
        if (confirmButton) confirmButton.disabled = true;
      }
    },
    preConfirm: async () => {
      if (silosDisponibles.length === 0) {
        Swal.showValidationMessage('No existen silos disponibles. Cree un silo antes de registrar un ingreso PT.');
        return false;
      }
      const ordenId = (document.getElementById('ingreso-pt-orden') as HTMLSelectElement | null)?.value;
      const loteSalida = (document.getElementById('ingreso-pt-lote') as HTMLInputElement | null)?.value.trim();
      const cantidadReal = Number((document.getElementById('ingreso-pt-cantidad') as HTMLInputElement | null)?.value);
      const merma = Number((document.getElementById('ingreso-pt-merma') as HTMLInputElement | null)?.value ?? 0);
      const destinoSilo = (document.getElementById('ingreso-pt-destino') as HTMLSelectElement | null)?.value.trim();
      const orden = ordenesEnProceso.find((item) => item.id === ordenId);

      if (!orden) {
        Swal.showValidationMessage('Seleccioná una orden válida.');
        return false;
      }
      if (!loteSalida) {
        Swal.showValidationMessage('El lote PT es obligatorio.');
        return false;
      }
      if (!Number.isFinite(cantidadReal) || cantidadReal <= 0) {
        Swal.showValidationMessage('La cantidad real debe ser mayor a 0.');
        return false;
      }
      if (!Number.isFinite(merma) || merma < 0) {
        Swal.showValidationMessage('La merma debe ser mayor o igual a 0.');
        return false;
      }
      if (!destinoSilo) {
        Swal.showValidationMessage('El silo destino es obligatorio.');
        return false;
      }

      await onConfirm({
        ordenId: orden.id,
        loteSalida,
        cantidadReal,
        merma,
        destinoSilo,
      });

      return true;
    },
  });

  if (result.isConfirmed) {
    void Swal.fire({
      icon: 'success',
      title: 'Ingreso PT registrado',
      text: 'El lote de producto terminado quedó disponible en stock.',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#2563eb',
    });
  }
};

const ProductosPage = () => {
  const [items, setItems] = useState<ProductoUi[]>([]);
  const [resumenPT, setResumenPT] = useState<StockProductoTerminadoResumen[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [silos, setSilos] = useState<Silo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResumenLoading, setIsResumenLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'TODOS' | EstadoProductoUi>('TODOS');
  const { ordenes, handleFinishProduction, fetchOrdenes } = useOrdenes();

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setIsResumenLoading(true);
    setLoadError(null);
    try {
      const [stock, movimientos, formulasData, clientesData, silosData] = await Promise.all([
        ApiService.stockPT.getAll(),
        ApiService.stockPT.getMovimientos().catch(() => [] as MovimientoStockPT[]),
        ApiService.formulas.findAll().catch(() => [] as Formula[]),
        ApiService.clientes.getAll().catch(() => [] as Cliente[]),
        ApiService.silos.getAll().catch(() => [] as Silo[]),
      ]);
      setItems(stock.map(toUi));
      setResumenPT(buildStockPTResumen(stock, movimientos));
      setMovimientosPT(movimientos);
      setFormulas(formulasData);
      setClientes(clientesData);
      setSilos((silosData ?? []).filter((silo) => silo.tipo_uso === 'PRODUCTO_TERMINADO'));
    } catch (error: unknown) {
      setItems([]);
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el stock de productos terminados.');
    } finally {
      setIsLoading(false);
      setIsResumenLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshData]);

  useEffect(() => {
    const handleStockPtUpdated = () => {
      void refreshData();
    };

    window.addEventListener('stock-pt-updated', handleStockPtUpdated);
    return () => window.removeEventListener('stock-pt-updated', handleStockPtUpdated);
  }, [refreshData]);

  const formulaByNombre = useMemo(() => {
    const activeSorted = [...formulas].sort((a, b) => b.version - a.version);
    const map = new Map<string, Formula>();
    activeSorted.forEach((f) => {
      const key = (f.nombre_producto ?? '').trim().toLowerCase();
      if (!key || map.has(key)) return;
      map.set(key, f);
    });
    return map;
  }, [formulas]);

  const itemsWithProteina = useMemo(() => (
    items.map((item) => {
      const formula = formulaByNombre.get(item.nombre.trim().toLowerCase());
      return {
        ...item,
        proteinaObjetivoPct: typeof formula?.proteina_calculada_pct === 'number'
          ? formula.proteina_calculada_pct
          : undefined,
      };
    })
  ), [items, formulaByNombre]);

  const itemsConOrden = useMemo(() => (
    itemsWithProteina.map((item) => {
      const ordenProgramable = findOrdenExacta(ordenes, item);
      return {
        ...item,
        fechaProgramada: ordenProgramable?.fecha_programada ?? null,
      };
    })
  ), [itemsWithProteina, ordenes]);

  const resumenRows = useMemo(() => resumenPT.map((item) => ({
    ...item,
    estadoUi: mapEstado(item.estado),
    valorMonetario: Number(item.valor_monetario ?? 0),
  })), [resumenPT]);

  const totalStockResumen = resumenRows.reduce((acc, item) => acc + item.stock_actual, 0);
  const totalValorResumen = resumenRows.reduce((acc, item) => acc + item.valorMonetario, 0);
  const productosConRiesgoResumen = resumenRows.filter((item) => item.estado !== 'OK').length;
  const useResumen = resumenRows.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return itemsConOrden.filter((item) => {
      if (estadoFiltro !== 'TODOS' && item.estadoUi !== estadoFiltro) return false;
      if (!q) return true;
      return (
        item.nombre.toLowerCase().includes(q) ||
        item.lote.toLowerCase().includes(q) ||
        item.silo.toLowerCase().includes(q)
      );
    });
  }, [itemsConOrden, query, estadoFiltro]);

  const totalStock = useResumen ? totalStockResumen : filtered.reduce((acc, item) => acc + item.stockKg, 0);
  const productosConRiesgo = useResumen ? productosConRiesgoResumen : filtered.filter((item) => item.estadoUi !== 'OK').length;
  const valorInventarioPT = useResumen ? totalValorResumen : filtered.reduce((acc, item) => acc + item.valorEstimado, 0);
  const proteinasDisponibles = filtered
    .map((item) => item.proteinaObjetivoPct)
    .filter((value): value is number => typeof value === 'number');
  const proteinaPromedio = proteinasDisponibles.length > 0
    ? proteinasDisponibles.reduce((acc, value) => acc + value, 0) / proteinasDisponibles.length
    : null;

  const ordenesEnProceso = ordenes.filter((orden) => orden.estado === EstadoOrden.EN_PROCESO);
  const ordenesProgramadas = ordenes.filter((orden) => orden.estado === EstadoOrden.PENDIENTE || orden.estado === EstadoOrden.EN_PROCESO);
  const silosProductoTerminado = silos.filter((silo) => silo.tipo_uso === 'PRODUCTO_TERMINADO');
  const handleProgramarProduccion = useCallback(
    (producto: ProductoUi) => {
      const ordenProgramable = findOrdenEditable(ordenes, producto);
      void openProgramacionModal(itemsConOrden, formulaByNombre, producto, ordenProgramable, async () => {
        await fetchOrdenes();
        await refreshData();
      });
    },
    [itemsConOrden, formulaByNombre, ordenes, fetchOrdenes, refreshData]
  );

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Inventario</p>
        <h1 className="text-3xl font-bold mt-2">Stock de Productos Terminados</h1>
        <p className="text-slate-500 mt-2">Control operativo de producto terminado conectado a stock PT.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Stock total PT</p>
          <h2 className="text-3xl font-black mt-2">{totalStock.toLocaleString('es-AR')} kg</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Productos críticos/bajos</p>
          <h2 className="text-3xl font-black mt-2 text-amber-300">{productosConRiesgo}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Valor estimado PT</p>
          <h2 className="text-2xl font-black mt-2 text-blue-300">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valorInventarioPT)}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Lotes activos</p>
          <h2 className="text-2xl font-black mt-2 text-cyan-300">{useResumen ? resumenRows.reduce((acc, item) => acc + item.cantidad_lotes, 0) : itemsWithProteina.length}</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Proteína objetivo PT</p>
          <h2 className="text-2xl font-black mt-2 text-indigo-300">{proteinaPromedio !== null ? `${proteinaPromedio.toFixed(2)}%` : 'Sin dato'}</h2>
        </Card>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold">Producción programada</h2>
            <p className="text-sm text-slate-500">Órdenes de producción pendientes o en proceso con fecha programada.</p>
          </div>
          <p className="text-xs text-slate-500">{ordenesProgramadas.length} órdenes</p>
        </div>

        {ordenesProgramadas.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No hay órdenes de producción programadas para mostrar.</div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">OP / lote</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Cantidad objetivo</th>
                  <th className="px-4 py-3">Fecha programada</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Silo destino</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesProgramadas.map((orden) => (
                  <tr key={orden.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{orden.lote}</td>
                    <td className="px-4 py-3">{orden.nombre_producto}</td>
                    <td className="px-4 py-3">{formatKg(Number(orden.cantidad_objetivo ?? 0))}</td>
                    <td className="px-4 py-3">{orden.fecha_programada ? formatDate(orden.fecha_programada) : 'Sin dato'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusStyles(orden.estado === EstadoOrden.EN_PROCESO ? 'Bajo' : 'OK')}`}>
                        {orden.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">{orden.destino_silo || 'Sin dato'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openOrdenProgramadaDetail(orden, formulaByNombre.get(orden.nombre_producto.trim().toLowerCase()) ?? null)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void openProgramacionModal(itemsConOrden, formulaByNombre, undefined, orden, async () => {
                              await fetchOrdenes();
                              await refreshData();
                            });
                          }}
                          className="h-8 px-3 rounded-lg border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Reprogramar
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

      <Card>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold">Resumen consolidado de Producto Terminado</h2>
            <p className="text-sm text-slate-500">Saldo por producto, valor monetario y estado operativo.</p>
          </div>
          <p className="text-xs text-slate-500">{movimientosPT.length} movimientos registrados</p>
        </div>

        {isResumenLoading && resumenRows.length === 0 ? (
          <div className="py-10 text-center text-slate-500">Cargando resumen de PT...</div>
        ) : null}

        {!isResumenLoading && resumenRows.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No hay stock de PT consolidado para mostrar.</div>
        ) : null}

        {resumenRows.length > 0 ? (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1200px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Fórmula / versión</th>
                  <th className="px-4 py-3">Saldo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Lotes</th>
                  <th className="px-4 py-3">Última actualización</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {resumenRows.map((row, index) => {
                  const lotesDelProducto = itemsWithProteina.filter((item) => item.nombre.trim().toLowerCase() === row.nombre_producto.trim().toLowerCase());
                  const formulaLabel = row.id_formula || row.version_formula
                    ? `${row.id_formula ?? 'Sin fórmula'} ${row.version_formula ? `v${row.version_formula}` : ''}`
                    : 'Derivada desde OP';

                  return (
                    <tr key={`${row.producto_id ?? row.numero_orden ?? row.nombre_producto}-${index}`} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{row.nombre_producto}</td>
                      <td className="px-4 py-3 text-slate-700">{formulaLabel}</td>
                      <td className="px-4 py-3">{formatKg(row.stock_actual)}</td>
                      <td className="px-4 py-3">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(row.valorMonetario)}</td>
                      <td className="px-4 py-3">{row.cantidad_lotes}</td>
                      <td className="px-4 py-3">{formatDate(row.ultima_actualizacion)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusStyles(row.estadoUi)}`}>
                          {row.estadoUi}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openSalidaModal(
                            {
                              dbId: lotesDelProducto[0]?.dbId ?? '',
                              uid: row.producto_id ?? row.nombre_producto,
                              nombre: row.nombre_producto,
                              stockKg: row.stock_actual,
                              valorEstimado: row.valorMonetario,
                              silo: 'Consolidado',
                              siloLegacyUid: null,
                              lote: 'CONSOLIDADO',
                              estadoUi: row.estadoUi,
                              fechaIngreso: row.ultima_actualizacion,
                              orden: row.numero_orden || 'Sin dato',
                              ordenId: null,
                              fechaProgramada: null,
                              idFormula: row.id_formula,
                              versionFormula: row.version_formula,
                              detalleInsumos: [],
                            },
                            lotesDelProducto,
                            clientes,
                            async () => { await refreshData(); }
                          )}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Registrar salida
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
          <h2 className="text-xl font-semibold">Stock de Productos Terminados</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto, lote o silo"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as 'TODOS' | EstadoProductoUi)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="TODOS">Todos</option>
              <option value="OK">OK</option>
              <option value="Bajo">Bajo</option>
              <option value="Crítico">Crítico</option>
            </select>
            <button
              type="button"
              disabled={silosProductoTerminado.length === 0}
              onClick={() => {
                void openIngresoPTModal(ordenesEnProceso.map((orden) => ({
                  id: orden.id,
                  lote: orden.lote,
                  nombre_producto: orden.nombre_producto,
                  cantidad_objetivo: orden.cantidad_objetivo,
                  destino_silo: orden.destino_silo,
                  estado: orden.estado,
                })), silosProductoTerminado, async ({ ordenId, loteSalida, cantidadReal, merma, destinoSilo }) => {
                  await handleFinishProduction(ordenId, {
                    lote_salida: loteSalida,
                    cantidad_real: cantidadReal,
                    merma,
                    destino_silo: destinoSilo,
                  });
                  await refreshData();
                });
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Registrar ingreso PT
            </button>
          </div>
        </div>
        {silosProductoTerminado.length === 0 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No existen silos disponibles. Cree un silo antes de registrar un ingreso PT.
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            <p className="mt-3 text-sm text-slate-500">Cargando stock de productos terminados...</p>
          </div>
        ) : null}

        {!isLoading && itemsWithProteina.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No hay productos terminados cargados.
          </div>
        ) : null}

        {!isLoading && itemsWithProteina.length > 0 && filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No hay resultados para la búsqueda/filtro aplicado.
          </div>
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="pb-3">Producto</th>
                  <th className="pb-3">Lote PT</th>
                  <th className="pb-3">Orden</th>
                  <th className="pb-3">Silo</th>
                  <th className="pb-3">Stock disponible</th>
                  <th className="pb-3">Valor estimado ARS</th>
                  <th className="pb-3">Fecha programada</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((producto) => (
                  <tr key={producto.uid} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 font-medium">{producto.nombre}</td>
                    <td className="py-3">{producto.lote || 'Sin dato'}</td>
                    <td className="py-3">{producto.orden || 'Sin dato'}</td>
                    <td className="py-3">{producto.silo || 'Sin dato'}</td>
                    <td className="py-3">{formatKg(producto.stockKg)}</td>
                    <td className="py-3">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(producto.valorEstimado)}</td>
                    <td className="py-3">{producto.fechaProgramada ? formatDate(producto.fechaProgramada) : 'Sin dato'}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusStyles(producto.estadoUi)}`}>
                        {producto.estadoUi}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openStockDetail(producto, movimientosPT, findOrdenExacta(ordenes, producto))}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={() => openSalidaModal(producto, itemsWithProteina.filter((item) => item.nombre.trim().toLowerCase() === producto.nombre.trim().toLowerCase()), clientes, refreshData)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Registrar salida
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProgramarProduccion(producto)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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
        ) : null}
      </Card>
    </div>
  );
};

export default ProductosPage;
