import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiSearch, FiDatabase } from "react-icons/fi";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Componentes e Hooks
import SiloTable from '../components/SiloTable';
import SiloModal from '../components/SiloModal';
import { useSilos } from '../hooks/useSilos';
import type { Silo } from '../types/silo';

const MySwal = withReactContent(Swal);

const SiloPage: React.FC = () => {
  // Extraemos lógica y estado del Hook de Silos
  const { silos, isLoading, getAll, remove, loadError } = useSilos();

  // Estados locales de la UI
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSilo, setSelectedSilo] = useState<Silo | undefined>();

  // Carga inicial de datos siguiendo el patrón de insumos
  useEffect(() => {
    getAll();
  }, [getAll]);

  const handleOpenModal = (silo?: Silo) => {
    setSelectedSilo(silo);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSilo(undefined);
  };

  // Confirmación de eliminación con el estilo de la plataforma
  const handleDelete = async (uid: string) => {
    const result = await MySwal.fire({
      title: '¿Desactivar silo?',
      text: "Se marcará como inactivo/no disponible para nuevas operaciones.",
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
          text: 'Ocurrió un error al desactivar el silo.',
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
  const filteredSilos = useMemo(() => {
    return silos.filter(s => 
      (s.nombre ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.descripcion ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, silos]);

  const silosMateriaPrima = useMemo(
    () => silos.filter((silo) => silo.tipo_uso === 'MATERIA_PRIMA'),
    [silos]
  );

  const silosProductoTerminado = useMemo(
    () => silos.filter((silo) => silo.tipo_uso === 'PRODUCTO_TERMINADO'),
    [silos]
  );

  return (
    <main className="main animate-fade-in p-6">
      {/* Header de la Página - Estilo IAWAREPERU */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-blue-500 font-bold mb-2">
            INFRAESTRUCTURA & ALMACÉN
          </p>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Gestión de Silos
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configuración de puntos de almacenamiento para trazabilidad total.</p>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <FiPlus size={20} />
          Nuevo Silo
        </button>
      </header>

      {/* Grid de Resumen Rápido */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
            <FiDatabase size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Silos Registrados</p>
            <h4 className="text-xl font-bold text-slate-900">{silos.length}</h4>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
            <FiDatabase size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Materia Prima</p>
            <h4 className="text-xl font-bold text-slate-900">{silosMateriaPrima.length}</h4>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
            <FiDatabase size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Producto Terminado</p>
            <h4 className="text-xl font-bold text-slate-900">{silosProductoTerminado.length}</h4>
          </div>
        </div>
      </section>

      {/* Sección Principal de Datos */}
      <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-slate-900 font-bold text-lg">Catálogo de Ubicaciones</h2>
            <p className="text-gray-500 text-xs">Puntos físicos de recepción de mercadería.</p>
          </div>
          
          <div className="relative">
             <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o descripción..." 
              className="w-full md:w-80 bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-700 focus:border-blue-500/50 outline-none transition-all" 
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

        {/* Estado de Carga Idéntico a Insumos */}
        {isLoading && silos.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <div className="mb-4 flex justify-center">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-xs uppercase tracking-widest font-medium animate-pulse text-blue-400">
              Sincronizando base de datos...
            </p>
          </div>
        ) : (
          <SiloTable 
            data={filteredSilos} 
            onEdit={handleOpenModal} 
            onDelete={handleDelete} 
            emptyMessage={silos.length === 0 ? 'No hay silos activos registrados.' : 'No se encontraron silos para la búsqueda.'}
          />
        )}
      </section>

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <SiloModal 
          silo={selectedSilo} 
          existingSilos={silos}
          onClose={handleCloseModal} 
          onSuccess={getAll} 
        />
      )}
    </main>
  );
};

export default SiloPage;
