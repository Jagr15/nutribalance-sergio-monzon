// src/components/insumos/InsumoModal.tsx
import React, { useState } from 'react';
import { FiX, FiChevronDown } from "react-icons/fi";
import { TipoCategoria, type Insumo } from '../types/insumo';
import { TipoUnidad } from '../../../shared/types/global.interface'; // Usamos tu enum global
import { useInsumos } from '../hooks/useInsumos';
import Swal from 'sweetalert2';
import { normalizarCostoInsumo, type UnidadCostoInsumo } from '../utils/costoInsumo';

interface InsumoModalProps {
  insumo?: Insumo;
  existingInsumos: Insumo[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const InsumoModal: React.FC<InsumoModalProps> = ({ insumo, existingInsumos, onClose, onSuccess }) => {
  const { create, update, isLoading } = useInsumos();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Estados locales para el formulario
  const [nombre, setNombre] = useState(insumo?.nombre || '');
  const [categoria, setCategoria] = useState<TipoCategoria>(
    (insumo?.categoria as TipoCategoria) || '' as TipoCategoria
  );
  const [umbral, setUmbral] = useState(insumo?.umbral_alerta?.toString() || '0');
  const [costo, setCosto] = useState(insumo?.costo_por_kg ?? insumo?.ref_costo_unitario ?? insumo?.costo ?? 0);
  const [unidadCosto, setUnidadCosto] = useState<UnidadCostoInsumo>(insumo?.unidad_costo ?? 'KG');
  
  // Nuevo estado para la Unidad de Medida
  const [unidad, setUnidad] = useState<TipoUnidad>(
    insumo?.unidad_medida || TipoUnidad.KG
  );

  const isUmbralInvalid = parseInt(umbral, 10) <= 0 || umbral === '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;
    if (isUmbralInvalid) {
      setSubmitError('El umbral debe ser mayor a 0.');
      return;
    }

    setSubmitError(null);
    const normalizedNombre = nombre.trim().toUpperCase();
    if (!normalizedNombre) {
      setSubmitError('El nombre es obligatorio.');
      return;
    }
    if (!categoria) {
      setSubmitError('La categoría es obligatoria.');
      return;
    }
    const duplicated = existingInsumos.some(
      (item) => item.uid !== insumo?.uid && item.nombre.trim().toUpperCase() === normalizedNombre
    );
    if (duplicated) {
      setSubmitError('Ya existe un insumo activo con ese nombre.');
      return;
    }

    const costoNormalizado = normalizarCostoInsumo({ costo, unidad_costo: unidadCosto });
    const payload = {
      nombre: normalizedNombre,
      categoria,
      umbral_alerta: parseInt(umbral, 10),
      unidad_medida: unidad,
      costo: costoNormalizado?.costo,
      unidad_costo: costoNormalizado?.unidad_costo,
      costo_por_kg: costoNormalizado?.costo_por_kg,
      costo_por_tonelada: costoNormalizado?.costo_por_tonelada,
      ref_costo_unitario: costoNormalizado?.costo_por_kg,
    };

    setIsSubmitting(true);
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
        background: '#ffffff',
        color: '#0f172a',
        customClass: { popup: 'border border-slate-200 rounded-xl' }
      });
    
      Toast.fire({
        icon: 'success',
        title: insumo ? 'Actualizado correctamente' : 'Insumo registrado'
      });
    
      await onSuccess(); 
      onClose();
    } catch {
      setSubmitError('Hubo un problema al intentar guardar los cambios.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl animate-fade-slide duration-200">
        
        <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-[14px] font-bold text-slate-900 tracking-widest uppercase">
            {insumo ? 'Editar Insumo' : 'Nuevo Insumo'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-slate-900 p-1">
            <FiX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
            ) : null}
            
            {/* Campo: Nombre */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nombre</label>
              <input 
                required
                type="text" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. MAÍZ AMARILLO"
                className="ui-input w-full rounded-lg py-2.5 px-3 text-sm text-slate-700"
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
                  className="ui-input w-full rounded-lg py-2.5 px-3 text-sm text-slate-700 appearance-none cursor-pointer"
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
                    className={`ui-input w-full ${isUmbralInvalid ? 'border-orange-500/40' : ''} rounded-lg py-2.5 px-3 text-sm text-slate-700 font-mono`}
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
                      <option key={u} value={u} className="bg-white text-slate-700">{u}</option>
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

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Costo de referencia</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={costo}
                    onChange={(e) => setCosto(Number(e.target.value))}
                    placeholder="Costo"
                    className="ui-input w-full rounded-lg py-2.5 px-3 text-sm text-slate-700 font-mono"
                  />
                </div>
                <div className="relative">
                  <select
                    value={unidadCosto}
                    onChange={(e) => setUnidadCosto(e.target.value as UnidadCostoInsumo)}
                    className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold py-2.5 px-2 rounded-lg appearance-none outline-none cursor-pointer text-center"
                  >
                    <option value="KG">KG</option>
                    <option value="TON">TON</option>
                  </select>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 ml-1">
                Se normaliza automáticamente a costo por kg para inventario y finanzas.
              </p>
            </div>
          </div>

          <footer className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-slate-900"
            >
              CANCELAR
            </button>
            <button 
              type="submit" 
              disabled={isLoading || isSubmitting || isUmbralInvalid}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
            >
              {(isLoading || isSubmitting) ? 'GUARDANDO...' : (insumo ? 'ACTUALIZAR' : 'GUARDAR INSUMO')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default InsumoModal;
