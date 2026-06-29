// src/features/insumos/pages/StockMateriaPrimaPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useStockMateriaPrima } from '../hooks';
import StockMateriaPrimaTable from '../components/StockMateriaPrimaTable';
import StockMateriaPrimaModal from '../components/StockMateriaPrimaModal';
import { ApiService } from '../../../infrastructure/api';
import type { HistorialCompraMP } from '../types';
import type { Proveedor } from '../../proveedores/types';
import Swal from 'sweetalert2';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { buildStockMPResumen } from '../utils/stockResumen';

const formatterNumero = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 3,
});

const formatterFecha = (value: string | Date | null | undefined) => formatDateDDMMYYYY(value);

type HistorialPeriodo = 'HOY' | 'SEMANA' | 'MES' | 'TODO';

const DEFAULT_PAGE_SIZE = 10;

const StockMateriaPrimaPage: React.FC = () => {
  const { lotes, isLoading, loadError, getAll, remove } = useStockMateriaPrima();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comprasLoading, setComprasLoading] = useState(true);
  const [comprasError, setComprasError] = useState<string | null>(null);
  const [comprasPeriodo, setComprasPeriodo] = useState<HistorialPeriodo>('HOY');
  const [comprasPage, setComprasPage] = useState(1);
  const [comprasPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [comprasTotal, setComprasTotal] = useState(0);

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [historialCompras, setHistorialCompras] = useState<HistorialCompraMP[]>([]);

  const loadComprasInfo = useCallback(async () => {
    try {
      setComprasLoading(true);
      const { data, total } = await ApiService.stockMP.getHistorialCompras({
        periodo: comprasPeriodo,
        page: comprasPage,
        pageSize: comprasPageSize,
      });
      setHistorialCompras(data);
      setComprasTotal(total);
      setComprasError(null);
    } catch (err) {
      console.error('Error cargando historial de compras MP:', err);
      setComprasError('No se pudo cargar el historial de compras de materia prima.');
      setHistorialCompras([]);
    } finally {
      setComprasLoading(false);
    }
  }, [comprasPage, comprasPageSize, comprasPeriodo]);

  const refreshData = useCallback(async () => {
    await Promise.all([getAll(), loadComprasInfo()]);
  }, [getAll, loadComprasInfo]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const resP = await ApiService.proveedores.getAll();
        await Promise.all([
          getAll(),
        ]);
        setProveedores(resP);
      } catch (error) {
        console.error('Error cargando catálogos:', error);
        setError('No se pudieron cargar los catálogos de insumos/proveedores.');
      }
    };

    void initialize();
  }, [getAll, loadComprasInfo]);

  useEffect(() => {
    void loadComprasInfo();
  }, [loadComprasInfo]);

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

  const resumen = buildStockMPResumen(lotes);
  const noData = resumen.length === 0;
  const combinedError = error ?? loadError ?? comprasError;
  const isBusy = isLoading || comprasLoading;
  const comprasRegistradas = comprasTotal;
  const proveedoresActivos = proveedores.filter((proveedor) => proveedor.esta_activo).length;
  const showLoadingCards = isBusy && comprasRegistradas === 0 && resumen.length === 0;
  const totalPages = Math.max(1, Math.ceil(comprasTotal / comprasPageSize));
  const emptyBecauseFilter = !comprasLoading && historialCompras.length === 0 && comprasTotal === 0;

  const handlePeriodoChange = (periodo: HistorialPeriodo) => {
    setComprasPeriodo(periodo);
    setComprasPage(1);
  };

  const handlePrevPage = () => setComprasPage((current) => Math.max(1, current - 1));
  const handleNextPage = () => setComprasPage((current) => Math.min(totalPages, current + 1));

  const formatDate = (value: string | Date | null | undefined) => formatterFecha(value);
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

      <section className="mt-8 space-y-6">
        <article className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col w-full">
            <div className="px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Historial de ingresos MP</h2>
                  <p className="text-sm text-slate-500 mt-1">Recepciones recientes con proveedor, lote, remito y cantidad.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['HOY', 'SEMANA', 'MES', 'TODO'] as HistorialPeriodo[]).map((periodo) => (
                    <button
                      key={periodo}
                      type="button"
                      onClick={() => handlePeriodoChange(periodo)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${
                        comprasPeriodo === periodo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {periodo === 'HOY' ? 'Hoy' : periodo === 'SEMANA' ? 'Semana' : periodo === 'MES' ? 'Mes' : 'Todo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Proveedor</th>
                    <th className="text-left px-4 py-2">Insumo</th>
                    <th className="text-left px-4 py-2">Lote</th>
                    <th className="text-left px-4 py-2">Remito</th>
                    <th className="text-right px-4 py-2">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {showLoadingCards ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-sm text-slate-500">
                        Cargando historial de ingresos...
                      </td>
                    </tr>
                  ) : historialCompras.map((row, index) => (
                    <tr key={`${row.id_insumo ?? 'ingreso'}-${row.fecha_compra ?? 'sin-fecha'}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-600">{formatDate(row.fecha_compra)}</td>
                      <td className="px-4 py-2 text-slate-700">{row.proveedor}</td>
                      <td className="px-4 py-2 text-slate-900 font-semibold">{row.insumo}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-600">{row.lote}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-600">-</td>
                      <td className="px-4 py-2 text-right text-slate-900">{formatNumber(row.cantidad)}</td>
                    </tr>
                  ))}
                  {!showLoadingCards && emptyBecauseFilter ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-sm text-slate-500">
                        No hay ingresos para el período seleccionado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-3">
              <p className="text-xs text-slate-500">
                {comprasTotal} registros · Página {comprasPage} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={comprasPage === 1}
                  onClick={handlePrevPage}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={comprasPage >= totalPages}
                  onClick={handleNextPage}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
        </article>
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
