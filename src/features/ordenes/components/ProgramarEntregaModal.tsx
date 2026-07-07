import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiCheckCircle, FiFileText, FiX } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { ApiService } from '../../../infrastructure/api';
import type { OrdenExpedicion } from '../types';

interface Props {
  orden: OrdenExpedicion | null;
  onClose: () => void;
  onSuccess?: (ordenActualizada: OrdenExpedicion) => Promise<void> | void;
}

const ProgramarEntregaModal: React.FC<Props> = ({ orden, onClose, onSuccess }) => {
  const [fechaProgramada, setFechaProgramada] = useState(() => orden?.fecha_programada ?? '');
  const [notaProgramacion, setNotaProgramacion] = useState(() => orden?.nota_programacion ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!orden) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!fechaProgramada.trim()) {
      setError('La fecha programada de entrega es obligatoria.');
      return;
    }

    // Validar formato de fecha AAAA-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fechaProgramada)) {
      setError('La fecha debe tener un formato válido (AAAA-MM-DD).');
      return;
    }

    const dateParsed = new Date(fechaProgramada);
    if (Number.isNaN(dateParsed.getTime())) {
      setError('La fecha ingresada no es válida.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await ApiService.ordenesExpedicion.programarEntrega(
        orden.id,
        fechaProgramada,
        notaProgramacion.trim() || null
      );

      await Swal.fire({
        icon: 'success',
        title: orden.fecha_programada ? '¡Entrega reprogramada!' : '¡Entrega programada!',
        text: `Se programó la entrega de la orden ${orden.numero_expedicion} para el día ${fechaProgramada.split('-').reverse().join('/')}.`,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#0891b2',
      });

      if (onSuccess) {
        await onSuccess(updated);
      }
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la programación de entrega.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">Órdenes de salida</p>
            <h3 className="text-xl font-black text-slate-900">
              {orden.fecha_programada ? 'Reprogramar entrega' : 'Programar entrega'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <FiX size={18} />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Orden de salida</p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-lg font-bold text-slate-900">{orden.numero_expedicion}</p>
              <p className="text-sm text-slate-600">{orden.nombre_producto} · {orden.lote_pt}</p>
              <p className="text-sm text-slate-600">Cliente: {orden.cliente_nombre || 'Sin cliente'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fechaProgramada" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiCalendar size={12} /> Fecha programada de entrega
              </label>
              <input
                id="fechaProgramada"
                type="date"
                required
                value={fechaProgramada}
                onChange={(e) => setFechaProgramada(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="notaProgramacion" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <FiFileText size={12} /> Comentario / Nota de programación (Opcional)
              </label>
              <textarea
                id="notaProgramacion"
                rows={3}
                value={notaProgramacion}
                onChange={(e) => setNotaProgramacion(e.target.value)}
                placeholder="Ej. Entregar por la mañana, llamar antes de llegar..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiCheckCircle size={16} />
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ProgramarEntregaModal;
