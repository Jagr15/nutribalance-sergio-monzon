// src/features/ordenes/components/OrdenModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiDatabase, FiTarget, FiLayers, FiCheck, FiAlertCircle } from "react-icons/fi";
import { ApiService } from '../../../infrastructure/api';
import { EstadoOrden } from '../types/orden';
import type { Formula } from '../../formulas/types';
import { useCalculoOrden, type CalculoOrdenResultado } from '../hooks/useCalculoOrden';
import Swal from 'sweetalert2';

interface Props {
  onClose: () => void;
  onSuccess?: () => void; 
}

const OrdenModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [nroOrden, setNroOrden] = useState("");
  const [existingLotes, setExistingLotes] = useState<Set<string>>(new Set());
  const [pesoObjetivo, setPesoObjetivo] = useState<number | "">("");
  const [unidad, setUnidad] = useState<'KG' | 'TON'>('KG');
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  
  // Hooks de lógica
  const { calcularInversionLote, isCalculando } = useCalculoOrden();

  const [datosInversion, setDatosInversion] = useState<CalculoOrdenResultado | null>(null);
  const [stockSuficiente, setStockSuficiente] = useState(true);
  const [insumosFaltantes, setInsumosFaltantes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const cargarFormulas = async () => {
      try {
        const [data, ordenes] = await Promise.all([
          ApiService.formulas.findAll(),
          ApiService.ordenes.getAll(),
        ]);
        setFormulas(data);
        setExistingLotes(new Set(ordenes.map((o) => (o.lote ?? '').trim().toUpperCase())));
      } catch (error) {
        console.error("Error al cargar fórmulas:", error);
      }
    };
    cargarFormulas();
  }, []);

  const formulaOptions = useMemo(() => formulas.filter((f) => f.esta_activa), [formulas]);

  useEffect(() => {
    const realizarCalculo = async () => {
      if (selectedFormula && pesoObjetivo !== "" && Number(pesoObjetivo) > 0) {
        const cantKg = unidad === 'TON' ? Number(pesoObjetivo) * 1000 : Number(pesoObjetivo);
        const resultado = await calcularInversionLote(cantKg, selectedFormula);
        if (resultado) {
          setDatosInversion(resultado);
          setStockSuficiente(resultado.stockSuficiente);
          setInsumosFaltantes(resultado.ingredientesFaltantes);
        }
      } else {
        setDatosInversion(null);
        setStockSuficiente(true);
      }
    };
    realizarCalculo();
  }, [selectedFormula, pesoObjetivo, unidad, calcularInversionLote]);

  const handleCrearOrden = async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    const loteNormalizado = nroOrden.trim().toUpperCase();
    if (!loteNormalizado || /\s/.test(loteNormalizado)) {
      setSubmitError('El lote es obligatorio y no debe contener espacios.');
      return;
    }
    if (existingLotes.has(loteNormalizado)) {
      setSubmitError('Ya existe una orden con ese lote.');
      return;
    }
    if (!selectedFormula) {
      setSubmitError('Seleccioná una fórmula activa.');
      return;
    }
    if (pesoObjetivo === "" || Number(pesoObjetivo) <= 0 || Number.isNaN(Number(pesoObjetivo))) {
      setSubmitError('La cantidad objetivo debe ser mayor a 0.');
      return;
    }
    if (!datosInversion || !stockSuficiente) {
      setSubmitError('No se puede crear la orden sin stock suficiente.');
      return;
    }

    try {
      setIsSubmitting(true);
      // 1. CREACIÓN DE LA ORDEN
      const payload = {
        lote: loteNormalizado,
        id_formula: selectedFormula.uid,
        nombre_producto: selectedFormula.nombre_producto,
        version_formula: selectedFormula.version,
        cantidad_objetivo: unidad === 'TON' ? Number(pesoObjetivo) * 1000 : Number(pesoObjetivo),
        detalle_insumos: datosInversion.lotesInvolucrados, // Detalle FIFO
        costo_total_insumos: datosInversion.inversionTotal,
        usuario_responsable: 'Admin IAWARE',
        id_silo: null,
        destino_silo: null,
        estado: EstadoOrden.PENDIENTE,
        fecha_creacion: new Date().toISOString()
      };

      await ApiService.ordenes.create(payload);

      Swal.fire({
        icon: 'success',
        title: '¡Orden creada!',
        text: `La orden ${loteNormalizado} fue creada con planificación de consumo FIFO.`,
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#3b82f6'
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la orden de producción.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = !!nroOrden.trim() && !!selectedFormula && !!pesoObjetivo && stockSuficiente;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 w-full max-w-[420px] rounded-[2rem] overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
        
        <header className="px-8 py-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <FiLayers size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tighter italic">NUEVA ORDEN</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Planificación de Producción</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-gray-500 transition-colors">
            <FiX size={20}/>
          </button>
        </header>

        <div className="p-8 space-y-6">
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Identificador de Lote</label>
            <div className="relative group">
              <FiDatabase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
              <input 
                autoFocus
                placeholder="Ej: LOTE-2024-001"
                className="ui-input w-full rounded-2xl py-3.5 pl-12 pr-4 text-sm text-slate-900 placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 focus:bg-blue-500/[0.02] transition-all duration-200 ease-out"
                value={nroOrden} 
                onChange={(e) => setNroOrden(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-blue-500/80">Seleccionar Producto (Fórmula)</label>
            <select
              className="ui-input w-full rounded-2xl py-3.5 px-4 text-sm text-slate-900 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 transition-all duration-200 ease-out"
              value={selectedFormula?.uid ?? ""}
              onChange={(e) => {
                const found = formulaOptions.find((f) => f.uid === e.target.value) ?? null;
                setSelectedFormula(found);
              }}
            >
              <option value="">Seleccioná una fórmula activa</option>
              {formulaOptions.map((f) => (
                <option key={f.uid} value={f.uid}>
                  {f.nombre_producto} · v{f.version}
                </option>
              ))}
            </select>
            {formulaOptions.length === 0 ? <p className="text-xs text-amber-600">No hay fórmulas activas disponibles.</p> : null}
            {selectedFormula ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                <p>Producto: <strong>{selectedFormula.nombre_producto}</strong></p>
                <p>Versión: <strong>v{selectedFormula.version}</strong></p>
                <p>
                  Proteína objetivo: <strong>
                    {typeof selectedFormula.proteina_calculada_pct === 'number'
                      ? `${selectedFormula.proteina_calculada_pct.toFixed(2)}%`
                      : 'Sin dato'}
                  </strong>
                </p>
                <p>
                  Costo/kg: <strong>
                    {typeof selectedFormula.costo_por_kg === 'number'
                      ? `ARS ${selectedFormula.costo_por_kg.toFixed(4)}`
                      : 'Sin dato'}
                  </strong>
                </p>
                <p>
                  Costo/ton: <strong>
                    {typeof selectedFormula.costo_por_tonelada === 'number'
                      ? `ARS ${selectedFormula.costo_por_tonelada.toFixed(2)}`
                      : 'Sin dato'}
                  </strong>
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Volumen de Producción</label>
            <div className="flex bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 transition-all duration-200 ease-out">
              <div className="relative flex-1 group">
                <FiTarget className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full bg-transparent py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={pesoObjetivo}
                  onChange={(e) => setPesoObjetivo(e.target.value === "" ? "" : Number(e.target.value))} 
                />
              </div>
              <select 
                value={unidad} 
                onChange={(e) => setUnidad(e.target.value as 'KG' | 'TON')} 
                className="bg-slate-50 text-[10px] font-black text-blue-400 px-4 outline-none border-l border-slate-200 cursor-pointer hover:bg-blue-500/5 transition-colors"
              >
                <option value="KG">KG</option>
                <option value="TON">TON</option>
              </select>
            </div>
          </div>

          {!stockSuficiente && (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <FiAlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Stock Insuficiente</p>
                <p className="text-[10px] text-red-400/60 leading-tight uppercase font-bold">Faltan: {insumosFaltantes.join(", ")}</p>
              </div>
            </div>
          )}

          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block">Inversión Estimada</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-emerald-500/50">ARS</span>
                <span className="text-xl font-black text-emerald-400 italic tracking-tighter">
                  {datosInversion ? datosInversion.inversionTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>
            </div>
            <div className="text-right border-l border-slate-200 pl-4">
              <span className="text-[8px] font-black text-gray-600 uppercase block">Costo x Kg</span>
              <span className="text-xs font-bold text-emerald-400/80">
                ARS {datosInversion ? datosInversion.costoPorKg.toFixed(3) : "0.00"}
              </span>
            </div>
          </div>
        </div>

        <footer className="px-8 py-6 border-t border-slate-200 flex gap-4 bg-slate-50">
          <button 
            onClick={onClose} 
            type="button" 
            className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-slate-100 transition-all duration-200 ease-out"
          >
            CANCELAR
          </button>
          <button 
            onClick={handleCrearOrden} 
            type="button" 
            disabled={!isFormValid || isCalculando || isSubmitting}
            className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-blue-900/20 transition-all duration-200 ease-out flex items-center justify-center gap-2 active:scale-95"
          >
            {isCalculando || isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FiCheck size={14} />
                CONFIRMAR Y RESERVAR
              </>
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default OrdenModal;
