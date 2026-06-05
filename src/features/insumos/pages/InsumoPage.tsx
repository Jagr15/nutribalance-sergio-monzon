// src/pages/InsumoPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus } from "react-icons/fi";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Componentes e Hooks

import InsumoTable from '../components/InsumoTable';
import InsumoStats from '../components/InsumoStats';
import InsumoModal from '../components/InsumoModal';

import { useInsumos  } from '../hooks';
import type { Insumo } from '../types/insumo';

const MySwal = withReactContent(Swal);

const InsumoPage: React.FC = () => {
  // Extraemos lógica y estado del Hook
  const { insumos, isLoading, getAll, remove, loadError } = useInsumos();

  // Estados locales de la UI
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | undefined>();

  // Carga inicial de datos
  useEffect(() => {
    getAll();
  }, [getAll]);

  const handleOpenModal = (insumo?: Insumo) => {
    setSelectedInsumo(insumo);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInsumo(undefined);
  };

  const handleDelete = async (uid: string) => {
    const result = await MySwal.fire({
      title: '¿Desactivar insumo?',
      text: "Se marcará como inactivo en el catálogo.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#1f2937',
      confirmButtonText: 'SÍ, DESACTIVAR',
      cancelButtonText: 'CANCELAR',
      background: '#ffffff',
      color: '#0f172a',
      customClass: {
        popup: 'border border-slate-200 rounded-2xl',
        title: 'text-sm font-bold uppercase tracking-widest',
        htmlContainer: 'text-xs text-slate-500',
        confirmButton: 'rounded-xl px-6 py-3 text-xs font-bold',
        cancelButton: 'rounded-xl px-6 py-3 text-xs font-bold'
      }
    });
  
    if (result.isConfirmed) {
      const success = await remove(uid);
      if (success) {
        MySwal.fire({
          title: 'Desactivado',
          icon: 'success',
          background: '#ffffff',
          color: '#0f172a',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'border border-slate-200 rounded-2xl' }
        });
      } else {
        MySwal.fire({
          title: 'No se pudo desactivar',
          text: 'Ocurrió un error al desactivar el insumo.',
          icon: 'error',
          background: '#ffffff',
          color: '#0f172a',
          confirmButtonColor: '#2563eb',
          customClass: { popup: 'border border-slate-200 rounded-2xl' }
        });
      }
    }
  };

  // Filtrado optimizado por búsqueda
  const filteredInsumos = useMemo(() => {
    return insumos.filter(i => 
      (i.nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.categoria ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, insumos]);

  return (
    <main className="main animate-fade-in p-6">
      {/* Header de la Página */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-orange-500 font-bold mb-2">
            GESTIÓN DE INVENTARIO
          </p>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Maestro de Insumos
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configuración técnica de materias primas para procesos.</p>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <FiPlus size={20} />
          Nuevo Insumo
        </button>
      </header>

      {/* Indicadores Dinámicos */}
      <InsumoStats insumos={insumos} />

      {/* Sección Principal de Datos */}
      <section className="mt-8 bg-white border border-slate-200 rounded-3xl ">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-slate-900 font-bold text-lg">Catálogo de Materiales</h2>
            <p className="text-gray-500 text-xs">Visualización detallada de componentes registrados.</p>
          </div>
          
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar por nombre o categoría..." 
              className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm text-slate-700 focus:border-blue-500/50 outline-none transition-all" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loadError ? (
          <div className="mx-6 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

        {/* Tabla de Resultados o Estado de Carga */}
        {isLoading && insumos.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <div className="mb-4 flex justify-center">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-xs uppercase tracking-widest font-medium animate-pulse text-blue-400">
              Sincronizando base de datos...
            </p>
          </div>
        ) : (
          <InsumoTable 
            data={filteredInsumos} 
            onEdit={handleOpenModal} 
            onDelete={handleDelete} 
            emptyMessage={insumos.length === 0 ? 'No hay insumos activos registrados.' : 'No se encontraron insumos para la búsqueda.'}
          />
        )}
      </section>

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <InsumoModal 
          insumo={selectedInsumo} 
          existingInsumos={insumos}
          onClose={handleCloseModal} 
          onSuccess={getAll} // Refresca la lista al guardar con éxito
        />
      )}
    </main>
  );
};

export default InsumoPage;
