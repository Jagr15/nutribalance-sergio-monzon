// src/features/insumos/pages/StockMateriaPrimaPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useStockMateriaPrima } from '../hooks';
import StockMateriaPrimaTable from '../components/StockMateriaPrimaTable';
import StockMateriaPrimaModal from '../components/StockMateriaPrimaModal';
import { ApiService } from '../../../infrastructure/api';
import type {
  HistorialCompraMP,
  Insumo,
  StockMateriaPrimaResumen,
  UltimoPrecioPagadoInsumo,
} from '../types';
import type { Proveedor } from '../../proveedores/types';
import Swal from 'sweetalert2';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';

const formatterMoneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

const formatterNumero = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 3,
});

const formatterFecha = (value: string | Date | null | undefined) => formatDateDDMMYYYY(value);

const StockMateriaPrimaPage: React.FC = () => {
  const { lotes, isLoading, loadError, getAll, remove } = useStockMateriaPrima();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<StockMateriaPrimaResumen[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [comprasLoading, setComprasLoading] = useState(true);
  const [comprasError, setComprasError] = useState<string | null>(null);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [historialCompras, setHistorialCompras] = useState<HistorialCompraMP[]>([]);
  const [ultimosPrecios, setUltimosPrecios] = useState<UltimoPrecioPagadoInsumo[]>([]);

  const loadResumen = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const data = await ApiService.stockMP.getResumen();
      setResumen(data);
      setSummaryError(null);
    } catch (err) {
      console.error('Error cargando resumen de stock MP:', err);
      setSummaryError('No se pudo cargar el resumen consolidado de stock.');
      setResumen([]);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadComprasInfo = useCallback(async () => {
    try {
      setComprasLoading(true);
      const [historial, ultimos] = await Promise.all([
        ApiService.stockMP.getHistorialCompras(),
        ApiService.stockMP.getUltimosPrecios(),
      ]);
      setHistorialCompras(historial);
      setUltimosPrecios(ultimos);
      setComprasError(null);
    } catch (err) {
      console.error('Error cargando historial de compras MP:', err);
      setComprasError('No se pudo cargar el historial de compras de materia prima.');
      setHistorialCompras([]);
      setUltimosPrecios([]);
    } finally {
      setComprasLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([getAll(), loadResumen(), loadComprasInfo()]);
  }, [getAll, loadComprasInfo, loadResumen]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [resI, resP] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.proveedores.getAll(),
          getAll(),
          loadResumen(),
          loadComprasInfo(),
        ]);
        setInsumos(resI);
        setProveedores(resP);
      } catch (error) {
        console.error('Error cargando catálogos:', error);
        setError('No se pudieron cargar los catálogos de insumos/proveedores.');
      }
    };

    void initialize();
  }, [getAll, loadComprasInfo, loadResumen]);

  const handleDelete = async (uid: string) => {
    const result = await Swal.fire({
      title: '¿DESACTIVAR LOTE?',
      text: 'Se marcará como inactivo y dejará de estar disponible en listados operativos.',
      icon: 'warning',
      showCancelButton: true,
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'SÍ, DESACTIVAR',
      cancelButtonText: 'CANCELAR',
    });

    if (result.isConfirmed) {
      try {
        await remove(uid);
        Swal.fire({
          icon: 'success',
          title: 'Lote desactivado',
          background: '#ffffff',
          color: '#0f172a',
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error inesperado';
        Swal.fire({ icon: 'error', title: 'Error', text: message, background: '#ffffff', color: '#0f172a' });
      }
    }
  };

  const noData = resumen.length === 0;
  const combinedError = error ?? loadError ?? summaryError ?? comprasError;
  const isBusy = isLoading || summaryLoading || comprasLoading;
  const comprasRegistradas = historialCompras.length;
  const proveedoresActivos = proveedores.filter((proveedor) => proveedor.esta_activo).length;
  const ultimaCompra = historialCompras[0] ?? null;
  const latestPricesPreview = ultimosPrecios.slice(0, 10);
  const recentPurchases = historialCompras.slice(0, 10);
  const showLoadingCards = isBusy && comprasRegistradas === 0 && resumen.length === 0;

  const formatDate = (value: string | Date | null | undefined) => formatterFecha(value);
  const formatCurrency = (value: number) => formatterMoneda.format(value);
  const formatNumber = (value: number) => formatterNumero.format(value);

  return (
    <main className="main animate-fade-in p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-blue-500 font-bold mb-2">OPERACIONES / ALMACÉN</p>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Stock Materia Prima</h1>
          <p className="text-sm text-slate-500 mt-2">Inventario de materia prima con alertas automáticas por nivel de stock y umbral crítico.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <FiPlus size={20} /> Registrar Ingreso
        </button>
      </header>

      <section className="mb-8 space-y-6">
        {combinedError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-bold">Compras registradas</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{showLoadingCards ? '—' : comprasRegistradas}</p>
            <p className="mt-2 text-xs text-slate-500">Historial consolidado de ingresos MP.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-bold">Proveedores activos</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{showLoadingCards ? '—' : proveedoresActivos}</p>
            <p className="mt-2 text-xs text-slate-500">Catálogo de proveedores con estado vigente.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-bold">Última compra</p>
            <p className="mt-3 text-xl font-black text-slate-900">
              {showLoadingCards ? 'Cargando...' : ultimaCompra ? formatCurrency(ultimaCompra.costo_total) : 'Sin compras'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {showLoadingCards ? 'Sincronizando historial...' : ultimaCompra ? `${ultimaCompra.insumo} • ${ultimaCompra.proveedor}` : 'Todavía no hay ingresos de MP.'}
            </p>
            {ultimaCompra && !showLoadingCards ? (
              <p className="mt-1 text-[11px] text-slate-400">{formatDate(ultimaCompra.fecha_compra)}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-black text-slate-900">Último precio pagado por insumo</h2>
              <p className="text-sm text-slate-500 mt-1">Comparación entre la última compra y la anterior.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-3">Insumo</th>
                    <th className="text-left px-5 py-3">Último proveedor</th>
                    <th className="text-right px-5 py-3">Último precio</th>
                    <th className="text-right px-5 py-3">Anterior</th>
                    <th className="text-right px-5 py-3">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {showLoadingCards ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                        Cargando precios recientes...
                      </td>
                    </tr>
                  ) : latestPricesPreview.map((row) => {
                    const variacionPct = row.variacion_pct;
                    const tone =
                      variacionPct === null || variacionPct === 0
                        ? 'text-slate-600 bg-slate-100'
                        : variacionPct > 0
                          ? 'text-red-700 bg-red-50'
                          : 'text-emerald-700 bg-emerald-50';
                    const sign = variacionPct === null ? 'N/D' : `${variacionPct > 0 ? '+' : ''}${variacionPct.toFixed(2)}%`;
                    return (
                      <tr key={row.id_insumo} className="border-t border-slate-100">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">{row.insumo}</p>
                          <p className="text-[11px] text-slate-500">{formatDate(row.fecha_ultima_compra)}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-700">{row.ultimo_proveedor}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.ultimo_precio)}</td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {row.precio_compra_anterior === null ? 'N/D' : formatCurrency(row.precio_compra_anterior)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
                            {sign}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!showLoadingCards && !latestPricesPreview.length ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-500">
                        No hay precios recientes para mostrar.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-black text-slate-900">Historial de compras MP</h2>
              <p className="text-sm text-slate-500 mt-1">Ingresos recientes con proveedor, lote y costo.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-3">Fecha</th>
                    <th className="text-left px-5 py-3">Proveedor</th>
                    <th className="text-left px-5 py-3">Insumo</th>
                    <th className="text-left px-5 py-3">Lote</th>
                    <th className="text-right px-5 py-3">Cantidad</th>
                    <th className="text-right px-5 py-3">Costo unitario</th>
                    <th className="text-right px-5 py-3">Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {showLoadingCards ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-sm text-slate-500">
                        Cargando historial de compras...
                      </td>
                    </tr>
                  ) : recentPurchases.map((row) => (
                    <tr key={`${row.id_insumo}-${row.lote}-${row.fecha_compra}`} className="border-t border-slate-100">
                      <td className="px-5 py-3 text-slate-600">{formatDate(row.fecha_compra)}</td>
                      <td className="px-5 py-3 text-slate-700">{row.proveedor}</td>
                      <td className="px-5 py-3 text-slate-900 font-semibold">{row.insumo}</td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-600">{row.lote}</td>
                      <td className="px-5 py-3 text-right text-slate-900">{formatNumber(row.cantidad)}</td>
                      <td className="px-5 py-3 text-right text-slate-900">{formatCurrency(row.costo_unitario)}</td>
                      <td className="px-5 py-3 text-right text-slate-900">{formatCurrency(row.costo_total)}</td>
                    </tr>
                  ))}
                  {!showLoadingCards && !recentPurchases.length ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-sm text-slate-500">
                        No hay compras registradas todavía.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>

      <section>
        {isBusy && resumen.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs uppercase tracking-widest font-medium animate-pulse text-blue-400">Sincronizando inventario...</p>
          </div>
        ) : (
          <StockMateriaPrimaTable
            resumen={resumen}
            lotes={lotes}
            insumos={insumos}
            proveedores={proveedores}
            onDelete={handleDelete}
          />
        )}
        {!isBusy && noData ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            No hay stock consolidado de materia prima cargado. Registrá un ingreso para comenzar.
          </div>
        ) : null}
      </section>

      {isModalOpen ? (
        <StockMateriaPrimaModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={refreshData}
        />
      ) : null}
    </main>
  );
};

export default StockMateriaPrimaPage;
