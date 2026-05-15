// src/features/silos/components/SiloModal.tsx
import React, { useState } from 'react';
import { FiX } from "react-icons/fi";
import { useSilos } from '../hooks/useSilos';
import type { Silo } from '../types/silo';
import Swal from 'sweetalert2';

interface Props {
  silo?: Silo;
  onClose: () => void;
  onSuccess: () => Promise<void>; // Cambiado a Promise para esperar el refresh
}

const SiloModal: React.FC<Props> = ({ silo, onClose, onSuccess }) => {
  const { create, update, isLoading } = useSilos();
  const [formData, setFormData] = useState({
    nombre: silo?.nombre || '',
    descripcion: silo?.descripcion || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (silo?.uid) {
        await update(silo.uid, formData);
      } else {
        await create(formData);
      }

     
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        background: '#0d121b',
        color: '#fff',
        customClass: { popup: 'border border-white/10 rounded-xl' }
      });
    
      Toast.fire({
        icon: 'success',
        title: silo ? 'Silo actualizado' : 'Silo registrado correctamente'
      });
      
      await onSuccess(); 
      onClose();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al procesar',
        text: 'No se pudo guardar la información del silo.',
        background: '#0d121b',
        color: '#fff',
        confirmButtonColor: '#2563eb',
        customClass: { popup: 'border border-white/10 rounded-2xl' }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d121b] border border-white/5 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="px-6 py-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-[14px] font-bold text-white tracking-widest uppercase">
            {silo ? 'Editar Silo / Bodega' : 'Nuevo Silo'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <FiX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nombre</label>
              <input 
                required type="text"
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
                placeholder="EJ. SILO GRANO G3"
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg py-2.5 px-3 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Descripción</label>
              <textarea 
                rows={3}
                value={formData.descripcion}
                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                placeholder="Detalles de ubicación o capacidad..."
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg py-2.5 px-3 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all resize-none"
              />
            </div>
          </div>

          <footer className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/[0.01]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-white">
              CANCELAR
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            >
              {isLoading ? 'GUARDANDO...' : (silo ? 'ACTUALIZAR' : 'GUARDAR SILO')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default SiloModal;