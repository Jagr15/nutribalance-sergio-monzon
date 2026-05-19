// src/features/ordenes/pages/OrdenPage.tsx
import React, { useState } from 'react';
import { FiPlus, FiSearch, FiActivity } from "react-icons/fi";
import OrdenTable from '../components/OrdenTable';
import OrdenModal from '../components/OrdenModal';
import FinalizarOrdenModal from '../components/FinalizarOrdenModal';
import { useOrdenes } from '../hooks/useOrdenes';
import type { FinalizarOrdenPayload } from '../services/ordenService';
import type { OrdenProduccion } from '../types/orden';
import Swal from 'sweetalert2';

const OrdenPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ordenAFinalizar, setOrdenAFinalizar] = useState<OrdenProduccion | null>(null);
  
  // Extraemos fetchOrdenes para poder refrescar la lista
  const { ordenes, isLoading, handleStartProduction, handleDeleteOrder, handleFinishProduction, fetchOrdenes } = useOrdenes();

  const onConfirmFinish = async (data: FinalizarOrdenPayload) => {
    if (!ordenAFinalizar) return;
    await handleFinishProduction(ordenAFinalizar.id, data);
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Orden ${ordenAFinalizar.lote} finalizada`,
      timer: 2200,
      showConfirmButton: false,
      background: '#0d121b',
      color: '#fff',
    });
    setOrdenAFinalizar(null);
  };

  const onStartOrder = async (orden: OrdenProduccion) => {
    await handleStartProduction(orden.id);
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Orden ${orden.lote} iniciada`,
      timer: 2200,
      showConfirmButton: false,
      background: '#0d121b',
      color: '#fff',
    });
  };

  const onDeleteOrder = async (orden: OrdenProduccion) => {
    const result = await Swal.fire({
      title: '¿Eliminar orden?',
      text: `Se eliminará ${orden.lote}. Esta acción no se puede revertir.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#0d121b',
      color: '#fff',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    await handleDeleteOrder(orden.id);
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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0d121b] border border-white/5 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Producción</p>
          <p className="text-sm text-gray-300 mt-1">Seguimiento de lotes activos y cierres.</p>
        </div>
        <div className="bg-[#0d121b] border border-white/5 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Inventario</p>
          <p className="text-sm text-gray-300 mt-1">Consumo de insumos y costo por orden.</p>
        </div>
        <div className="bg-[#0d121b] border border-white/5 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Estado Operativo</p>
          <p className="text-sm text-gray-300 mt-1">Pendiente, en proceso y finalizada.</p>
        </div>
      </section>

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
      ) : ordenes.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-[#0d121b] border border-white/5 rounded-[1.5rem]">
          <p className="text-sm font-bold text-gray-300">Todavía no hay órdenes cargadas</p>
          <p className="text-xs text-gray-500">Creá una orden para iniciar el flujo de producción.</p>
        </div>
      ) : (
        <OrdenTable 
          data={ordenes} 
          onIniciar={onStartOrder}
          onEliminar={onDeleteOrder}
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
