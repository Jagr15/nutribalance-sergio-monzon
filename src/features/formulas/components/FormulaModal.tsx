import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiTrash2, FiChevronDown, FiSearch, FiCheckCircle, FiLayers, FiGitMerge } from "react-icons/fi";
import { useFormulas } from '../hooks/useFormulas';
import { ApiService } from '../../../infrastructure/api';
import type { Formula, Ingrediente as InsumoFormula } from '../types';
import type { Insumo, StockMateriaPrima } from '../../insumos/types';
import { calculateFormulaNutrition } from '../utils/nutritionCalculator';
import { calculateFormulaCost } from '../utils/costCalculator';
import { compareFormulas } from '../utils/formulaComparison';
import Swal from 'sweetalert2';

interface Props {
  formula?: Formula;
  formulas?: Formula[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const money = (value: number | null) => (typeof value === 'number'
  ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value)
  : 'Sin costo');

const pct = (value: number | null, decimals = 2) => (typeof value === 'number' ? `${value.toFixed(decimals)}%` : 'Sin dato');

const badgeClass = (value: number | null) => {
  if (value === null || value === 0) {
    return 'bg-slate-100 text-slate-600';
  }
  return value > 0
    ? 'bg-rose-100 text-rose-700'
    : 'bg-emerald-100 text-emerald-700';
};

const badgeLabel = (value: number | null, positive: string, negative: string) => {
  if (value === null || value === 0) return 'sin diferencia';
  return value > 0 ? positive : negative;
};

const FormulaModal: React.FC<Props> = ({ formula, formulas = [], onClose, onSuccess }) => {
  const { create, update, isLoading } = useFormulas();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonFormulaId, setComparisonFormulaId] = useState('');
  
  // Datos del usuario (Idealmente de un contexto de Auth)
  const currentUser = { id: 'usr-101', name: 'Admin IAWARE' }; 

  const [nombre, setNombre] = useState(formula?.nombre_producto || '');
  const [estaActiva, setEstaActiva] = useState(formula?.esta_activa ?? true);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState<InsumoFormula[]>(formula?.ingredientes || []);
  
  const [maestroInsumos, setMaestroInsumos] = useState<Insumo[]>([]);
  const [maestroStock, setMaestroStock] = useState<StockMateriaPrima[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownAnchorRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const comparisonFormulas = useMemo(
    () => formulas.filter((item) => item.uid !== formula?.uid),
    [formulas, formula?.uid]
  );

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

  const ingredientesValidos = useMemo(
    () => insumosSeleccionados.filter((ing) => Boolean(ing.id_insumo)),
    [insumosSeleccionados]
  );

  const sumaTotal = useMemo(
    () => ingredientesValidos.reduce((acc, ing) => acc + (Number(ing.porcentaje) || 0), 0),
    [ingredientesValidos]
  );

  const resolvedComparisonFormulaId = useMemo(() => {
    if (comparisonFormulas.length === 0) return '';
    return comparisonFormulas.some((item) => item.uid === comparisonFormulaId)
      ? comparisonFormulaId
      : comparisonFormulas[0].uid;
  }, [comparisonFormulaId, comparisonFormulas]);

  const selectedComparisonFormula = useMemo(
    () => comparisonFormulas.find((item) => item.uid === resolvedComparisonFormulaId) ?? null,
    [comparisonFormulas, resolvedComparisonFormulaId]
  );

  const comparisonDraftFormula = useMemo<Formula | null>(() => {
    const validIngredients = ingredientesValidos.map((ing) => {
      const n = nutrition.byIngredient.find((item) => item.id_insumo === ing.id_insumo);
      const c = cost.byIngredient.find((item) => item.id_insumo === ing.id_insumo);

      return {
        ...ing,
        aporte_proteina_pct: n?.aporte_proteina_pct,
        aporte_proteina_g_kg: n?.aporte_proteina_g_kg,
        costo_unitario_usado: c?.costo_unitario_usado,
        costo_contribucion_kg: c?.fuente_costo === 'SIN_COSTO' ? undefined : c?.costo_contribucion_kg,
        fuente_costo: c?.fuente_costo,
      };
    });

    return {
      uid: formula?.uid ?? 'draft-formula',
      nombre_producto: nombre.trim() || 'Nueva Fórmula',
      version: formula?.version ?? 0,
      esta_activa: estaActiva,
      ultima_edicion: formula?.ultima_edicion ?? new Date(),
      id_usuario: currentUser.id,
      author: currentUser.name,
      createdAt: formula?.createdAt ?? new Date(),
      proteina_calculada_pct: nutrition.totals.proteina_bruta_pct,
      costo_total: cost.costo_total_formula,
      costo_por_kg: cost.costo_por_kg,
      costo_por_tonelada: cost.costo_por_tonelada,
      advertencias_nutricionales: [],
      advertencias_costos: [],
      ingredientes: validIngredients,
    };
  }, [formula, nombre, estaActiva, currentUser.id, currentUser.name, ingredientesValidos, nutrition, cost]);

  const comparisonResult = useMemo(() => {
    if (!comparisonDraftFormula || !selectedComparisonFormula) return null;
    return compareFormulas(comparisonDraftFormula, selectedComparisonFormula);
  }, [comparisonDraftFormula, selectedComparisonFormula]);

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

  const isSumaValida = Math.abs(sumaTotal - 100) < 0.01;
  const sumDelta = Number((100 - sumaTotal).toFixed(2));
  const sumMessage = isSumaValida
    ? 'La fórmula está completa al 100%.'
    : sumDelta > 0
      ? `Faltan ${Math.abs(sumDelta).toFixed(2)}% para completar la fórmula.`
      : `La fórmula excede el 100% por ${Math.abs(sumDelta).toFixed(2)}%.`;
  const sumTone = isSumaValida
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : sumDelta > 0
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-700';

  const canSave = useMemo(
    () => nombre.trim() !== '' && ingredientesValidos.length > 0 && (hasStructuralChanges || hasStatusChanged),
    [nombre, ingredientesValidos, hasStructuralChanges, hasStatusChanged]
  );

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

  useEffect(() => {
    if (activeDropdown === null) return undefined;

    const handleClose = () => setActiveDropdown(null);
    const handleReposition = () => {
      const anchor = dropdownAnchorRefs.current[activeDropdown];
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setDropdownPosition({
        top: Math.max(12, rect.top - 12),
        left: rect.left,
        width: rect.width,
      });
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    document.addEventListener('mousedown', handleClose);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      document.removeEventListener('mousedown', handleClose);
    };
  }, [activeDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    const normalizedName = nombre.trim().toUpperCase();
    if (!normalizedName) {
      setSubmitError('El nombre del producto es obligatorio.');
      return;
    }
    if (ingredientesValidos.length === 0) {
      setSubmitError('Debe agregar al menos un ingrediente.');
      return;
    }
    if (!isSumaValida) {
      setSubmitError(sumDelta > 0
        ? `Faltan ${Math.abs(sumDelta).toFixed(2)}% para completar la fórmula.`
        : `La fórmula excede el 100% por ${Math.abs(sumDelta).toFixed(2)}%.`);
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
          ingredientes: ingredientesValidos.map((ing) => {
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
          advertencias_nutricionales: [],
          advertencias_costos: [],
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

      <div className="bg-white border border-slate-200 w-full max-w-5xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
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
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isSumaValida ? 'bg-emerald-500/10 text-emerald-500' : sumDelta > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-500'}`}>
                {sumaTotal.toFixed(2)}%
              </span>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-sm font-semibold ${sumTone}`}>
              {sumMessage}
            </div>

            <div className="space-y-2">
              {insumosSeleccionados.map((item, index) => (
                <div key={index} className="flex gap-2 items-center group">
                  <div
                    ref={(node) => {
                      dropdownAnchorRefs.current[index] = node;
                    }}
                    className="flex-1 relative"
                  >
                    <button
                      type="button"
                    onClick={() => {
                      if (activeDropdown === index) {
                        setActiveDropdown(null);
                        setDropdownPosition(null);
                        return;
                      }

                      const anchor = dropdownAnchorRefs.current[index];
                      if (anchor) {
                        const rect = anchor.getBoundingClientRect();
                        setDropdownPosition({
                          top: Math.max(12, rect.top - 12),
                          left: rect.left,
                          width: rect.width,
                        });
                      }

                      setActiveDropdown(index);
                      setSearchTerm('');
                    }}
                      className="ui-input w-full rounded-xl py-2 px-4 text-left text-[10px] text-slate-700 flex justify-between items-center hover:bg-white/[0.04] transition-all duration-200 ease-out"
                    >
                      <span className="truncate font-medium">{item.nombre_insumo || 'Seleccionar...'}</span>
                      <FiChevronDown size={12} className="text-gray-600" />
                    </button>

                    {activeDropdown === index && dropdownPosition ? createPortal(
                      <div
                        className="z-[10000] rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-2xl"
                        style={{
                          position: 'fixed',
                          top: dropdownPosition.top,
                          left: dropdownPosition.left,
                          width: dropdownPosition.width,
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <div className="relative mb-2">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                          <input
                            autoFocus
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[10px] text-slate-900 outline-none focus:border-blue-500/40"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                          {maestroInsumos.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(ins => (
                            <button
                              key={ins.uid}
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-[10px] text-slate-500 transition-colors hover:bg-blue-600/20 hover:text-slate-900"
                              onClick={() => handleSelectInsumo(index, ins)}
                            >
                              {ins.nombre}
                            </button>
                          ))}
                        </div>
                      </div>,
                      document.body
                    ) : null}
                  </div>

                    <div className="w-20 relative">
                    <input 
                      type="number" step="0.01" value={item.porcentaje}
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
              <div className="col-span-2 text-slate-700">Total de ingredientes: <span className={`font-bold ${isSumaValida ? 'text-emerald-300' : sumDelta > 0 ? 'text-amber-300' : 'text-rose-300'}`}>{sumaTotal.toFixed(2)}%</span></div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setIsComparisonOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                <FiGitMerge size={14} className="text-blue-500" />
                Comparar con fórmula existente
              </span>
              <FiChevronDown size={14} className={`text-slate-500 transition-transform ${isComparisonOpen ? 'rotate-180' : ''}`} />
            </button>

            {isComparisonOpen ? (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                {comparisonFormulas.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No hay fórmulas disponibles para comparar.
                  </div>
                ) : !ingredientesValidos.length ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Agrega insumos para comparar.
                  </div>
                ) : (
                  <>
                    <label className="grid gap-2 md:max-w-md">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fórmula existente</span>
                      <select
                        value={resolvedComparisonFormulaId}
                        onChange={(event) => setComparisonFormulaId(event.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
                      >
                        {comparisonFormulas.map((item) => (
                          <option key={item.uid} value={item.uid}>
                            {item.nombre_producto} v{item.version}
                          </option>
                        ))}
                      </select>
                    </label>

                    {comparisonResult && selectedComparisonFormula ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fórmula nueva</p>
                            <h4 className="mt-2 text-base font-semibold text-slate-900">{comparisonResult.formulaA.nombre_producto}</h4>
                            <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Versión</dt><dd>{comparisonResult.formulaA.version > 0 ? `V${comparisonResult.formulaA.version}` : 'Sin versión'}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Proteína fórmula</dt><dd>{pct(comparisonResult.formulaA.proteina_formula)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">PB g/kg</dt><dd>{comparisonResult.formulaA.pb_g_kg !== null ? comparisonResult.formulaA.pb_g_kg.toFixed(1) : 'Sin dato'}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/kg</dt><dd>{money(comparisonResult.formulaA.costo_por_kg)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/ton</dt><dd>{money(comparisonResult.formulaA.costo_por_tonelada)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Total ingredientes %</dt><dd>{pct(comparisonResult.formulaA.total_ingredientes_pct)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Cantidad ingredientes</dt><dd>{comparisonResult.formulaA.cantidad_ingredientes}</dd></div>
                            </dl>
                          </section>

                          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">Diferencias existente - nueva</p>
                            <div className="mt-4 space-y-3 text-sm text-slate-800">
                              <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Costo/kg</p>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${badgeClass(comparisonResult.diferencias.costo_por_kg)}`}>
                                    {badgeLabel(comparisonResult.diferencias.costo_por_kg, 'costo mayor', 'costo menor')}
                                  </span>
                                </div>
                                <p className="mt-2 text-lg font-bold text-slate-900">{money(comparisonResult.diferencias.costo_por_kg)}</p>
                              </div>

                              <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Proteína %</p>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${badgeClass(comparisonResult.diferencias.proteina_formula)}`}>
                                    {badgeLabel(comparisonResult.diferencias.proteina_formula, 'proteína mayor', 'proteína menor')}
                                  </span>
                                </div>
                                <p className="mt-2 text-lg font-bold text-slate-900">{pct(comparisonResult.diferencias.proteina_formula)}</p>
                              </div>

                              <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PB g/kg</p>
                                <p className="mt-2 text-lg font-bold text-slate-900">
                                  {comparisonResult.diferencias.pb_g_kg !== null ? comparisonResult.diferencias.pb_g_kg.toFixed(1) : 'Sin dato'}
                                </p>
                              </div>

                              <div className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Costo/ton</p>
                                <p className="mt-2 text-lg font-bold text-slate-900">{money(comparisonResult.diferencias.costo_por_tonelada)}</p>
                              </div>
                            </div>
                          </section>

                          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fórmula existente</p>
                            <h4 className="mt-2 text-base font-semibold text-slate-900">{comparisonResult.formulaB.nombre_producto}</h4>
                            <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Versión</dt><dd>V{comparisonResult.formulaB.version}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Proteína fórmula</dt><dd>{pct(comparisonResult.formulaB.proteina_formula)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">PB g/kg</dt><dd>{comparisonResult.formulaB.pb_g_kg !== null ? comparisonResult.formulaB.pb_g_kg.toFixed(1) : 'Sin dato'}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/kg</dt><dd>{money(comparisonResult.formulaB.costo_por_kg)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Costo/ton</dt><dd>{money(comparisonResult.formulaB.costo_por_tonelada)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Total ingredientes %</dt><dd>{pct(comparisonResult.formulaB.total_ingredientes_pct)}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="font-medium text-slate-500">Cantidad ingredientes</dt><dd>{comparisonResult.formulaB.cantidad_ingredientes}</dd></div>
                            </dl>
                          </section>
                        </div>

                        <section className="rounded-2xl border border-slate-200 bg-white">
                          <div className="border-b border-slate-200 px-4 py-3">
                            <h4 className="text-sm font-semibold text-slate-900">Comparación de ingredientes</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-[960px] w-full text-sm">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="px-4 py-3 text-left">Insumo</th>
                                  <th className="px-4 py-3 text-right">% Fórmula nueva</th>
                                  <th className="px-4 py-3 text-right">% Fórmula existente</th>
                                  <th className="px-4 py-3 text-right">Diferencia %</th>
                                  <th className="px-4 py-3 text-right">Costo estimado nueva</th>
                                  <th className="px-4 py-3 text-right">Costo estimado existente</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {comparisonResult.ingredientes.map((row) => (
                                  <tr key={row.id_insumo} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{row.nombre_insumo}</td>
                                    <td className="px-4 py-3 text-right text-slate-700">{pct(row.porcentaje_a)}</td>
                                    <td className="px-4 py-3 text-right text-slate-700">{pct(row.porcentaje_b)}</td>
                                    <td className={`px-4 py-3 text-right font-semibold ${row.diferencia_pct > 0 ? 'text-emerald-700' : row.diferencia_pct < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                                      {pct(row.diferencia_pct)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700">{money(row.costo_estimado_a_kg)}</td>
                                    <td className="px-4 py-3 text-right text-slate-700">{money(row.costo_estimado_b_kg)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
          <footer className="px-5 py-4 border-t border-slate-200 flex gap-3 bg-slate-50">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200 ease-out border border-slate-200">Cancelar</button>
            <button 
              type="submit" 
              disabled={isLoading || isSubmitting || !canSave || !isSumaValida}
              className="flex-[1.5] py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-900/20 transition-all duration-200 ease-out"
            >
              {isSubmitting
                ? 'Procesando...'
                : (hasStructuralChanges ? (formula ? 'Generar Nueva Versión' : 'Guardar Fórmula') : 'Actualizar Estado')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );

  return createPortal(modalHTML, document.body);
};

export default FormulaModal;
