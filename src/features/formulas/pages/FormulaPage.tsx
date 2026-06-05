import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiFileText, FiSearch } from "react-icons/fi";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Componentes e Hooks
import FormulaTable from '../components/FormulaTable';
import FormulaModal from '../components/FormulaModal';
import { useFormulas } from '../hooks';
import type { Formula } from '../types';
import { usePermissions } from '../../auth/usePermissions';

const MySwal = withReactContent(Swal);

const FormulaPage: React.FC = () => {
  const { formulas, isLoading, loadError, getAll, remove } = useFormulas();
  const { canAccess } = usePermissions();
  const canCreateFormula = canAccess('formulas', 'create_formula');
  const canEditFormula = canAccess('formulas', 'edit_formula');
  const canDeleteFormula = canAccess('formulas', 'delete');

  // Estados locales de la UI
  const [searchTerm, setSearchTerm] = useState('');
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
      background: '#ffffff',
      color: '#0f172a'
    });

    if (result.isConfirmed) {
      try {
        const success = await remove(uid);
        if (success) {
          MySwal.fire({
            title: 'Desactivada',
            text: 'La fórmula ha sido marcada como inactiva.',
            icon: 'success',
            background: '#ffffff',
            color: '#0f172a'
          });
        }
      } catch (error: unknown) {
        MySwal.fire({
          title: 'Error',
          text: error instanceof Error ? error.message : 'No se pudo desactivar la fórmula.',
          icon: 'error',
          background: '#ffffff',
          color: '#0f172a'
        });
      }
    }
  };

  // Filtro de búsqueda por nombre de producto
  const filteredFormulas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return formulas;
    return formulas.filter(f => 
      f.nombre_producto.toLowerCase().includes(q) ||
      (f.author ?? '').toLowerCase().includes(q) ||
      (f.esta_activa ? 'activo' : 'inactivo').includes(q)
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Fórmulas</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-1">
              Recetas y Composición Porcentual
            </p>
          </div>
        </div>

        {canCreateFormula ? (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <FiPlus size={16} /> Nueva Fórmula
          </button>
        ) : null}
      </header>
      <div className="relative max-w-md">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          type="text"
          placeholder="Buscar por nombre, autor o estado..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500/50"
        />
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

     

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
          enableSearch={false}
          canEdit={canEditFormula}
          canDelete={canDeleteFormula}
          emptyMessage={formulas.length === 0
            ? 'Todavía no hay fórmulas cargadas.'
            : 'No hay resultados para la búsqueda aplicada.'}
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
