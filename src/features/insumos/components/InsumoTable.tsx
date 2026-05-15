import React from 'react';
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import type { Insumo } from '../types/insumo';

interface Props {
  data: Insumo[];
  onEdit: (i: Insumo) => void;
  onDelete: (uid: string) => void;
}

const InsumoTable: React.FC<Props> = ({ data, onEdit, onDelete }) => {
  return (
    <div className="bg-[#0f1722] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-[10px] uppercase tracking-[0.2em] bg-white/[0.01] border-b border-white/5">
              <th className="px-8 py-5 font-bold">Producto</th>
              <th className="px-6 py-5 font-bold">Categoría</th>
              <th className="px-6 py-5 font-bold text-center">Umbral de Alerta</th>
              <th className="px-8 py-5 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-white/5">
            {data.map((insumo) => (
              <tr key={insumo.uid} className="hover:bg-white/[0.02] transition-colors group">
                {/* Campo: Nombre */}
                <td className="px-8 py-5">
                  <span className="font-bold text-gray-200 block text-[14px]">
                    {insumo.nombre}
                  </span>
                </td>

                {/* Campo: Categoría */}
                <td className="px-6 py-5">
                  <span className="text-[11px] text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                    {insumo.categoria}
                  </span>
                </td>

                {/* Campo: Umbral de Alerta */}
                <td className="px-6 py-5 text-center font-mono text-[14px] text-gray-400">
                  <span className="text-white font-semibold">{insumo.umbral_alerta}</span>
                  <span className="ml-2 text-[10px] text-gray-600 uppercase tracking-tighter">
                    {insumo.unidad_medida}
                  </span>
                </td>

                {/* Acciones */}
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(insumo)}
                      className="p-2.5 hover:bg-blue-500/10 hover:text-blue-400 rounded-xl transition-all text-gray-500"
                      title="Editar"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(insumo.uid)}
                      className="p-2.5 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all text-gray-500"
                      title="Eliminar"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {data.length === 0 && (
          <div className="py-20 text-center border-t border-white/5">
            <p className="text-gray-600 text-sm italic">No hay registros en el maestro de insumos.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsumoTable;