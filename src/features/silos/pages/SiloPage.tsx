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
  const { silos, isLoading, getAll, remove } = useSilos();

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
      title: '¿Eliminar silo?',
      text: "Esta acción no se puede revertir y afectará la trazabilidad",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#1f2937',
      confirmButtonText: 'SÍ, ELIMINAR',
      cancelButtonText: 'CANCELAR',
      background: '#0d121b',
      color: '#ffffff',
      customClass: {
        popup: 'border border-white/10 rounded-2xl',
        title: 'text-sm font-bold uppercase tracking-widest',
        htmlContainer: 'text-xs text-gray-400',
        confirmButton: 'rounded-xl px-6 py-3 text-xs font-bold',
        cancelButton: 'rounded-xl px-6 py-3 text-xs font-bold'
      }
    });
  
    if (result.isConfirmed) {
      const success = await remove(uid);
      if (success) {
        MySwal.fire({
          title: 'Eliminado',
          icon: 'success',
          background: '#0d121b',
          color: '#ffffff',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'border border-white/10 rounded-2xl' }
        });
      }
    }
  };

  // Filtrado optimizado por búsqueda
  const filteredSilos = useMemo(() => {
    return silos.filter(s => 
      s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, silos]);

  return (
    <main className="main animate-fade-in p-6">
      {/* Header de la Página - Estilo IAWAREPERU */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-blue-500 font-bold mb-2">
            INFRAESTRUCTURA & ALMACÉN
          </p>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Gestión de Silos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Configuración de puntos de almacenamiento para trazabilidad total.</p>
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
        <div className="bg-[#0d121b] border border-white/5 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
            <FiDatabase size={20} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Silos Registrados</p>
            <h4 className="text-xl font-bold text-white">{silos.length}</h4>
          </div>
        </div>
      </section>

      {/* Sección Principal de Datos */}
      <section className="bg-[#0d121b] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-white font-bold text-lg">Catálogo de Ubicaciones</h2>
            <p className="text-gray-500 text-xs">Puntos físicos de recepción de mercadería.</p>
          </div>
          
          <div className="relative">
             <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o descripción..." 
              className="w-full md:w-80 bg-white/[0.03] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

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
          />
        )}
      </section>

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <SiloModal 
          silo={selectedSilo} 
          onClose={handleCloseModal} 
          onSuccess={getAll} 
        />
      )}
    </main>
  );
};

export default SiloPage;