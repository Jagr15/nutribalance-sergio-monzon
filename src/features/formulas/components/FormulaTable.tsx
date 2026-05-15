import React, { useState, useMemo, useEffect } from 'react';
import { 
  FiEdit2, FiTrash2, FiFileText, FiCalendar, 
  FiChevronDown, FiChevronUp, FiSearch, FiClock,
  FiChevronLeft, FiChevronRight 
} from "react-icons/fi";
import { format } from 'date-fns';
import type { Formula } from '../types';

interface Props {
  data?: Formula[]; 
  onEdit: (formula: Formula) => void;
  onDelete: (uid: string) => void;
}

const FormulaTable: React.FC<Props> = ({ data = [], onEdit, onDelete }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Forzar el reset de página si los datos cambian (por si vienes de una búsqueda)
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  // 1. FILTRADO (Aseguramos que data sea procesable)
  const filteredData = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    if (searchTerm.trim() === '') return source;

    return source.filter(formula => {
      const search = searchTerm.toLowerCase();
      return (
        formula.nombre_producto?.toLowerCase().includes(search) ||
        formula.author?.toLowerCase().includes(search) ||
        formula.id_usuario?.toLowerCase().includes(search) ||
        (formula.esta_activa ? 'activo' : 'inactivo').includes(search)
      );
    });
  }, [data, searchTerm]); // Importante: data debe estar aquí
 
  // 2. PAGINACIÓN
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setExpandedRow(null); 
    }
  };

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
        <input 
          type="text"
          placeholder="Buscar fórmula, autor o estado..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0f1722] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[11px] text-white outline-none focus:border-blue-500/50 transition-all shadow-lg font-medium"
        />
      </div>

      <div className="bg-[#0f1722] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="text-gray-500 text-[9px] uppercase tracking-[0.15em] bg-white/[0.02] border-b border-white/5">
              <th className="px-5 py-3 font-black w-[30%]">Producto / Versión</th>
              <th className="px-4 py-3 font-black w-[25%]">Author (ID / Nombre)</th>
              <th className="px-4 py-3 font-black w-[15%] text-center">Creado</th>
              <th className="px-4 py-3 font-black w-[15%] text-center">Estado</th>
              <th className="px-5 py-3 font-black w-[15%] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedData.length > 0 ? (
              paginatedData.map((formula) => (
                <React.Fragment key={formula.uid}>
                  <tr 
                    onClick={() => setExpandedRow(expandedRow === formula.uid ? null : formula.uid)}
                    className={`group cursor-pointer transition-colors ${expandedRow === formula.uid ? 'bg-blue-500/[0.04]' : 'hover:bg-white/[0.01]'}`}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                          <FiFileText size={12} />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-bold text-white block truncate uppercase tracking-tight">
                            {formula.nombre_producto}
                          </span>
                          <span className="text-[8px] text-blue-500/70 font-black uppercase tracking-tighter">
                            v{formula.version}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[9px] text-gray-300 font-bold uppercase">{formula.author}</span>
                        <span className="text-[7px] text-gray-600 font-mono tracking-tighter">ID: {formula.id_usuario}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="inline-flex items-center gap-1 text-gray-500">
                        <FiCalendar size={10} />
                        <span className="text-[9px] font-medium">
                          {formula.createdAt ? format(new Date(formula.createdAt), 'dd/MM/yy') : '--/--/--'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded bg-opacity-10 text-[8px] font-black uppercase border ${
                        formula.esta_activa 
                        ? 'bg-emerald-500 text-emerald-500 border-emerald-500/20' 
                        : 'bg-red-500 text-red-400 border-red-500/20'
                      }`}>
                        {formula.esta_activa ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(formula); }} className="p-1.5 hover:bg-blue-500/20 rounded-lg text-gray-700 transition-all">
                          <FiEdit2 size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(formula.uid); }} className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-700 transition-all">
                          <FiTrash2 size={12} />
                        </button>
                        <div className="ml-1 text-gray-800 self-center">
                          {expandedRow === formula.uid ? <FiChevronUp size={12}/> : <FiChevronDown size={12}/>}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {expandedRow === formula.uid && (
                    <tr className="bg-white/[0.01]">
                      <td colSpan={5} className="px-12 py-4 border-l-2 border-blue-500/30">
                        <div className="flex flex-col gap-4">
                          <div>
                            <h4 className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3">Composición de Mezcla</h4>
                            <div className="flex flex-wrap gap-2">
                              {formula.ingredientes?.map((ing) => (
                                <div key={ing.id_insumo} className="bg-black/30 rounded-lg px-3 py-1.5 border border-white/5 flex items-center gap-3">
                                  <span className="text-[9px] text-gray-400 font-bold uppercase">{ing.nombre_insumo}</span>
                                  <div className="h-3 w-[1px] bg-white/10" />
                                  <span className="text-[9px] text-blue-400 font-black">{ing.porcentaje}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 border-t border-white/5 pt-3">
                            <FiClock size={10} />
                            <span className="text-[8px] font-black uppercase">Última Edición:</span>
                            <span className="text-[9px] text-gray-500 font-mono">
                              {formula.ultima_edicion ? format(new Date(formula.ultima_edicion), "dd/MM/yyyy HH:mm") : '---'}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <p className="text-gray-600 text-[9px] uppercase font-black tracking-widest italic">Cargando o sin registros disponibles...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            {filteredData.length} registros • Pág {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="p-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-gray-500 hover:text-white disabled:opacity-20 transition-all">
              <FiChevronLeft size={14} />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => handlePageChange(i + 1)} className={`w-6 h-6 rounded-lg text-[9px] font-black transition-all border ${currentPage === i + 1 ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/5 text-gray-600'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button disabled={currentPage === totalPages || filteredData.length === 0} onClick={() => handlePageChange(currentPage + 1)} className="p-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-gray-500 hover:text-white disabled:opacity-20 transition-all">
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaTable;