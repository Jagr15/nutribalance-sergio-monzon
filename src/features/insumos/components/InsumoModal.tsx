// src/components/insumos/InsumoModal.tsx
import React, { useState } from 'react';
import { FiX, FiChevronDown } from "react-icons/fi";
import { TipoCategoria, type Insumo } from '../types/insumo';
import { TipoUnidad } from '../../../shared/types/global.interface'; // Usamos tu enum global
import { useInsumos } from '../hooks/useInsumos';
import Swal from 'sweetalert2';

interface InsumoModalProps {
  insumo?: Insumo;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const InsumoModal: React.FC<InsumoModalProps> = ({ insumo, onClose, onSuccess }) => {
  const { create, update, isLoading } = useInsumos();

  // Estados locales para el formulario
  const [nombre, setNombre] = useState(insumo?.nombre || '');
  const [categoria, setCategoria] = useState<TipoCategoria>(
    (insumo?.categoria as TipoCategoria) || '' as TipoCategoria
  );
  const [umbral, setUmbral] = useState(insumo?.umbral_alerta?.toString() || '0');
  
  // Nuevo estado para la Unidad de Medida
  const [unidad, setUnidad] = useState<TipoUnidad>(
    insumo?.unidad_medida || TipoUnidad.KG
  );

  const isUmbralInvalid = parseInt(umbral, 10) <= 0 || umbral === '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUmbralInvalid) return;

    const payload = {
      nombre: nombre.toUpperCase().trim(),
      categoria,
      umbral_alerta: parseInt(umbral, 10),
      unidad_medida: unidad // Ahora es dinámico
    };

    try {
      if (insumo?.uid) {
        await update(insumo.uid, payload);
      } else {
        await create(payload);
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
        title: insumo ? 'Actualizado correctamente' : 'Insumo registrado'
      });
    
      await onSuccess(); 
      onClose();
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error al procesar',
        text: 'Hubo un problema al intentar guardar los cambios.',
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
            {insumo ? 'Editar Insumo' : 'Nuevo Insumo'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <FiX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            
            {/* Campo: Nombre */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nombre</label>
              <input 
                required
                type="text" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. MAÍZ AMARILLO"
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg py-2.5 px-3 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all"
              />
            </div>

            {/* Campo: Categoría */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Categoría</label>
              <div className="relative">
                <select 
                  required
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as TipoCategoria)}
                  className="w-full bg-[#0d121b] border border-white/10 rounded-lg py-2.5 px-3 text-sm text-gray-200 appearance-none focus:border-blue-500/50 outline-none cursor-pointer"
                >
                  <option value="" disabled>Seleccionar...</option>
                  {Object.values(TipoCategoria).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Campo: Umbral y Unidad (Unificados) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Configuración de Umbral Minimo</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 relative">
                   <input 
                    type="text" 
                    placeholder="Umbral alerta"
                    value={umbral}
                    onChange={(e) => /^\d*$/.test(e.target.value) && setUmbral(e.target.value)}
                    className={`w-full bg-white/[0.02] border ${isUmbralInvalid ? 'border-orange-500/40' : 'border-white/10'} rounded-lg py-2.5 px-3 text-sm text-gray-300 font-mono outline-none transition-all`}
                  />
                </div>
                
                {/* Selector de Unidad de Medida */}
                <div className="relative">
                  <select 
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value as TipoUnidad)}
                    className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold py-2.5 px-2 rounded-lg appearance-none outline-none cursor-pointer text-center"
                  >
                    {Object.values(TipoUnidad).map(u => (
                      <option key={u} value={u} className="bg-[#0d121b] text-gray-300">{u}</option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400/50 pointer-events-none" size={10} />
                </div>
              </div>
              
              {isUmbralInvalid && (
                <p className="text-[9px] text-orange-500 font-bold ml-1 uppercase tracking-tighter italic animate-pulse">
                  * El umbral debe ser mayor a 0
                </p>
              )}
            </div>
          </div>

          <footer className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/[0.01]">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-white"
            >
              CANCELAR
            </button>
            <button 
              type="submit" 
              disabled={isLoading || isUmbralInvalid}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-xs font-bold transition-all"
            >
              {isLoading ? 'GUARDANDO...' : (insumo ? 'ACTUALIZAR' : 'GUARDAR INSUMO')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default InsumoModal;
