// src/pages/ProveedorPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiSearch } from "react-icons/fi";
import { useProveedores } from '../hooks/useProveedores';
import ProveedorTable from '../components/ProveedorTable';
import ProveedorModal from '../components/ProveedorModal';
import type { Proveedor } from '../types/proveedor'; // Importamos la interface
import Swal from 'sweetalert2';

type EstadoFiltro = 'ACTIVOS' | 'INACTIVOS' | 'TODOS';

const ProveedorPage: React.FC = () => {
  const { proveedores, isLoading, getAll, toggleActive, loadError } = useProveedores();
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('ACTIVOS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Tipamos el estado correctamente en lugar de 'any'
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | undefined>(undefined);

  useEffect(() => { 
    getAll(); 
  }, [getAll]);

  // Corregido para usar nombre_empresa y documento (interfaz actualizada)
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return proveedores.filter(p => {
      const matchesSearch =
        (p.nombre_empresa ?? '').toLowerCase().includes(q) ||
        (p.producto_que_provee ?? '').toLowerCase().includes(q) ||
        (p.documento ?? '').toLowerCase().includes(q) ||
        (p.contacto_nombre ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q);
      const isActive = Boolean(p.esta_activo);
      const matchesEstado =
        estadoFiltro === 'TODOS' ||
        (estadoFiltro === 'ACTIVOS' && isActive) ||
        (estadoFiltro === 'INACTIVOS' && !isActive);
      return matchesSearch && matchesEstado;
    });
  }, [estadoFiltro, proveedores, searchTerm]);

  const handleToggleActive = async (proveedor: Proveedor) => {
    const activar = !Boolean(proveedor.esta_activo);
    const result = await Swal.fire({
      title: activar ? '¿Activar proveedor?' : '¿Desactivar proveedor?',
      text: activar
        ? 'El proveedor volverá a estar disponible en el sistema.'
        : 'Se marcará como inactivo en el sistema',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#1f2937',
      confirmButtonText: activar ? 'SÍ, ACTIVAR' : 'SÍ, DESACTIVAR',
      cancelButtonText: 'CANCELAR',
      background: '#ffffff',
      color: '#0f172a',
      customClass: {
        popup: 'border border-slate-200 rounded-2xl',
      }
    });

    if (result.isConfirmed) {
      try {
        await toggleActive(proveedor.uid, activar);
        Swal.fire({ 
          title: activar ? 'Activado' : 'Desactivado', 
          icon: 'success', 
          background: '#ffffff', 
          color: '#0f172a', 
          timer: 1500, 
          showConfirmButton: false,
          customClass: { popup: 'border border-slate-200 rounded-2xl' }
        });
        await getAll();
      } catch {
        Swal.fire({
          title: activar ? 'No se pudo activar' : 'No se pudo desactivar',
          text: activar
            ? 'Ocurrió un error al activar el proveedor.'
            : 'Ocurrió un error al desactivar el proveedor.',
          icon: 'error',
          background: '#ffffff',
          color: '#0f172a',
          confirmButtonColor: '#2563eb',
          customClass: { popup: 'border border-slate-200 rounded-2xl' }
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
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Directorio de Proveedores
          </h1>
          <p className="text-slate-500 text-sm mt-1">Administra la base de datos de empresas y contactos.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <FiPlus size={20} /> Nuevo Proveedor
        </button>
      </header>

      <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por Empresa, Documento o Producto..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-700 focus:border-blue-500/50 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
            className="w-full md:w-44 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm text-slate-700 focus:border-blue-500/50 outline-none transition-all"
          >
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
            <option value="TODOS">Todos</option>
          </select>
        </div>

        {loadError ? (
          <div className="mx-6 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

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
            onToggleActive={handleToggleActive} 
            emptyMessage={proveedores.length === 0 ? 'No hay proveedores registrados.' : 'No se encontraron proveedores para el filtro y búsqueda aplicados.'}
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
