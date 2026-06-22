// src/features/silos/components/SiloModal.tsx
import React, { useState } from 'react';
import { FiX } from "react-icons/fi";
import { useSilos } from '../hooks/useSilos';
import type { Silo } from '../types/silo';
import Swal from 'sweetalert2';

const tipoLabels: Record<Silo['tipo_uso'], string> = {
  MATERIA_PRIMA: 'Materia Prima',
  PRODUCTO_TERMINADO: 'Producto Terminado',
};

interface Props {
  silo?: Silo;
  existingSilos: Silo[];
  onClose: () => void;
  onSuccess: () => Promise<void>; // Cambiado a Promise para esperar el refresh
}

const SiloModal: React.FC<Props> = ({ silo, existingSilos, onClose, onSuccess }) => {
  const { create, update, isLoading } = useSilos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: silo?.nombre || '',
    descripcion: silo?.descripcion || '',
    tipo_uso: silo?.tipo_uso || 'MATERIA_PRIMA' as Silo['tipo_uso'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;

    setSubmitError(null);
    const normalized = {
      nombre: formData.nombre.trim().toUpperCase(),
      descripcion: formData.descripcion.trim(),
      tipo_uso: formData.tipo_uso,
    };
    if (!normalized.nombre) {
      setSubmitError('El nombre del silo es obligatorio.');
      return;
    }
    const duplicated = existingSilos.some(
      (item) => item.uid !== silo?.uid && item.nombre.trim().toUpperCase() === normalized.nombre
    );
    if (duplicated) {
      setSubmitError('Ya existe un silo activo con ese nombre.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (silo?.uid) {
        await update(silo.uid, normalized);
      } else {
        await create(normalized);
      }

     
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#0f172a',
        customClass: { popup: 'border border-slate-200 rounded-xl' }
      });
    
      Toast.fire({
        icon: 'success',
        title: silo ? 'Silo actualizado' : 'Silo registrado correctamente'
      });
      
      await onSuccess(); 
      onClose();
    } catch {
      setSubmitError('No se pudo guardar la información del silo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl animate-in zoom-in-95 duration-200">
        <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-[14px] font-bold text-slate-900 tracking-widest uppercase">
            {silo ? 'Editar Silo / Bodega' : 'Nuevo Silo'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-slate-900 transition-colors duration-200 p-1">
            <FiX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nombre</label>
              <input 
                required type="text"
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
                placeholder="EJ. SILO GRANO G3"
                className="ui-input w-full rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200 ease-out"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Descripción</label>
              <textarea 
                rows={3}
                value={formData.descripcion}
                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                placeholder="Detalles de ubicación o capacidad..."
                className="ui-input w-full rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200 ease-out resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Tipo de silo</label>
              <select
                value={formData.tipo_uso}
                onChange={(e) => setFormData({ ...formData, tipo_uso: e.target.value as Silo['tipo_uso'] })}
                className="ui-input w-full rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200 ease-out"
              >
                {Object.entries(tipoLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <footer className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-slate-900 transition-colors duration-200">
              CANCELAR
            </button>
            <button 
              type="submit" 
              disabled={isLoading || isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-all duration-200 ease-out flex items-center gap-2"
            >
              {(isLoading || isSubmitting) ? 'GUARDANDO...' : (silo ? 'ACTUALIZAR' : 'GUARDAR SILO')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default SiloModal;
