import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { ApiService } from '../../../infrastructure/api';
import { ControlEstado, type StockProductoTerminado } from '../types';
import type { Formula } from '../../formulas/types';

type EstadoProductoUi = 'OK' | 'Bajo' | 'Crítico';

interface ProductoUi {
  uid: string;
  nombre: string;
  stockKg: number;
  silo: string;
  lote: string;
  estadoUi: EstadoProductoUi;
  fechaIngreso: string;
  orden: string;
  costoArsTon?: number;
  proteinaObjetivoPct?: number;
  detalleInsumos: StockProductoTerminado['detalle_insumos'][];
}

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin dato';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
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
  return Array.isArray(detalle) ? detalle : [detalle];
};

const toUi = (item: StockProductoTerminado): ProductoUi => ({
  uid: item.uid,
  nombre: item.nombre_producto || 'Sin dato',
  stockKg: Number(item.cantidad_total ?? 0),
  silo: item.nombre_silo || 'Sin dato',
  lote: item.lote || 'Sin dato',
  estadoUi: mapEstado(item.estado),
  fechaIngreso: item.fecha_ingreso,
  orden: item.numero_orden || item.id_orden || 'Sin dato',
  costoArsTon: undefined,
  proteinaObjetivoPct: undefined,
  detalleInsumos: toArrayDetalle(item.detalle_insumos),
});

const formatProteina = (value?: number) => (
  typeof value === 'number' ? `${value.toFixed(2)}%` : 'Sin dato'
);

const openFormulaDetail = (producto: ProductoUi) => {
  void Swal.fire({
    title: `Fórmula de ${producto.nombre}`,
    html: `
      <div style="text-align:left; color:#0f172a; font-size:14px;">
        <p style="margin:0 0 8px;"><strong>Lote PT:</strong> ${producto.lote}</p>
        <p style="margin:0 0 8px;"><strong>Orden asociada:</strong> ${producto.orden}</p>
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
        <p style="margin:0 0 8px;"><strong>Detalle insumos:</strong> ${ingredientes || 'Sin dato'}</p>
        <p style="margin:0; color:#334155;"><strong>Valor estimado:</strong> Valor estimado no disponible</p>
      </div>
    `,
    background: '#ffffff',
    color: '#0f172a',
    confirmButtonColor: '#2563eb',
    confirmButtonText: 'Cerrar',
    width: 640,
  });
};

const openProgramacionModal = (productos: ProductoUi[], productoPreseleccionado?: ProductoUi) => {
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
        <p id="prod-formula" style="margin:0 0 6px; color:#334155;"><strong>Fórmula sugerida:</strong> Información de fórmula disponible en módulo Fórmulas</p>
        <p id="prod-silo" style="margin:0 0 6px; color:#334155;"><strong>Silo destino:</strong> Sin dato</p>
        <p id="prod-mp" style="margin:0; color:#64748b;"><strong>Stock materia prima estimado:</strong> Cobertura de MP disponible en validación operativa</p>
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

      return { selected, cantidad, unidad, fecha: fecha || 'Sin dato' };
    },
  }).then((result) => {
    if (!result.isConfirmed || !result.value) return;

    const { selected, cantidad, unidad, fecha } = result.value as {
      selected: ProductoUi;
      cantidad: number;
      unidad: string;
      fecha: string;
    };

    const cantidadLabel = unidad === 'ton'
      ? `${cantidad.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ton`
      : formatKg(cantidad);

    void Swal.fire({
      icon: 'success',
      title: 'Programación preparada',
      html: `
        <div style="text-align:left; color:#0f172a; font-size:14px;">
          <p style="margin:0 0 8px;">Orden preparada para <strong>${cantidadLabel}</strong> de <strong>${selected.nombre}</strong>.</p>
          <p style="margin:0 0 8px;"><strong>Silo destino:</strong> ${selected.silo || 'Sin dato'}</p>
          <p style="margin:0;"><strong>Fecha estimada:</strong> ${fecha === 'Sin dato' ? 'Sin dato' : formatDate(fecha)}</p>
        </div>
      `,
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Aceptar',
    });
  });
};

const ProductosPage = () => {
  const [items, setItems] = useState<ProductoUi[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'TODOS' | EstadoProductoUi>('TODOS');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [stock, formulasData] = await Promise.all([
          ApiService.stockPT.getAll(),
          ApiService.formulas.findAll().catch(() => [] as Formula[]),
        ]);
        setItems(stock.map(toUi));
        setFormulas(formulasData);
      } catch (error: unknown) {
        setItems([]);
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el stock de productos terminados.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

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

  const totalStock = filtered.reduce((acc, item) => acc + item.stockKg, 0);
  const productosConRiesgo = filtered.filter((item) => item.estadoUi !== 'OK').length;
  const proteinasDisponibles = filtered
    .map((item) => item.proteinaObjetivoPct)
    .filter((value): value is number => typeof value === 'number');
  const proteinaPromedio = proteinasDisponibles.length > 0
    ? proteinasDisponibles.reduce((acc, value) => acc + value, 0) / proteinasDisponibles.length
    : null;

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
          <h2 className="text-2xl font-black mt-2 text-blue-300">Valor estimado no disponible</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Cobertura promedio</p>
          <h2 className="text-2xl font-black mt-2 text-cyan-300">Cobertura no disponible</h2>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest text-slate-500">Proteína objetivo PT</p>
          <h2 className="text-2xl font-black mt-2 text-indigo-300">{proteinaPromedio !== null ? `${proteinaPromedio.toFixed(2)}%` : 'Sin dato'}</h2>
        </Card>
      </section>

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
              onClick={() => openProgramacionModal(filtered.length > 0 ? filtered : itemsWithProteina)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white"
            >
              Registrar producción
            </button>
          </div>
        </div>

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
                  <th className="pb-3">Fórmula asociada</th>
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
                    <td className="py-3">Información de fórmula disponible en módulo Fórmulas</td>
                    <td className="py-3">{formatProteina(producto.proteinaObjetivoPct)}</td>
                    <td className="py-3">{producto.lote || 'Sin dato'}</td>
                    <td className="py-3">{producto.orden || 'Sin dato'}</td>
                    <td className="py-3">{producto.silo || 'Sin dato'}</td>
                    <td className="py-3">{formatKg(producto.stockKg)}</td>
                    <td className="py-3">Valor estimado no disponible</td>
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
                          onClick={() => openProgramacionModal(filtered, producto)}
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
