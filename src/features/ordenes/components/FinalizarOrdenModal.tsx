import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  FiX, FiActivity, FiLayers, FiCheck, 
  FiArrowRight, FiSearch, FiDatabase 
} from "react-icons/fi";
import type { OrdenProduccion } from '../types/orden';

interface Props {
  orden: OrdenProduccion;
  onClose: () => void;
  onConfirm: (data: { 
    lote_salida: string; 
    merma: number; 
    cantidad_real: number;
    destino_silo: string;
  }) => void;
}

const FinalizarOrdenModal: React.FC<Props> = ({ orden, onClose, onConfirm }) => {
  const [merma, setMerma] = useState<number>(0);
  const [loteSalida, setLoteSalida] = useState("");
  const [destinoSilo, setDestinoSilo] = useState("");
  const cantidadReal = Math.max(orden.cantidad_objetivo - merma, 0);

  const handleConfirm = () => {
    if (!loteSalida || !destinoSilo) return;
    onConfirm({
      lote_salida: loteSalida,
      merma: merma,
      cantidad_real: cantidadReal,
      destino_silo: destinoSilo
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#05080a]/95 backdrop-blur-md p-4">
      <div className="bg-[#0d121b] border border-white/10 w-full max-w-[420px] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* HEADER SLIM */}
        <header className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div>
            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-0.5">Cierre de Producción</p>
            <h3 className="text-base font-extrabold text-white tracking-tight italic uppercase">{orden.lote}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-600 transition-all active:scale-95">
            <FiX size={18}/>
          </button>
        </header>

        <div className="p-8 space-y-5">
          
          {/* LOTE DE SALIDA */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase ml-1 tracking-[0.2em] flex items-center gap-2">
              <FiLayers size={10} className="text-blue-500"/> ID Lote de Salida (PT)
            </label>
            <input 
              type="text"
              autoFocus
              placeholder="EJ: PT-2026-001"
              value={loteSalida}
              onChange={(e) => setLoteSalida(e.target.value.toUpperCase())}
              className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-2.5 px-4 text-[13px] text-white font-bold outline-none focus:border-blue-500/30 transition-all placeholder:text-gray-800"
            />
          </div>

          {/* DESTINO (SILO) - BUSCADOR SLIM */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase ml-1 tracking-[0.2em] flex items-center gap-2">
              <FiDatabase size={10} className="text-orange-500"/> Destino / Almacenamiento (Silo)
            </label>
            <div className="relative group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-500 transition-colors" size={12}/>
              <input 
                type="text"
                placeholder="Buscar silo disponible..."
                value={destinoSilo}
                onChange={(e) => setDestinoSilo(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-[13px] text-gray-300 font-bold outline-none focus:border-orange-500/30 transition-all"
              />
            </div>
          </div>

          {/* GRID: MERMA Y RESULTADO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase ml-1 tracking-[0.2em] flex items-center gap-2">
                <FiActivity size={10} className="text-red-500"/> Merma (KG)
              </label>
              <input 
                type="number"
                value={merma}
                onChange={(e) => setMerma(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full bg-red-500/[0.02] border border-red-500/10 rounded-xl py-2.5 px-4 text-[13px] text-red-400 font-mono font-black outline-none focus:border-red-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block text-right pr-1">Total Neto Real</label>
              <div className="w-full bg-emerald-500/5 border border-emerald-500/10 rounded-xl py-2 px-4 h-[41px] flex items-center justify-end">
                <span className="text-sm font-mono font-black text-emerald-500 tracking-tighter">
                  {cantidadReal.toLocaleString()}
                  <small className="text-[9px] ml-1 opacity-50 uppercase">kg</small>
                </span>
              </div>
            </div>
          </div>

          {/* RESUMEN DE COMPARACIÓN SLIM */}
          <div className="bg-gradient-to-r from-white/[0.02] to-transparent border border-white/5 rounded-xl p-3 flex justify-between items-center px-5">
             <div className="flex flex-col">
               <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Planificado</span>
               <span className="text-[11px] font-bold text-gray-400 font-mono">{orden.cantidad_objetivo} kg</span>
             </div>
             <FiArrowRight className="text-gray-800" size={14}/>
             <div className="flex flex-col text-right">
               <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">A Ingresar</span>
               <span className="text-[11px] font-black text-emerald-500 font-mono">{cantidadReal} kg</span>
             </div>
          </div>
        </div>

        {/* FOOTER ACCIONES SLIM */}
        <footer className="px-8 py-6 border-t border-white/5 bg-white/[0.01] flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 py-2.5 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:bg-white/5 rounded-lg transition-all"
          >
            CANCELAR
          </button>
          <button 
            disabled={!loteSalida || !destinoSilo}
            onClick={handleConfirm}
            className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-blue-900/20 transition-all disabled:opacity-20 flex items-center justify-center gap-2 tracking-[0.2em] active:scale-95"
          >
            <FiCheck size={14}/> FINALIZAR ORDEN
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FinalizarOrdenModal;
