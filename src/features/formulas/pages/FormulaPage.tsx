import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiFileText } from "react-icons/fi";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Componentes e Hooks
import FormulaTable from '../components/FormulaTable';
import FormulaModal from '../components/FormulaModal';
import { useFormulas } from '../hooks';
import type { Formula } from '../types';

const MySwal = withReactContent(Swal);

const FormulaPage: React.FC = () => {
  const { formulas, isLoading, getAll, remove } = useFormulas();

  // Estados locales de la UI
  const [searchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<Formula | undefined>();

  // Carga inicial
  useEffect(() => {
    getAll();
  }, [getAll]);

  const handleOpenModal = (formula?: Formula) => {
    setSelectedFormula(formula);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFormula(undefined);
  };

  const handleDelete = async (uid: string) => {
    const result = await MySwal.fire({
      title: '¿Desactivar fórmula?',
      text: "La fórmula ya no podrá usarse en nuevas órdenes de producción.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      background: '#0d121b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      const success = await remove(uid);
      if (success) {
        MySwal.fire({
          title: 'Desactivada',
          text: 'La fórmula ha sido marcada como inactiva.',
          icon: 'success',
          background: '#0d121b',
          color: '#fff'
        });
      }
    }
  };

  // Filtro de búsqueda por nombre de producto
  const filteredFormulas = useMemo(() => {
    return formulas.filter(f => 
      f.nombre_producto.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [formulas, searchTerm]);

  return (
    <div className="p-8 space-y-8 animate-fadeIn">
      {/* Header de la Página */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner">
            <FiFileText size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Gestión de Fórmulas</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-1">
              Recetas y Composición Porcentual
            </p>
          </div>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <FiPlus size={16} /> Nueva Fórmula
        </button>
      </header>

     

      {/* Tabla de Resultados */}
      {isLoading && formulas.length === 0 ? (
        <div className="py-32 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-blue-400 animate-pulse">
            Cargando recetas...
          </p>
        </div>
      ) : (
        <FormulaTable 
          data={filteredFormulas} 
          onEdit={handleOpenModal} 
          onDelete={handleDelete} 
        />
      )}

      {/* Modal de Creación / Versiones */}
      {isModalOpen && (
        <FormulaModal 
          formula={selectedFormula}
          onClose={handleCloseModal}
          onSuccess={getAll}
        />
      )}
    </div>
  );
};

export default FormulaPage;
