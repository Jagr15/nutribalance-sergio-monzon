import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiTrash2, FiChevronDown, FiSearch, FiCheckCircle, FiLayers } from "react-icons/fi";
import { useFormulas } from '../hooks/useFormulas';
import { ApiService } from '../../../infrastructure/api';
import type { Formula, Ingrediente as InsumoFormula } from '../types';
import Swal from 'sweetalert2';

interface Props {
  formula?: Formula;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const FormulaModal: React.FC<Props> = ({ formula, onClose, onSuccess }) => {
  const { create, update, isLoading } = useFormulas();
  
  // Datos del usuario (Idealmente de un contexto de Auth)
  const currentUser = { id: 'usr-101', name: 'Admin IAWARE' }; 

  const [nombre, setNombre] = useState(formula?.nombre_producto || '');
  const [estaActiva, setEstaActiva] = useState(formula?.esta_activa ?? true);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<InsumoFormula[]>(formula?.ingredientes || []);
  
  const [maestroInsumos, setMaestroInsumos] = useState<any[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const insumos = await ApiService.insumos.getAllInsumos();
        setMaestroInsumos(insumos);
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, []);

  const hasStructuralChanges = useMemo(() => {
    if (!formula) return true;
    if (nombre.trim().toUpperCase() !== formula.nombre_producto.toUpperCase()) return true;
    if (insumosSeleccionados.length !== formula.ingredientes.length) return true;

    return !insumosSeleccionados.every((item, idx) => {
      const original = formula.ingredientes[idx];
      return (
        item.id_insumo === original.id_insumo &&
        Number(item.porcentaje) === Number(original.porcentaje)
      );
    });
  }, [nombre, insumosSeleccionados, formula]);

  const hasStatusChanged = useMemo(() => formula ? estaActiva !== formula.esta_activa : false, [estaActiva, formula]);

  const sumaTotal = useMemo(() => 
    insumosSeleccionados.reduce((acc, ing) => acc + (Number(ing.porcentaje) || 0), 0)
  , [insumosSeleccionados]);

  const isSumaValida = Math.abs(sumaTotal - 100) < 0.01;

  const canSave = useMemo(() => {
    const hayCambios = hasStructuralChanges || hasStatusChanged;
    return nombre.trim() !== '' && isSumaValida && hayCambios && insumosSeleccionados.length > 0;
  }, [nombre, isSumaValida, hasStructuralChanges, hasStatusChanged, insumosSeleccionados]);

  const handleSelectInsumo = (index: number, ins: any) => {
    const yaExiste = insumosSeleccionados.some((item, i) => item.id_insumo === ins.uid && i !== index);
    if (yaExiste) {
      Toast.fire({ icon: 'error', title: 'Insumo ya presente en la mezcla' });
      return;
    }
    const nuevosInsumos = [...insumosSeleccionados];
    nuevosInsumos[index] = { ...nuevosInsumos[index], id_insumo: ins.uid, nombre_insumo: ins.nombre };
    setInsumosSeleccionados(nuevosInsumos);
    setActiveDropdown(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const now = new Date();

    try {
      if (hasStructuralChanges) {
        // CASO: NUEVA VERSIÓN O REGISTRO NUEVO
        const nuevaVersion = formula ? formula.version + 1 : 1;
        
        await create({
          nombre_producto: nombre.toUpperCase(),
          ingredientes: insumosSeleccionados,
          version: nuevaVersion,
          esta_activa: estaActiva,
          id_usuario: currentUser.id,
          author: currentUser.name,
          createdAt: formula?.createdAt || now,
        });
        Toast.fire({ icon: 'success', title: formula ? `Versión V${nuevaVersion} generada` : 'Fórmula guardada' });
      } else if (hasStatusChanged && formula?.uid) {
        // CASO: SOLO ACTUALIZAR ESTADO (EVITA DUPLICADOS)
        await update(formula.uid, {
          esta_activa: estaActiva,
          ultima_edicion: now // Actualizamos solo la edición
        });
        Toast.fire({ icon: 'success', title: 'Estado actualizado' });
      }
      
      await onSuccess();
      onClose();
    } catch (error) { 
      console.error(error);
      Toast.fire({ icon: 'error', title: 'Error al procesar' });
    }
  };

  const modalHTML = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className="bg-[#0d121b] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        <header className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <FiLayers className="text-blue-500" size={14} />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">
              {formula ? (hasStructuralChanges ? `Nueva Versión (V${formula.version + 1})` : 'Editar Registro') : 'Nueva Fórmula'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-gray-500"><FiX size={18}/></button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
          <div className="grid grid-cols-4 gap-3 items-end">
            <div className="col-span-3 space-y-1.5">
              <label className="text-[9px] font-black text-gray-600 uppercase ml-1 tracking-widest">Nombre del Producto</label>
              <input 
                type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="NOMBRE DEL PRODUCTO"
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2.5 px-4 text-[11px] text-white outline-none focus:border-blue-500/30 font-bold"
              />
            </div>
            
            <div className="col-span-1 space-y-1.5">
              <label className="text-[9px] font-black text-gray-600 uppercase text-center block tracking-widest">Estado</label>
              <button
                type="button"
                onClick={() => setEstaActiva(!estaActiva)}
                className={`w-full flex items-center justify-center rounded-xl border transition-all h-[40px] ${estaActiva ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}
              >
                <FiCheckCircle size={14} className={estaActiva ? 'opacity-100' : 'opacity-30'} />
                <span className="text-[8px] font-black ml-1.5 uppercase tracking-tighter">{estaActiva ? 'Activo' : 'Inactivo'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 relative">
            <div className="flex justify-between items-center px-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Mezcla de Insumos</label>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isSumaValida ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {sumaTotal}%
              </span>
            </div>

            <div className="space-y-2">
              {insumosSeleccionados.map((item, index) => (
                <div key={index} className="flex gap-2 items-center group">
                  <div className="flex-1 relative">
                    <button
                      type="button"
                      onClick={() => { setActiveDropdown(activeDropdown === index ? null : index); setSearchTerm(''); }}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2 px-4 text-left text-[10px] text-gray-300 flex justify-between items-center hover:bg-white/[0.04] transition-all"
                    >
                      <span className="truncate font-medium">{item.nombre_insumo || 'Seleccionar...'}</span>
                      <FiChevronDown size={12} className="text-gray-600" />
                    </button>

                    {activeDropdown === index && (
                      <div className="absolute left-0 right-0 bottom-full mb-2 z-[100] bg-[#161b26] border border-white/10 rounded-xl shadow-2xl p-2 w-72">
                        <div className="relative mb-2">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                          <input 
                            autoFocus placeholder="Buscar..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/5 rounded-lg py-2 pl-8 pr-3 text-[10px] text-white outline-none focus:border-blue-500/40"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                          {maestroInsumos.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(ins => (
                            <button
                              key={ins.uid} type="button"
                              className="w-full text-left px-3 py-2 hover:bg-blue-600/20 rounded-lg text-[10px] text-gray-400 hover:text-white transition-colors"
                              onClick={() => handleSelectInsumo(index, ins)}
                            >
                              {ins.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-20 relative">
                    <input 
                      type="number" step="0.01" required value={item.porcentaje}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setInsumosSeleccionados(prev => prev.map((it, i) => i === index ? { ...it, porcentaje: val } : it));
                      }}
                      className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2 pr-6 text-center text-[10px] text-white font-black outline-none focus:border-blue-500/30 transition-all h-[36px]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-600">%</span>
                  </div>

                  <button 
                    type="button" onClick={() => setInsumosSeleccionados(prev => prev.filter((_, i) => i !== index))}
                    className="p-2 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  ><FiTrash2 size={14} /></button>
                </div>
              ))}
            </div>

            <button 
              type="button" onClick={() => setInsumosSeleccionados(prev => [...prev, { id_insumo: '', nombre_insumo: '', porcentaje: 0 }])}
              className="w-full py-3 border border-dashed border-white/10 rounded-xl text-gray-500 text-[9px] font-black uppercase hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            ><FiPlus size={14}/> Añadir Insumo</button>
          </div>
        </form>

        <footer className="px-5 py-4 border-t border-white/5 flex gap-3 bg-white/[0.01]">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase text-gray-500 bg-[#161b22] hover:bg-[#1f242d] transition-all border border-white/5">Cancelar</button>
          <button 
            type="submit" 
            disabled={isLoading || !canSave} 
            onClick={handleSubmit}
            className="flex-[1.5] py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-900/20 transition-all"
          >
            {hasStructuralChanges ? (formula ? 'Generar Nueva Versión' : 'Guardar Fórmula') : 'Actualizar Estado'}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalHTML, document.body);
};

export default FormulaModal;