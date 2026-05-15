// src/pages/ProveedorPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiSearch } from "react-icons/fi";
import { useProveedores } from '../hooks/useProveedores';
import ProveedorTable from '../components/ProveedorTable';
import ProveedorModal from '../components/ProveedorModal';
import type { Proveedor } from '../types/proveedor'; // Importamos la interface
import Swal from 'sweetalert2';

const ProveedorPage: React.FC = () => {
  const { proveedores, isLoading, getAll, remove } = useProveedores();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Tipamos el estado correctamente en lugar de 'any'
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | undefined>(undefined);

  useEffect(() => { 
    getAll(); 
  }, [getAll]);

  // Corregido para usar nombre_empresa y documento (interfaz actualizada)
  const filtered = useMemo(() => {
    return proveedores.filter(p => 
      p.nombre_empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.documento && p.documento.includes(searchTerm))
    );
  }, [proveedores, searchTerm]);

  const handleDelete = async (uid: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar proveedor?',
      text: "Se marcará como inactivo en el sistema",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#1f2937',
      confirmButtonText: 'SÍ, ELIMINAR',
      cancelButtonText: 'CANCELAR',
      background: '#0d121b',
      color: '#fff',
      customClass: {
        popup: 'border border-white/10 rounded-2xl',
      }
    });

    if (result.isConfirmed) {
      const success = await remove(uid);
      if (success) {
        Swal.fire({ 
          title: 'Eliminado', 
          icon: 'success', 
          background: '#0d121b', 
          color: '#fff', 
          timer: 1500, 
          showConfirmButton: false,
          customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
      }
    }
  };

  const handleEdit = (p: Proveedor) => {
    setSelectedProveedor(p);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedProveedor(undefined);
    setIsModalOpen(true);
  };

  return (
    <main className="p-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-blue-500 font-bold mb-2">
            GESTIÓN COMERCIAL
          </p>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Directorio de Proveedores
          </h1>
          <p className="text-gray-400 text-sm mt-1">Administra la base de datos de empresas y contactos.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <FiPlus size={20} /> Nuevo Proveedor
        </button>
      </header>

      <section className="bg-[#0d121b] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por Empresa o Documento..." 
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Estado de carga manejado en la Page */}
        {isLoading && proveedores.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Cargando directorio...</p>
          </div>
        ) : (
          <ProveedorTable 
            data={filtered} 
            onEdit={handleEdit} 
            onDelete={handleDelete} 
          />
        )}
      </section>

      {isModalOpen && (
        <ProveedorModal 
          proveedor={selectedProveedor} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={getAll}
        />
      )}
    </main>
  );
};

export default ProveedorPage;