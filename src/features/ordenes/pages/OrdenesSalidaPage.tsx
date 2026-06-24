import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiSearch, FiTruck } from 'react-icons/fi';
import { ApiService } from '../../../infrastructure/api';
import { Card } from '../../../shared/components/card';
import type { OrdenExpedicion } from '../types';
import OrdenExpedicionModal from '../components/OrdenExpedicionModal';

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;

const estadoBadge: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700',
  REGISTRADA: 'bg-emerald-50 text-emerald-700',
  ANULADA: 'bg-slate-100 text-slate-500',
};

const estadoLabel: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  REGISTRADA: 'Confirmada',
  ANULADA: 'Cancelada',
};

const OrdenesSalidaPage: React.FC = () => {
  const [ordenesSalida, setOrdenesSalida] = useState<OrdenExpedicion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const totalKg = filtered.reduce((acc, item) => acc + Number(item.cantidad ?? 0), 0);

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
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500"
        >
          <FiPlus />
          Nueva orden de salida
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Órdenes cargadas</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{ordenesSalida.length}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Kg filtrados</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatKg(totalKg)}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Estados</p>
          <p className="mt-2 text-sm text-slate-700">Pendiente, confirmada y cancelada.</p>
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
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  <th className="px-6 py-4">Comprobante</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Lote PT</th>
                  <th className="px-6 py-4">Cantidad</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((orden) => (
                  <tr key={orden.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{orden.numero_expedicion}</div>
                      <div className="text-xs text-slate-500">{orden.referencia || 'Sin comprobante'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{orden.cliente_nombre || 'Sin cliente'}</td>
                    <td className="px-6 py-4 text-slate-700">{orden.nombre_producto}</td>
                    <td className="px-6 py-4 text-slate-700">{orden.lote_pt}</td>
                    <td className="px-6 py-4 text-slate-700">{formatKg(Number(orden.cantidad ?? 0))}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoBadge[orden.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {estadoLabel[orden.estado] ?? orden.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{new Intl.DateTimeFormat('es-AR').format(new Date(orden.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isModalOpen ? (
        <OrdenExpedicionModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={load}
        />
      ) : null}
    </div>
  );
};

export default OrdenesSalidaPage;
