// src/features/ordenes/pages/OrdenPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiPlus, FiSearch, FiActivity } from "react-icons/fi";
import OrdenTable from '../components/OrdenTable';
import OrdenModal from '../components/OrdenModal';
import FinalizarOrdenModal from '../components/FinalizarOrdenModal';
import { useOrdenes } from '../hooks/useOrdenes';
import type { FinalizarOrdenPayload } from '../services/ordenService';
import type { OrdenProduccion } from '../types/orden';
import Swal from 'sweetalert2';
import { usePermissions } from '../../auth/usePermissions';

const OrdenPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ordenAFinalizar, setOrdenAFinalizar] = useState<OrdenProduccion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Extraemos fetchOrdenes para poder refrescar la lista
  const { ordenes, isLoading, error, handleStartProduction, handleDeleteOrder, handleFinishProduction, fetchOrdenes } = useOrdenes();
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const { canAccess } = usePermissions();
  const canCreateOrder = canAccess('ordenes', 'create');
  const canStartOrder = canAccess('ordenes', 'start_order');
  const canFinishOrder = canAccess('ordenes', 'finish_order');
  const canCancelOrder = canAccess('ordenes', 'delete') || canAccess('ordenes', 'cancel_order');

  useEffect(() => {
    if (searchParams.get('crear') !== '1' || !canCreateOrder) return;
    const timer = window.setTimeout(() => {
      setIsModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('crear');
      setSearchParams(next, { replace: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canCreateOrder, searchParams, setSearchParams]);

  const onConfirmFinish = async (data: FinalizarOrdenPayload) => {
    if (!ordenAFinalizar) return;
    setActionOrderId(ordenAFinalizar.id);
    try {
      await handleFinishProduction(ordenAFinalizar.id, data);
      await Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Orden ${ordenAFinalizar.lote} finalizada`,
        timer: 2200,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a',
      });
      setOrdenAFinalizar(null);
    } finally {
      setActionOrderId(null);
    }
  };

  const onStartOrder = async (orden: OrdenProduccion) => {
    setActionOrderId(orden.id);
    try {
      await handleStartProduction(orden.id);
      await Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Orden ${orden.lote} iniciada`,
        timer: 2200,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a',
      });
    } finally {
      setActionOrderId(null);
    }
  };

  const onDeleteOrder = async (orden: OrdenProduccion) => {
    const result = await Swal.fire({
      title: '¿Eliminar orden?',
      text: `Se eliminará ${orden.lote}. Esta acción no se puede revertir. Se validará que no tenga stock registrado.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    setActionOrderId(orden.id);
    try {
      await handleDeleteOrder(orden.id);
      await Swal.fire({
        icon: 'success',
        title: 'Orden eliminada',
        background: '#ffffff',
        color: '#0f172a',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: err instanceof Error ? err.message : 'Error inesperado al eliminar la orden.',
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb',
      });
    } finally {
      setActionOrderId(null);
    }
  };

  const filteredOrdenes = ordenes.filter((orden) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (orden.lote ?? '').toLowerCase().includes(q) ||
      (orden.nombre_producto ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <FiActivity size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Producción en Tiempo Real</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
            Órdenes de <span className="text-blue-500">Producción</span>
          </h1>
        </div>

        {canCreateOrder ? (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-blue-900/20 transition-all active:scale-95"
          >
            <FiPlus size={16}/> Nueva Orden
          </button>
        ) : null}
      </header>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Producción</p>
          <p className="text-sm text-slate-700 mt-1">Seguimiento de lotes activos y cierres.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Inventario</p>
          <p className="text-sm text-slate-700 mt-1">Consumo de insumos y costo por orden.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Estado Operativo</p>
          <p className="text-sm text-slate-700 mt-1">Pendiente, en proceso y finalizada.</p>
        </div>
      </section>

      {/* Buscador Slim */}
      <div className="relative group max-w-md">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Buscar lote o producto..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-700 focus:border-blue-500/50 outline-none transition-all" 
        />
      </div>

      {/* Tabla conectada */}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-slate-200 rounded-[1.5rem]">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cargando registros...</p>
        </div>
      ) : ordenes.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200 rounded-[1.5rem]">
          <p className="text-sm font-bold text-slate-700">Todavía no hay órdenes cargadas</p>
          <p className="text-xs text-gray-500">Creá una orden para iniciar el flujo de producción.</p>
        </div>
      ) : (
        <OrdenTable 
          data={filteredOrdenes}
          onIniciar={canStartOrder ? onStartOrder : undefined}
          onEliminar={canCancelOrder ? onDeleteOrder : undefined}
          onFinalizar={canFinishOrder ? (orden) => setOrdenAFinalizar(orden) : () => undefined}
          actionOrderId={actionOrderId}
          hasActiveFilter={searchTerm.trim().length > 0}
        />
      )}

      {/* MODAL DE CREACIÓN: Pasamos fetchOrdenes a onSuccess */}
      {isModalOpen && canCreateOrder ? (
        <OrdenModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchOrdenes} 
        />
      ) : null}
      
      {ordenAFinalizar && canFinishOrder ? (
        <FinalizarOrdenModal 
          orden={ordenAFinalizar} 
          onClose={() => setOrdenAFinalizar(null)} 
          onConfirm={onConfirmFinish}
        />
      ) : null}
    </div>
  );
};

export default OrdenPage;
