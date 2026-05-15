// src/features/ordenes/pages/OrdenPage.tsx
import React, { useState } from 'react';
import { FiPlus, FiSearch, FiActivity } from "react-icons/fi";
import OrdenTable from '../components/OrdenTable';
import OrdenModal from '../components/OrdenModal';
import FinalizarOrdenModal from '../components/FinalizarOrdenModal';
import { useOrdenes } from '../hooks/useOrdenes';
import type { OrdenProduccion } from '../types/orden';

const OrdenPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ordenAFinalizar, setOrdenAFinalizar] = useState<OrdenProduccion | null>(null);
  
  // Extraemos fetchOrdenes para poder refrescar la lista
  const { ordenes, isLoading, handleFinishProduction, fetchOrdenes } = useOrdenes();

  const onConfirmFinish = async (data: any) => {
    if (!ordenAFinalizar) return;
    await handleFinishProduction(ordenAFinalizar.id, data);
    setOrdenAFinalizar(null);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <FiActivity size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Producción en Tiempo Real</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            Órdenes de <span className="text-blue-500">Producción</span>
          </h1>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-blue-900/20 transition-all active:scale-95"
        >
          <FiPlus size={16}/> Nueva Orden
        </button>
      </header>

      {/* Buscador Slim */}
      <div className="relative group max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Buscar lote o producto..." 
          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all" 
        />
      </div>

      {/* Tabla conectada */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-[#0d121b] border border-white/5 rounded-[1.5rem]">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cargando registros...</p>
        </div>
      ) : (
        <OrdenTable 
          data={ordenes} 
          onFinalizar={(orden) => setOrdenAFinalizar(orden)} 
        />
      )}

      {/* MODAL DE CREACIÓN: Pasamos fetchOrdenes a onSuccess */}
      {isModalOpen && (
        <OrdenModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchOrdenes} 
        />
      )}
      
      {ordenAFinalizar && (
        <FinalizarOrdenModal 
          orden={ordenAFinalizar} 
          onClose={() => setOrdenAFinalizar(null)} 
          onConfirm={onConfirmFinish}
        />
      )}
    </div>
  );
};

export default OrdenPage;