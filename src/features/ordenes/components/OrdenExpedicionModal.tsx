import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiTruck, FiPackage, FiUser, FiFileText } from 'react-icons/fi';
import { ApiService } from '../../../infrastructure/api';
import type { Cliente } from '../../clientes/types/cliente';
import type { StockProductoTerminado } from '../../productos/types';
import { PresentacionExpedicion } from '../types';

interface Props {
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
}

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;

const OrdenExpedicionModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [stockPT, setStockPT] = useState<StockProductoTerminado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [presentacion, setPresentacion] = useState<keyof typeof PresentacionExpedicion>('GRANEL');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [stockData, clientesData] = await Promise.all([
          ApiService.stockPT.getAll(),
          ApiService.clientes.getAll(),
        ]);
        const disponibles = stockData.filter((item) => Number(item.cantidad_total ?? 0) > 0);
        setStockPT(disponibles);
        setClientes(clientesData);
        setSelectedStockId(disponibles[0]?.uid ?? '');
        setSelectedClienteId(clientesData[0]?.uid ?? '');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la información para expedición.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const selectedStock = useMemo(
    () => stockPT.find((item) => item.uid === selectedStockId) ?? null,
    [stockPT, selectedStockId]
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);

    if (!selectedStock) {
      setError('Seleccioná un producto terminado disponible.');
      return;
    }
    if (!selectedClienteId) {
      setError('Seleccioná un cliente destino.');
      return;
    }
    if (cantidad === '' || Number.isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
      setError('La cantidad a expedir debe ser mayor a 0.');
      return;
    }
    if (Number(cantidad) > Number(selectedStock.cantidad_total ?? 0)) {
      setError('La cantidad no puede superar el stock disponible.');
      return;
    }

    try {
      setIsSubmitting(true);
      await ApiService.ordenesExpedicion.create({
        stock_pt_id: selectedStock.uid,
        cliente_id: selectedClienteId,
        presentacion,
        cantidad: Number(cantidad),
        motivo: motivo.trim() || undefined,
        referencia: referencia.trim() || undefined,
      });
      await onSuccess?.();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar la orden de expedición.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-slate-700 shadow-xl">
          Cargando datos de expedición...
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">Órdenes de Expedición</p>
            <h3 className="text-xl font-black text-slate-900">Nueva orden de expedición</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <FiX size={18} />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="ml-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Producto terminado</span>
              <select
                value={selectedStockId}
                onChange={(e) => setSelectedStockId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                {stockPT.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {item.nombre_producto} · {item.lote} · {formatKg(Number(item.cantidad_total ?? 0))}
                  </option>
                ))}
              </select>
              {stockPT.length === 0 ? (
                <p className="text-xs text-amber-600">No hay stock PT disponible para expedir.</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="ml-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Cliente destino</span>
              <select
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.uid} value={cliente.uid}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
              {clientes.length === 0 ? (
                <p className="text-xs text-amber-600">No hay clientes disponibles.</p>
              ) : null}
            </label>
          </div>

          {selectedStock ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Detalle del lote</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedStock.nombre_producto}</p>
                  <p className="text-xs text-slate-500">OP / lote: {selectedStock.numero_orden} · {selectedStock.lote}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Saldo disponible</p>
                  <p className="mt-1 font-bold text-cyan-700">{formatKg(Number(selectedStock.cantidad_total ?? 0))}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiTruck size={12} /> Presentación
              </span>
              <select
                value={presentacion}
                onChange={(e) => setPresentacion(e.target.value as keyof typeof PresentacionExpedicion)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="GRANEL">A granel</option>
                <option value="BIG_BAG">Big bag</option>
                <option value="BOLSA">Bolsa</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiPackage size={12} /> Cantidad a expedir
              </span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiFileText size={12} /> Referencia
              </span>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Remito, factura o nota"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="ml-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Motivo opcional</span>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Despacho comercial, prueba, ajuste..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <FiUser size={14} className="text-cyan-600" />
              Cliente requerido para registrar la expedición
            </span>
            <span className="font-semibold text-slate-900">
              {selectedStock ? `${selectedStock.nombre_producto} · ${selectedStock.lote}` : 'Sin stock'}
            </span>
          </div>
        </div>

        <footer className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedStock || !selectedClienteId || isSubmitting}
            onClick={handleSubmit}
            className="flex-[2] rounded-xl bg-cyan-600 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-cyan-900/20 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Registrando...' : 'Guardar expedición'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default OrdenExpedicionModal;
