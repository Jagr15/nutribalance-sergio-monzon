// src/features/insumos/pages/StockMateriaPrimaPage.tsx
import React, { useState, useEffect } from 'react';
import { FiPlus } from "react-icons/fi";
import { useStockMateriaPrima } from '../hooks';
import StockMateriaPrimaTable from '../components/StockMateriaPrimaTable';
import StockMateriaPrimaModal from '../components/StockMateriaPrimaModal';
import { ApiService } from '../../../infrastructure/api';
import type { Insumo } from '../types';
import type { Proveedor } from '../../proveedores/types';
import Swal from 'sweetalert2';

const StockMateriaPrimaPage: React.FC = () => {
  const { lotes, isLoading, loadError, getAll, remove } = useStockMateriaPrima();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NUEVOS ESTADOS PARA LOS NOMBRES
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  useEffect(() => {
    const loadCatalogos = async () => {
      try {
        const [resI, resP] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.proveedores.getAll()
        ]);
        setInsumos(resI);
        setProveedores(resP);
      } catch (error) {
        console.error("Error cargando catálogos:", error);
        setError("No se pudieron cargar los catálogos de insumos/proveedores.");
      }
    };
    getAll();
    void loadCatalogos();
  }, [getAll]);

  const handleDelete = async (uid: string) => {
    const result = await Swal.fire({
      title: '¿DESACTIVAR LOTE?',
      text: 'Se marcará como inactivo y dejará de estar disponible en listados operativos.',
      icon: 'warning',
      showCancelButton: true,
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'SÍ, DESACTIVAR',
      cancelButtonText: 'CANCELAR'
    });

    if (result.isConfirmed) {
      try {
        await remove(uid);
        Swal.fire({ icon: 'success', title: 'Lote desactivado', background: '#ffffff', color: '#0f172a', timer: 1500, showConfirmButton: false });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error inesperado';
        Swal.fire({ icon: 'error', title: 'Error', text: message, background: '#ffffff', color: '#0f172a' });
      }
    }
  };

  const noData = lotes.length === 0;
  const combinedError = error ?? loadError;

  return (
    <main className="main animate-fade-in p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-blue-500 font-bold mb-2">OPERACIONES / ALMACÉN</p>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Stock Materia Prima</h1>
          <p className="text-sm text-slate-500 mt-2">Inventario de materia prima con alertas automáticas por nivel de stock y umbral crítico.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <FiPlus size={20} /> Registrar Ingreso
        </button>
      </header>

      <section>
        {combinedError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        ) : null}
        {/* Loader idéntico a Insumos */}
        {isLoading && lotes.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs uppercase tracking-widest font-medium animate-pulse text-blue-400">Sincronizando inventario...</p>
          </div>
        ) : (
          <StockMateriaPrimaTable data={lotes} insumos={insumos}
          proveedores={proveedores} onDelete={handleDelete} />
        )}
        {!isLoading && noData ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            No hay lotes activos cargados. Registrá un ingreso para comenzar.
          </div>
        ) : null}
      </section>

      {isModalOpen && (
        <StockMateriaPrimaModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={getAll} 
        />
      )}
    </main>
  );
};

export default StockMateriaPrimaPage;
