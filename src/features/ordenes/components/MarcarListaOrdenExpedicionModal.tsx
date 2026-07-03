import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiPackage, FiTruck, FiX } from 'react-icons/fi';
import { ApiService } from '../../../infrastructure/api';
import type { OrdenExpedicion } from '../types';
import { normalizeNumericInputChange, parseNumericInput } from '../../../shared/utils/formatters';

interface Props {
  orden: OrdenExpedicion | null;
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
}

const formatKg = (value: number) => `${value.toLocaleString('es-AR')} kg`;

const MarcarListaOrdenExpedicionModal: React.FC<Props> = ({ orden, onClose, onSuccess }) => {
  const [kilosRealesInput, setKilosRealesInput] = useState(() => (orden?.kilos_reales_cargados ? String(orden.kilos_reales_cargados) : ''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kilosSolicitados = Number(orden?.cantidad_kg ?? 0);
  const kilosReales = parseNumericInput(kilosRealesInput);
  const diferencia = useMemo(() => {
    if (kilosReales === null) return null;
    return Number((kilosReales - kilosSolicitados).toFixed(3));
  }, [kilosReales, kilosSolicitados]);

  if (!orden) {
    return null;
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);

    if (!Number.isFinite(kilosReales ?? Number.NaN) || (kilosReales ?? 0) <= 0) {
      setError('Los kilos reales cargados deben ser mayores a 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await ApiService.ordenesExpedicion.marcarLista(orden.id, Number(kilosReales));
      await onSuccess?.();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo marcar la orden como lista.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">Órdenes de expedición</p>
            <h3 className="text-xl font-black text-slate-900">Marcar como lista</h3>
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

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Orden seleccionada</p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-lg font-bold text-slate-900">{orden.numero_expedicion}</p>
              <p className="text-sm text-slate-600">{orden.nombre_producto} · {orden.lote_pt}</p>
              <p className="text-sm text-slate-600">Cliente: {orden.cliente_nombre || 'Sin cliente'}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-600">
                <FiPackage size={12} /> Kg solicitados
              </p>
              <p className="mt-2 text-2xl font-black text-cyan-900">{formatKg(kilosSolicitados)}</p>
              <p className="mt-1 text-xs text-cyan-700">Cantidad originalmente pedida</p>
            </div>

            <label className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-1">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiTruck size={12} /> Kg reales cargados
              </span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={kilosRealesInput}
                onChange={(e) => setKilosRealesInput(normalizeNumericInputChange(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="0.000"
                autoFocus
              />
              <p className="text-xs text-slate-500">Solo números mayores a 0.</p>
            </label>

            <div className={`rounded-2xl border p-4 ${diferencia === null ? 'border-slate-200 bg-slate-50' : diferencia === 0 ? 'border-emerald-200 bg-emerald-50' : diferencia > 0 ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
              <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${diferencia === null ? 'text-slate-500' : diferencia === 0 ? 'text-emerald-600' : diferencia > 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                Diferencia
              </p>
              <p className={`mt-2 text-2xl font-black ${diferencia === null ? 'text-slate-900' : diferencia === 0 ? 'text-emerald-700' : diferencia > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                {diferencia === null
                  ? '—'
                  : `${diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-AR')} kg`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Respecto de lo solicitado
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            Al confirmar se guardarán los kilos reales, se actualizará el inventario y la orden quedará en estado lista.
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiCheckCircle size={16} />
              {isSubmitting ? 'Guardando...' : 'Confirmar lista'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MarcarListaOrdenExpedicionModal;
