// src/features/ordenes/components/OrdenModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiDatabase, FiTarget, FiSearch, FiChevronRight, FiLayers, FiCheck, FiAlertCircle } from "react-icons/fi";
import { ApiService } from '../../../infrastructure/api';
import { EstadoOrden } from '../types/orden';
import type { DetalleInsumoLote } from '../types/orden';
import type { Formula } from '../../formulas/types';
import { useCalculoOrden, type CalculoOrdenResultado } from '../hooks/useCalculoOrden';
import { useStockMateriaPrima } from '../../insumos/hooks/useStockMateriaPrima'; // NUEVO
import Swal from 'sweetalert2';

interface Props {
  onClose: () => void;
  onSuccess?: () => void; 
}

const OrdenModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [nroOrden, setNroOrden] = useState("");
  const [pesoObjetivo, setPesoObjetivo] = useState<number | "">("");
  const [unidad, setUnidad] = useState<'KG' | 'TON'>('KG');
  const [searchTerm, setSearchTerm] = useState("");
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  // Hooks de lógica
  const { calcularInversionLote, isCalculando } = useCalculoOrden();
  const { agregarStockTransito } = useStockMateriaPrima(); // NUEVO: Hook para comprometer stock

  const [datosInversion, setDatosInversion] = useState<CalculoOrdenResultado | null>(null);
  const [stockSuficiente, setStockSuficiente] = useState(true);
  const [insumosFaltantes, setInsumosFaltantes] = useState<string[]>([]);

  useEffect(() => {
    const cargarFormulas = async () => {
      try {
        const data = await ApiService.formulas.findAll();
        setFormulas(data);
      } catch (error) {
        console.error("Error al cargar fórmulas:", error);
      }
    };
    cargarFormulas();
  }, []);

  const filteredFormulas = useMemo(() => {
    if (searchTerm.trim() === "") return [];
    return formulas.filter((f) =>
      f.nombre_producto.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, formulas]);

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

  const handleSelectFormula = (formula: Formula) => {
    setSelectedFormula(formula);
    setSearchTerm(formula.nombre_producto);
    setShowResults(false);
  };

  const handleCrearOrden = async () => {
    if (!nroOrden || !selectedFormula || !datosInversion) return;

    try {
      // 1. CREACIÓN DE LA ORDEN
      const payload = {
        lote: nroOrden,
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

      const nuevaOrden = await ApiService.ordenes.create(payload);
      // 2. NUEVA FUNCIONALIDAD: COMPROMETER STOCK EN TRÁNSITO
      // Recorremos los lotes que el cálculo FIFO seleccionó para esta orden
      if (datosInversion.lotesInvolucrados && datosInversion.lotesInvolucrados.length > 0) {
        const promesasCompromiso = datosInversion.lotesInvolucrados.map((item: DetalleInsumoLote) => {
          // Importante: item.id_lote_uid debe venir del resultado de tu hook de cálculo
          return agregarStockTransito(item.id_lote, {
            id_orden: nuevaOrden.id,
            nro_operacion: nroOrden,
            cantidad: item.cantidad_usada
          });
        });

        await Promise.all(promesasCompromiso);
      }

      Swal.fire({
        icon: 'success',
        title: '¡Orden y Reserva Lista!',
        text: `La orden ${nroOrden} ha sido creada y el stock quedó comprometido.`,
        background: '#0d121b',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error', 
        text: 'No se pudo completar la operación de reserva.',
        background: '#0d121b',
        color: '#fff'
      });
    }
  };

  const isFormValid = nroOrden && selectedFormula && pesoObjetivo && stockSuficiente;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0d121b] border border-white/10 w-full max-w-[420px] rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <FiLayers size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tighter italic">NUEVA ORDEN</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Planificación de Producción</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-gray-500 transition-colors">
            <FiX size={20}/>
          </button>
        </header>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Identificador de Lote</label>
            <div className="relative group">
              <FiDatabase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" />
              <input 
                autoFocus
                placeholder="Ej: LOTE-2024-001"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:bg-blue-500/[0.02] transition-all"
                value={nroOrden} 
                onChange={(e) => setNroOrden(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-blue-500/80">Seleccionar Producto (Fórmula)</label>
            <div className="relative">
              <div className="relative group">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  placeholder="Buscar fórmula..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                />
              </div>
              
              {showResults && filteredFormulas.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b26] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl max-h-[200px] overflow-y-auto">
                  {filteredFormulas.map(f => (
                    <button 
                      key={f.uid}
                      onClick={() => handleSelectFormula(f)}
                      className="w-full px-5 py-3 text-left hover:bg-white/5 flex items-center justify-between group transition-colors"
                    >
                      <span className="text-sm text-gray-300 group-hover:text-white">{f.nombre_producto}</span>
                      <FiChevronRight className="text-gray-600 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Volumen de Producción</label>
            <div className="flex bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden focus-within:border-blue-500 transition-all">
              <div className="relative flex-1 group">
                <FiTarget className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full bg-transparent py-3.5 pl-12 pr-4 text-sm text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={pesoObjetivo} 
                  onChange={(e) => setPesoObjetivo(e.target.value === "" ? "" : Number(e.target.value))} 
                />
              </div>
              <select 
                value={unidad} 
                onChange={(e) => setUnidad(e.target.value as 'KG' | 'TON')} 
                className="bg-[#161b26] text-[10px] font-black text-blue-400 px-4 outline-none border-l border-white/10 cursor-pointer hover:bg-blue-500/5 transition-colors"
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

          <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest block">Inversión Estimada</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-emerald-500/50">ARS</span>
                <span className="text-xl font-black text-emerald-400 italic tracking-tighter">
                  {datosInversion ? datosInversion.inversionTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>
            </div>
            <div className="text-right border-l border-white/5 pl-4">
              <span className="text-[8px] font-black text-gray-600 uppercase block">Costo x Kg</span>
              <span className="text-xs font-bold text-emerald-400/80">
                ARS {datosInversion ? datosInversion.costoPorKg.toFixed(3) : "0.00"}
              </span>
            </div>
          </div>
        </div>

        <footer className="px-8 py-6 border-t border-white/5 flex gap-4 bg-white/[0.01]">
          <button 
            onClick={onClose} 
            type="button" 
            className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-white/5 transition-all"
          >
            CANCELAR
          </button>
          <button 
            onClick={handleCrearOrden} 
            type="button" 
            disabled={!isFormValid || isCalculando} 
            className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800/50 disabled:text-gray-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {isCalculando ? (
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
