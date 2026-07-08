import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiSearch, FiTruck, FiCheckCircle, FiXCircle, FiSliders } from 'react-icons/fi';
import { ApiService } from '../../../infrastructure/api';
import { Card } from '../../../shared/components/card';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import type { OrdenExpedicion } from '../types';
import Swal from 'sweetalert2';
import OrdenExpedicionModal from '../components/OrdenExpedicionModal';
import MarcarListaOrdenExpedicionModal from '../components/MarcarListaOrdenExpedicionModal';
import ProgramarEntregaModal from '../components/ProgramarEntregaModal';
import { puedeMostrarAccionesOrdenSalida } from '../utils/ordenesExpedicion';
import { openConfiguracionEmpaquesModal } from '../../productos/utils/openConfiguracionEmpaquesModal';
import { getPresentacionExpedicionKeyFromOrder, getPresentacionExpedicionOption } from '../utils/presentacionExpedicion';
import { usePermissions } from '../../auth/usePermissions';

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;
const formatKgDiff = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('es-AR')} kg`;
const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value);

const getErrorMessage = (err: any): string => {
  if (!err) return 'Error desconocido.';
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const parts = [err.message, err.details, err.hint].filter(Boolean);
    const msg = parts.join(' | ').trim();
    if (msg) return msg;
  }
  return JSON.stringify(err);
};

const estadoBadge: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700',
  preparando: 'bg-sky-50 text-sky-700',
  lista: 'bg-violet-50 text-violet-700',
  despachada: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-slate-100 text-slate-500',
};

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  lista: 'Lista',
  despachada: 'Despachada',
  cancelada: 'Cancelada',
};

const formatProgramada = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const hasTime = fecha.includes('T') || fecha.includes(' ') || fecha.length > 10;
  const date = fecha.includes('T')
    ? new Date(fecha)
    : /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? new Date(`${fecha}T00:00:00`)
      : new Date(fecha);

  if (Number.isNaN(date.getTime())) return '—';

  const dateFormatted = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

  if (hasTime) {
    const timeFormatted = new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    return `${dateFormatted} ${timeFormatted}`;
  }

  return dateFormatted;
};

const OrdenesSalidaPage: React.FC = () => {
  const [ordenesSalida, setOrdenesSalida] = useState<OrdenExpedicion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ordenEnEdicion, setOrdenEnEdicion] = useState<OrdenExpedicion | null>(null);
  const [ordenParaLista, setOrdenParaLista] = useState<OrdenExpedicion | null>(null);
  const [ordenParaProgramar, setOrdenParaProgramar] = useState<OrdenExpedicion | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { canAccess } = usePermissions();
  const canCreateOrder = canAccess('ordenes', 'create');
  const canEditOrder = canAccess('ordenes', 'edit');
  const canSeeSalePrice = canCreateOrder || canEditOrder;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApiService.ordenesExpedicion.getAll();
      setOrdenesSalida(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las órdenes de salida.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return ordenesSalida;
    return ordenesSalida.filter((item) => [
      item.numero_expedicion,
      item.nombre_producto,
      item.lote_pt,
      item.cliente_nombre,
      item.referencia,
    ].some((value) => (value ?? '').toLowerCase().includes(q)));
  }, [ordenesSalida, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useMemo(() => {
    const from = (currentPage - 1) * itemsPerPage;
    return filtered.slice(from, from + itemsPerPage);
  }, [currentPage, filtered]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totalKgSolicitados = filtered.reduce((acc, item) => acc + Number(item.cantidad_kg ?? item.cantidad ?? 0), 0);
  const totalKgReales = filtered.reduce((acc, item) => acc + Number(item.kilos_reales_cargados ?? 0), 0);

  const handleDespachar = useCallback(async (ordenId: string) => {
    await ApiService.ordenesExpedicion.despachar(ordenId);
    await load();
  }, [load]);

  const handleCancelar = useCallback(async (ordenId: string) => {
    const currentOrden = ordenesSalida.find((orden) => orden.id === ordenId);
    if (!currentOrden) return;

    const result = await Swal.fire({
      title: '¿Cancelar orden de salida?',
      text: `Se cancelará la orden ${currentOrden.numero_expedicion}. Esta acción liberará el stock comprometido.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, mantener',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#334155',
    });

    if (!result.isConfirmed) return;

    try {
      await ApiService.ordenesExpedicion.cancelar(ordenId);
      setOrdenesSalida((current) =>
        current.map((o) => (o.id === ordenId ? { ...o, estado: 'cancelada' } : o))
      );
      await load();
      await Swal.fire({
        icon: 'success',
        title: 'Orden cancelada',
        text: `La orden ${currentOrden.numero_expedicion} ha sido cancelada.`,
        background: '#ffffff',
        color: '#0f172a',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo cancelar',
        text: getErrorMessage(err),
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb',
      });
    }
  }, [load, ordenesSalida]);

  const handleDelete = useCallback(async (ordenId: string) => {
    const currentOrden = ordenesSalida.find((orden) => orden.id === ordenId);
    if (!currentOrden) return;

    const result = await Swal.fire({
      title: '¿Eliminar orden de salida?',
      text: `Se eliminará la orden ${currentOrden.numero_expedicion}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#334155',
    });

    if (!result.isConfirmed) return;

    try {
      await ApiService.ordenesExpedicion.delete(ordenId);
      setOrdenesSalida((current) => current.filter((o) => o.id !== ordenId));
      await load();
      await Swal.fire({
        icon: 'success',
        title: 'Orden eliminada',
        text: `La orden ${currentOrden.numero_expedicion} ha sido eliminada correctamente.`,
        background: '#ffffff',
        color: '#0f172a',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: getErrorMessage(err),
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb',
      });
    }
  }, [load, ordenesSalida]);

  const handlePreparar = useCallback(async (ordenId: string) => {
    await ApiService.ordenesExpedicion.iniciarPreparacion(ordenId);
    await load();
  }, [load]);

  const handleConfigurarEmpaques = useCallback(async () => {
    try {
      await openConfiguracionEmpaquesModal(load);
    } catch (error) {
      console.error('[ordenes-salida] fallo al abrir configuracion de empaques', error);
      setError(error instanceof Error ? error.message : 'No se pudo abrir la configuración de empaques.');
    }
  }, [load]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-500">
            <FiTruck size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Despacho de producto terminado</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900">
            Órdenes de <span className="text-cyan-600">Salida</span>
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Control formal de salidas de stock de producto terminado por cliente, comprobante y fecha.
          </p>
        </div>
        {canCreateOrder ? (
          <button
            type="button"
            onClick={() => {
              setOrdenEnEdicion(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500"
          >
            <FiPlus />
            Nueva orden de salida
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => { void handleConfigurarEmpaques(); }}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-5 py-3 text-sm font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-50"
        >
          <FiSliders />
          Configurar empaques
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Órdenes cargadas</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{ordenesSalida.length}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Kg solicitados</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatKg(totalKgSolicitados)}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Kg reales cargados</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatKg(totalKgReales)}</p>
        </Card>
      </div>

      <div className="relative max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar por cliente, producto o comprobante..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none"
        />
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando órdenes de salida...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No hay órdenes de salida registradas.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-auto">
            <table className={`w-full text-left ${canSeeSalePrice ? 'min-w-[1560px]' : 'min-w-[1380px]'}`}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  <th className="px-6 py-4">Comprobante</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Lote PT</th>
                  <th className="px-6 py-4">Kg solicitados</th>
                  <th className="px-6 py-4">Kg reales</th>
                  <th className="px-6 py-4">Diferencia</th>
                  {canSeeSalePrice ? <th className="px-6 py-4">Venta</th> : null}
                  <th className="px-6 py-4">Programada</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Creada</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((orden) => (
                  <tr key={orden.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{orden.numero_expedicion}</div>
                      <div className="text-xs text-slate-500">{orden.referencia || 'Sin comprobante'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{orden.cliente_nombre || 'Sin cliente'}</td>
                    <td className="px-6 py-4 text-slate-700">{orden.nombre_producto}</td>
                    <td className="px-6 py-4 text-slate-700">{orden.lote_pt}</td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="font-semibold text-slate-900">{formatKg(Number(orden.cantidad_kg ?? orden.cantidad ?? 0))}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                        {getPresentacionExpedicionOption(getPresentacionExpedicionKeyFromOrder(orden)).label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {orden.kilos_reales_cargados != null ? (
                        <div className="font-semibold text-slate-900">{formatKg(Number(orden.kilos_reales_cargados))}</div>
                      ) : (
                        <div className="font-medium text-slate-400">Pendiente</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {orden.kilos_reales_cargados != null ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          Number(orden.kilos_reales_cargados) === Number(orden.cantidad_kg ?? orden.cantidad ?? 0)
                            ? 'bg-emerald-50 text-emerald-700'
                            : Number(orden.kilos_reales_cargados) > Number(orden.cantidad_kg ?? orden.cantidad ?? 0)
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                        }`}>
                          {formatKgDiff(Number(orden.kilos_reales_cargados) - Number(orden.cantidad_kg ?? orden.cantidad ?? 0))}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Sin cargar</span>
                      )}
                    </td>
                    {canSeeSalePrice ? (
                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {orden.precio_unitario_venta && orden.precio_unitario_venta > 0
                            ? `${formatMoney(Number(orden.precio_unitario_venta))} / kg`
                            : 'Sin precio'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {orden.total_venta && orden.total_venta > 0 ? `Total: ${formatMoney(Number(orden.total_venta))}` : 'Total sin definir'}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-6 py-4 text-slate-600">
                      {formatProgramada(orden.fecha_programada)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoBadge[orden.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {estadoLabel[orden.estado] ?? orden.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{formatDateDDMMYYYY(orden.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canEditOrder ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setOrdenEnEdicion(orden);
                                setIsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={orden.estado === 'despachada' || orden.estado === 'cancelada'}
                              onClick={() => {
                                setOrdenParaProgramar(orden);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                              {orden.fecha_programada ? 'Reprogramar' : 'Programar entrega'}
                            </button>
                          </>
                        ) : null}
                        {puedeMostrarAccionesOrdenSalida(orden.estado) ? (
                          <>
                            {orden.estado === 'pendiente' ? (
                              <button type="button" onClick={() => void handlePreparar(orden.id)} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500">
                                <FiTruck size={12} />
                                Iniciar
                              </button>
                            ) : null}
                            {orden.estado === 'preparando' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOrdenParaLista(orden);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                              >
                                <FiCheckCircle size={12} />
                                Marcar lista
                              </button>
                            ) : null}
                            {orden.estado === 'lista' ? (
                              <button type="button" onClick={() => void handleDespachar(orden.id)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
                                <FiCheckCircle size={12} />
                                Despachar
                              </button>
                            ) : null}
                            <button type="button" onClick={() => void handleCancelar(orden.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                              <FiXCircle size={12} />
                              Cancelar
                            </button>
                          </>
                        ) : orden.estado === 'cancelada' ? (
                          <button type="button" onClick={() => void handleDelete(orden.id)} className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
                            Eliminar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sin acciones</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isLoading && filtered.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Total de órdenes: <strong className="text-slate-900">{filtered.length}</strong> · Página <strong className="text-slate-900">{currentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <OrdenExpedicionModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={load}
          orden={ordenEnEdicion}
        />
      ) : null}

      {ordenParaLista ? (
        <MarcarListaOrdenExpedicionModal
          orden={ordenParaLista}
          onClose={() => setOrdenParaLista(null)}
          onSuccess={load}
        />
      ) : null}

      {ordenParaProgramar ? (
        <ProgramarEntregaModal
          orden={ordenParaProgramar}
          onClose={() => setOrdenParaProgramar(null)}
          onSuccess={async (updated) => {
            setOrdenesSalida((prev) =>
              prev.map((o) => (o.id === updated.id ? updated : o))
            );
            try {
              const data = await ApiService.ordenesExpedicion.getAll();
              setOrdenesSalida(data);
            } catch (e) {
              console.error('[ordenes-salida] Fallo al refrescar las órdenes en segundo plano', e);
            }
          }}
        />
      ) : null}
    </div>
  );
};

export default OrdenesSalidaPage;
