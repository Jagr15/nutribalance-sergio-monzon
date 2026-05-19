// src/features/insumos/pages/StockMateriaPrimaPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus } from "react-icons/fi";
import { useStockMateriaPrima } from '../hooks';
import StockMateriaPrimaTable from '../components/StockMateriaPrimaTable';
import StockMateriaPrimaModal from '../components/StockMateriaPrimaModal';
import { ApiService } from '../../../infrastructure/api';
import type { Insumo } from '../types';
import type { Proveedor } from '../../proveedores/types';
import Swal from 'sweetalert2';

const StockMateriaPrimaPage: React.FC = () => {
  const { lotes, isLoading, getAll, remove } = useStockMateriaPrima();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm] = useState('');

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
      }
    };
    getAll();
    void loadCatalogos();
  }, [getAll]);

  const handleDelete = async (uid: string) => {
    const result = await Swal.fire({
      title: '¿ELIMINAR INGRESO?',
      text: "Se borrará el registro de stock y su historial inicial.",
      icon: 'warning',
      showCancelButton: true,
      background: '#0d121b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'SÍ, ELIMINAR',
      cancelButtonText: 'CANCELAR'
    });

    if (result.isConfirmed) {
      try {
        await remove(uid);
        Swal.fire({ icon: 'success', title: 'Lote eliminado', background: '#0d121b', color: '#fff', timer: 1500, showConfirmButton: false });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error inesperado';
        Swal.fire({ icon: 'error', title: 'Error', text: message, background: '#0d121b', color: '#fff' });
      }
    }
  };

  const filteredLotes = useMemo(() => {
    return lotes.filter(l => l.lote.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, lotes]);

  return (
    <main className="main animate-fade-in p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-blue-500 font-bold mb-2">OPERACIONES / ALMACÉN</p>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Stock Materia Prima</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <FiPlus size={20} /> Registrar Ingreso
        </button>
      </header>

      <section>
        {/* Loader idéntico a Insumos */}
        {isLoading && lotes.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs uppercase tracking-widest font-medium animate-pulse text-blue-400">Sincronizando inventario...</p>
          </div>
        ) : (
          <StockMateriaPrimaTable data={filteredLotes} insumos={insumos} 
          proveedores={proveedores} onDelete={handleDelete} />
        )}
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
