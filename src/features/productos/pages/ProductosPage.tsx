import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { Card } from '../../../shared/components/card';
import { ROUTES } from '../../../app/config/routes';
import { ApiService } from '../../../infrastructure/api';
import { getSessionUser } from '../../auth/session';
import { useOrdenes } from '../../ordenes/hooks/useOrdenes';
import { useOrdenService } from '../../ordenes/services';
import { EstadoOrden, type DetalleInsumoLote } from '../../ordenes/types';
import { ControlEstado, type MovimientoStockPT, type StockProductoTerminado, type StockProductoTerminadoResumen } from '../types';
import type { Formula } from '../../formulas/types';
import type { Cliente } from '../../clientes/types/cliente';
import { buildStockPTResumen } from '../utils/stockPtResumen';
import type { Silo } from '../../silos/types';
import { getProductoEmpaquesKeys } from '../utils/empaquesProducto';

type EstadoProductoUi = 'OK' | 'Bajo' | 'Crítico';

interface ProductoUi {
  dbId: string;
  uid: string;
  nombre: string;
  stockKg: number;
  valorEstimado: number;
  silo: string;
  siloLegacyUid: string | null;
  lote: string;
  estadoUi: EstadoProductoUi;
  fechaIngreso: string;
  orden: string;
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
  nombre: item.nombre_producto || 'Sin dato',
  stockKg: Number(item.cantidad_total ?? 0),
  valorEstimado: Number(item.cantidad_total ?? 0) * Number(item.costo_unitario_estimado ?? 0),
  silo: item.nombre_silo || 'Sin dato',
  siloLegacyUid: item.id_silo || null,
  lote: item.lote || 'Sin dato',
  estadoUi: mapEstado(item.estado),
  fechaIngreso: item.fecha_ingreso,
  orden: item.numero_orden || item.id_orden || 'Sin dato',
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

const formatProteina = (value?: number) => (
  typeof value === 'number' ? `${value.toFixed(2)}%` : 'Sin dato'
);

const formatEmpaqueLabel = (item: { tipo_empaque: string; capacidad_kg: number }) => (
  `${item.tipo_empaque === 'BOLSA' ? 'Bolsa' : 'Big Bag'} · ${Number(item.capacidad_kg)} kg`
);

const loadEmpaquesByProducto = async (producto: ProductoUi) => {
  const keys = getProductoEmpaquesKeys(producto);
  const rows = (await Promise.all(keys.map((key) => ApiService.empaquesProducto.listByProducto(key)))).flat();
  return Array.from(new Map(rows.map((item) => [item.id, item])).values());
};

const openEmpaquesProductoModal = async (producto: ProductoUi, onRefresh: () => Promise<void>) => {
  const refreshAndReopen = async () => {
    await onRefresh();
    await openEmpaquesProductoModal(producto, onRefresh);
  };

  const loadRows = async () => {
    const rows = await loadEmpaquesByProducto(producto);
    const activos = rows.filter((item) => item.activo);
    const inactivos = rows.filter((item) => !item.activo);
    return { rows, activos, inactivos };
  };

  const { rows } = await loadRows();

  const htmlList = rows.length > 0
    ? rows
        .map((item) => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:8px; background:${item.activo ? '#f8fafc' : '#fff7ed'};">
            <div>
              <div style="font-weight:700; color:#0f172a;">${formatEmpaqueLabel(item)}</div>
              <div style="font-size:12px; color:${item.activo ? '#64748b' : '#c2410c'};">${item.activo ? 'Activo' : 'Inactivo'}</div>
            </div>
            <button
              type="button"
              class="toggle-empaque-btn"
              data-id="${item.id}"
              data-active="${item.activo ? '1' : '0'}"
              style="border:1px solid #cbd5e1; background:#fff; color:#0f172a; border-radius:10px; padding:8px 12px; font-size:12px; font-weight:700;"
            >${item.activo ? 'Desactivar' : 'Activar'}</button>
          </div>
        `)
        .join('')
    : '<div style="padding:12px; border:1px dashed #f59e0b; border-radius:12px; background:#fffbeb; color:#b45309;">Este producto todavía no tiene empaques configurados.</div>';

  const result = await Swal.fire({
    title: `Empaques de ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 12px;"><strong>Clave de producto:</strong> ${getProductoEmpaquesKeys(producto).join(' · ')}</p>
        <div style="margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button type="button" id="add-bolsa" style="border:none; border-radius:12px; padding:10px 12px; font-weight:700; background:#dbeafe; color:#1d4ed8;">Agregar Bolsa</button>
          <button type="button" id="add-bigbag" style="border:none; border-radius:12px; padding:10px 12px; font-weight:700; background:#e0f2fe; color:#0369a1;">Agregar Big Bag</button>
        </div>
        <div id="empaques-list">
          ${htmlList}
        </div>
        <p style="margin:10px 0 0; color:#475569; font-size:12px;">Bolsa: 15, 20, 25, 40 kg. Big Bag: 500, 1000 kg.</p>
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    showCancelButton: true,
    confirmButtonText: 'Cerrar',
    cancelButtonText: 'Salir',
    confirmButtonColor: '#2563eb',
    width: 720,
    didOpen: () => {
      const add = async (tipo: 'BOLSA' | 'BIG_BAG') => {
        const capacidades = tipo === 'BOLSA' ? [15, 20, 25, 40] : [500, 1000];
        const { value: capacidad } = await Swal.fire({
          title: `Agregar ${tipo === 'BOLSA' ? 'Bolsa' : 'Big Bag'}`,
          input: 'select',
          inputOptions: capacidades.reduce<Record<string, string>>((acc, cap) => {
            acc[String(cap)] = `${cap} kg`;
            return acc;
          }, {}),
          inputPlaceholder: 'Seleccionar capacidad',
          showCancelButton: true,
          confirmButtonText: 'Guardar',
          cancelButtonText: 'Cancelar',
          background: '#ffffff',
          color: '#0f172a',
          confirmButtonColor: '#2563eb',
        });

        if (!capacidad) return;
        await ApiService.empaquesProducto.create({
          producto_id: getProductoEmpaquesKeys(producto)[0],
          tipo_empaque: tipo,
          capacidad_kg: Number(capacidad) as 15 | 20 | 25 | 40 | 500 | 1000,
        });
        Swal.close();
        await refreshAndReopen();
      };

      const addBolsa = document.getElementById('add-bolsa');
      const addBigBag = document.getElementById('add-bigbag');
      addBolsa?.addEventListener('click', () => { void add('BOLSA'); });
      addBigBag?.addEventListener('click', () => { void add('BIG_BAG'); });

      document.querySelectorAll<HTMLButtonElement>('.toggle-empaque-btn').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.dataset.id ?? '';
          const activo = button.dataset.active === '1';
          await ApiService.empaquesProducto.toggleActive(id, !activo);
          Swal.close();
          await refreshAndReopen();
        });
      });
    },
  });

  if (result.isConfirmed) return;
};

const openFormulaDetail = (producto: ProductoUi) => {
  void Swal.fire({
    title: `Fórmula de ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Lote PT:</strong> ${producto.lote}</p>
        <p style="margin:0 0 8px;"><strong>Orden asociada:</strong> ${producto.orden}</p>
        <p style="margin:0 0 8px;"><strong>Fórmula:</strong> ${producto.idFormula ?? 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Versión:</strong> ${producto.versionFormula ?? 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Proteína objetivo:</strong> ${formatProteina(producto.proteinaObjetivoPct)}</p>
        <p style="margin:0;"><strong>Fórmula:</strong> Información de fórmula disponible en módulo Fórmulas</p>
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Cerrar',
    width: 620,
  });
};

const openStockDetail = (producto: ProductoUi) => {
  const ingredientes = producto.detalleInsumos
    .slice(0, 5)
    .map((i) => `${i.nombre_insumo || 'Sin dato'} (${Number(i.cantidad ?? 0).toLocaleString('es-AR')} ${i.unidad_medida || 'KG'})`)
    .join(', ');

  void Swal.fire({
    title: `Ficha técnica · ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Lote PT:</strong> ${producto.lote || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Silo asociado:</strong> ${producto.silo || 'Sin dato'}</p>
        <p style="margin:0 0 8px;"><strong>Stock disponible:</strong> ${formatKg(producto.stockKg)}</p>
        <p style="margin:0 0 8px;"><strong>Estado operativo:</strong> ${producto.estadoUi}</p>
        <p style="margin:0 0 8px;"><strong>Último ingreso:</strong> ${formatDate(producto.fechaIngreso)}</p>
        <p style="margin:0 0 8px;"><strong>Proteína objetivo:</strong> ${formatProteina(producto.proteinaObjetivoPct)}</p>
        <p style="margin:0 0 8px;"><strong>Valor estimado:</strong> ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(producto.valorEstimado)}</p>
        <p style="margin:0 0 8px;"><strong>Detalle insumos:</strong> ${ingredientes || 'Sin dato'}</p>
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
  productoPreseleccionado?: ProductoUi
) => {
  const options = productos
    .map((producto) => `<option value="${producto.uid}" ${productoPreseleccionado?.uid === producto.uid ? 'selected' : ''}>${producto.nombre} · ${producto.lote}</option>`)
    .join('');

  void Swal.fire({
    title: 'Programar producción',
    html: `
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
          <option value="kg">kg</option>
          <option value="ton">ton</option>
        </select>
        <label style="display:block; margin: 0 0 6px;">Fecha estimada</label>
        <input id="prod-fecha" type="date" style="width:100%; margin-bottom:12px; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; padding:8px;" />
        <div style="margin:0 0 10px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; color:#334155;">
          <strong>Número de OP:</strong> se asignará automáticamente al guardar.
        </div>
        <p id="prod-formula" style="margin:0 0 6px; color:#334155;"><strong>Fórmula sugerida:</strong> Información de fórmula disponible en módulo Fórmulas</p>
        <p id="prod-silo" style="margin:0 0 6px; color:#334155;"><strong>Silo destino:</strong> Sin dato</p>
        <p id="prod-mp" style="margin:0; color:#64748b;"><strong>Stock materia prima estimado:</strong> Se validará al guardar la OP pendiente</p>
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Programar',
    cancelButtonText: 'Cerrar',
    width: 680,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    didOpen: () => {
      const select = document.getElementById('prod-select') as HTMLSelectElement | null;
      const siloLine = document.getElementById('prod-silo');
      const fechaInput = document.getElementById('prod-fecha') as HTMLInputElement | null;

      if (fechaInput) {
        const today = new Date();
        const isoDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        fechaInput.value = isoDate;
      }

      const refreshPreview = () => {
        const selected = productos.find((item) => item.uid === select?.value);
        if (siloLine) {
          siloLine.innerHTML = `<strong>Silo destino:</strong> ${selected?.silo || 'Sin dato'}`;
        }
      };

      select?.addEventListener('change', refreshPreview);
      refreshPreview();
    },
    preConfirm: () => {
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

      const fechaProgramada = fecha || new Date().toISOString().slice(0, 10);
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
  }).then((result) => {
    if (!result.isConfirmed || !result.value) return;

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
  const navigate = useNavigate();
  const { ordenes, handleFinishProduction } = useOrdenes();

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
    return itemsWithProteina.filter((item) => {
      if (estadoFiltro !== 'TODOS' && item.estadoUi !== estadoFiltro) return false;
      if (!q) return true;
      return (
        item.nombre.toLowerCase().includes(q) ||
        item.lote.toLowerCase().includes(q) ||
        item.silo.toLowerCase().includes(q)
      );
    });
  }, [itemsWithProteina, query, estadoFiltro]);

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
  const silosProductoTerminado = silos.filter((silo) => silo.tipo_uso === 'PRODUCTO_TERMINADO');

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
            <table className="w-full min-w-[1300px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="pb-3">Producto</th>
                  <th className="pb-3">Fórmula / versión</th>
                  <th className="pb-3">Proteína objetivo</th>
                  <th className="pb-3">Lote PT</th>
                  <th className="pb-3">Orden</th>
                  <th className="pb-3">Silo</th>
                  <th className="pb-3">Stock disponible</th>
                  <th className="pb-3">Valor estimado ARS</th>
                  <th className="pb-3">Último ingreso</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((producto) => (
                  <tr key={producto.uid} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 font-medium">{producto.nombre}</td>
                    <td className="py-3">
                      {producto.idFormula || producto.versionFormula
                        ? `${producto.idFormula ?? 'Sin fórmula'} ${producto.versionFormula ? `v${producto.versionFormula}` : ''}`
                        : 'Derivada desde OP'}
                    </td>
                    <td className="py-3">{formatProteina(producto.proteinaObjetivoPct)}</td>
                    <td className="py-3">{producto.lote || 'Sin dato'}</td>
                    <td className="py-3">{producto.orden || 'Sin dato'}</td>
                    <td className="py-3">{producto.silo || 'Sin dato'}</td>
                    <td className="py-3">{formatKg(producto.stockKg)}</td>
                    <td className="py-3">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(producto.valorEstimado)}</td>
                    <td className="py-3">{formatDate(producto.fechaIngreso)}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusStyles(producto.estadoUi)}`}>
                        {producto.estadoUi}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openFormulaDetail(producto)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver fórmula
                        </button>
                        <button
                          type="button"
                          onClick={() => openStockDetail(producto)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver stock
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
                          onClick={() => { void openEmpaquesProductoModal(producto, refreshData); }}
                          className="h-8 px-3 rounded-lg border border-cyan-200 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                        >
                          Empaques
                        </button>
                        <button
                          type="button"
                          onClick={() => openProgramacionModal(filtered, formulaByNombre, producto)}
                          className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Programar producción
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(ROUTES.TRAZABILIDAD)}
                          className="h-8 px-3 rounded-lg border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Trazabilidad
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
