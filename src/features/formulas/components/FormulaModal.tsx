import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiTrash2, FiChevronDown, FiSearch, FiCheckCircle, FiLayers } from "react-icons/fi";
import { useFormulas } from '../hooks/useFormulas';
import { ApiService } from '../../../infrastructure/api';
import type { Formula, Ingrediente as InsumoFormula } from '../types';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import { calculateFormulaNutrition } from '../utils/nutritionCalculator';
import { calculateFormulaCost } from '../utils/costCalculator';
import Swal from 'sweetalert2';

interface Props {
  formula?: Formula;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const FormulaModal: React.FC<Props> = ({ formula, onClose, onSuccess }) => {
  const { create, update, isLoading } = useFormulas();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  
  // Datos del usuario (Idealmente de un contexto de Auth)
  const currentUser = { id: 'usr-101', name: 'Admin IAWARE' }; 

  const [nombre, setNombre] = useState(formula?.nombre_producto || '');
  const [estaActiva, setEstaActiva] = useState(formula?.esta_activa ?? true);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<InsumoFormula[]>(formula?.ingredientes || []);
  
  const [maestroInsumos, setMaestroInsumos] = useState<Insumo[]>([]);
  const [maestroStock, setMaestroStock] = useState<StockMateriaPrima[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [insumos, lotes] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.stockMP.getAllLotes(),
        ]);
        setMaestroInsumos(insumos);
        setMaestroStock(lotes);
        setCatalogError(null);
      } catch {
        setCatalogError('No se pudieron cargar insumos/stock para calcular fórmula.');
      }
    };
    fetchData();
  }, []);

  const nutrition = useMemo(() => {
    return calculateFormulaNutrition(insumosSeleccionados, maestroInsumos);
  }, [insumosSeleccionados, maestroInsumos]);

  const cost = useMemo(() => {
    return calculateFormulaCost(insumosSeleccionados, maestroStock, maestroInsumos);
  }, [insumosSeleccionados, maestroStock, maestroInsumos]);

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
    const ids = insumosSeleccionados.map((i) => i.id_insumo).filter(Boolean);
    const hasDuplicates = new Set(ids).size !== ids.length;
    const allValid = insumosSeleccionados.every((ing) => ing.id_insumo && Number(ing.porcentaje) > 0);
    return nombre.trim() !== '' && isSumaValida && hayCambios && insumosSeleccionados.length > 0 && allValid && !hasDuplicates;
  }, [nombre, isSumaValida, hasStructuralChanges, hasStatusChanged, insumosSeleccionados]);

  const handleSelectInsumo = (index: number, ins: Insumo) => {
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
    if (isSubmitting) return;
    setSubmitError(null);

    const normalizedName = nombre.trim().toUpperCase();
    if (!normalizedName) {
      setSubmitError('El nombre del producto es obligatorio.');
      return;
    }
    if (insumosSeleccionados.length === 0) {
      setSubmitError('Debe agregar al menos un ingrediente.');
      return;
    }
    if (insumosSeleccionados.some((ing) => !ing.id_insumo)) {
      setSubmitError('Todos los ingredientes deben tener un insumo seleccionado.');
      return;
    }
    if (insumosSeleccionados.some((ing) => Number(ing.porcentaje) <= 0)) {
      setSubmitError('Todos los porcentajes deben ser mayores a 0.');
      return;
    }
    const ids = insumosSeleccionados.map((ing) => ing.id_insumo);
    if (new Set(ids).size !== ids.length) {
      setSubmitError('No se permiten insumos duplicados en la fórmula.');
      return;
    }
    if (!isSumaValida) {
      setSubmitError('La suma de porcentajes debe ser 100%.');
      return;
    }
    if (catalogError) {
      setSubmitError(catalogError);
      return;
    }

    const now = new Date();

    try {
      setIsSubmitting(true);
      if (hasStructuralChanges) {
        // CASO: NUEVA VERSIÓN O REGISTRO NUEVO
        const nuevaVersion = formula ? formula.version + 1 : 1;
        
        await create({
          nombre_producto: normalizedName,
          ingredientes: insumosSeleccionados.map((ing) => {
            const n = nutrition.byIngredient.find((item) => item.id_insumo === ing.id_insumo);
            const c = cost.byIngredient.find((item) => item.id_insumo === ing.id_insumo);
            return {
              ...ing,
              aporte_proteina_pct: n?.aporte_proteina_pct,
              aporte_proteina_g_kg: n?.aporte_proteina_g_kg,
              costo_unitario_usado: c?.costo_unitario_usado,
              costo_contribucion_kg: c?.costo_contribucion_kg,
              fuente_costo: c?.fuente_costo,
            };
          }),
          version: nuevaVersion,
          esta_activa: estaActiva,
          id_usuario: currentUser.id,
          author: currentUser.name,
          createdAt: formula?.createdAt || now,
          proteina_calculada_pct: nutrition.totals.proteina_bruta_pct,
          costo_total: cost.costo_total_formula,
          costo_por_kg: cost.costo_por_kg,
          costo_por_tonelada: cost.costo_por_tonelada,
          advertencias_nutricionales: nutrition.warnings,
          advertencias_costos: cost.warnings,
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
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Error al procesar la fórmula.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalHTML = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        <header className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <FiLayers className="text-blue-500" size={14} />
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
              {formula ? (hasStructuralChanges ? `Nueva Versión (V${formula.version + 1})` : 'Editar Registro') : 'Nueva Fórmula'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-gray-500"><FiX size={18}/></button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}
          {catalogError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {catalogError}
            </div>
          ) : null}
          
          <div className="grid grid-cols-4 gap-3 items-end">
            <div className="col-span-3 space-y-1.5">
              <label className="text-[9px] font-black text-gray-600 uppercase ml-1 tracking-widest">Nombre del Producto</label>
              <input 
                type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="NOMBRE DEL PRODUCTO"
                className="ui-input w-full rounded-xl py-2.5 px-4 text-[11px] text-slate-900 outline-none focus:border-blue-500/30 font-bold"
              />
            </div>
            
            <div className="col-span-1 space-y-1.5">
              <label className="text-[9px] font-black text-gray-600 uppercase text-center block tracking-widest">Estado</label>
              <button
                type="button"
                onClick={() => setEstaActiva(!estaActiva)}
                className={`w-full flex items-center justify-center rounded-xl border transition-all duration-200 ease-out h-[40px] ${estaActiva ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}
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
                      className="ui-input w-full rounded-xl py-2 px-4 text-left text-[10px] text-slate-700 flex justify-between items-center hover:bg-white/[0.04] transition-all duration-200 ease-out"
                    >
                      <span className="truncate font-medium">{item.nombre_insumo || 'Seleccionar...'}</span>
                      <FiChevronDown size={12} className="text-gray-600" />
                    </button>

                    {activeDropdown === index && (
                      <div className="absolute left-0 right-0 bottom-full mb-2 z-[100] bg-slate-50 border border-slate-200 rounded-xl shadow-xl p-2 w-72">
                        <div className="relative mb-2">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                          <input 
                            autoFocus placeholder="Buscar..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-8 pr-3 text-[10px] text-slate-900 outline-none focus:border-blue-500/40"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                          {maestroInsumos.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(ins => (
                            <button
                              key={ins.uid} type="button"
                              className="w-full text-left px-3 py-2 hover:bg-blue-600/20 rounded-lg text-[10px] text-slate-500 hover:text-slate-900 transition-colors duration-200 transition-colors"
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
                      className="ui-input w-full rounded-xl py-2 pr-6 text-center text-[10px] text-slate-900 font-black outline-none focus:border-blue-500/30 transition-all duration-200 ease-out h-[36px]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-600">%</span>
                  </div>

                  <button 
                    type="button" onClick={() => setInsumosSeleccionados(prev => prev.filter((_, i) => i !== index))}
                    className="p-2 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200 ease-out"
                  ><FiTrash2 size={14} /></button>
                </div>
              ))}
            </div>

            <button 
              type="button" onClick={() => setInsumosSeleccionados(prev => [...prev, { id_insumo: '', nombre_insumo: '', porcentaje: 0 }])}
              className="w-full py-3 border border-dashed border-slate-200 rounded-xl text-gray-500 text-[9px] font-black uppercase hover:bg-slate-100 transition-all duration-200 ease-out flex items-center justify-center gap-2"
            ><FiPlus size={14}/> Añadir Insumo</button>
          </div>

          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Cálculo automático</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="text-slate-700">Proteína fórmula: <span className="text-blue-300 font-bold">{nutrition.totals.proteina_bruta_pct.toFixed(2)}%</span></div>
              <div className="text-slate-700">PB (g/kg): <span className="text-blue-300 font-bold">{nutrition.totals.proteina_g_kg.toFixed(1)}</span></div>
              <div className="text-slate-700">Costo/kg: <span className="text-emerald-300 font-bold">{cost.costo_por_kg.toFixed(4)}</span></div>
              <div className="text-slate-700">Costo/ton: <span className="text-emerald-300 font-bold">{cost.costo_por_tonelada.toFixed(2)}</span></div>
            </div>
            {(nutrition.warnings.length > 0 || cost.warnings.length > 0) && (
              <div className="text-[9px] text-amber-300 space-y-1 pt-2 border-t border-slate-200">
                {nutrition.warnings.slice(0, 2).map((w) => <p key={`n-${w}`}>• {w}</p>)}
                {cost.warnings.slice(0, 2).map((w) => <p key={`c-${w}`}>• {w}</p>)}
              </div>
            )}
          </div>
        </form>

        <footer className="px-5 py-4 border-t border-slate-200 flex gap-3 bg-slate-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200 ease-out border border-slate-200">Cancelar</button>
          <button 
            type="submit" 
            disabled={isLoading || isSubmitting || !canSave}
            className="flex-[1.5] py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-900/20 transition-all duration-200 ease-out"
          >
            {isSubmitting
              ? 'Procesando...'
              : (hasStructuralChanges ? (formula ? 'Generar Nueva Versión' : 'Guardar Fórmula') : 'Actualizar Estado')}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalHTML, document.body);
};

export default FormulaModal;
