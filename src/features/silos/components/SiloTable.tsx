// src/features/silos/components/SiloTable.tsx
import React from 'react';
import { FiEdit2, FiTrash2, FiBox } from "react-icons/fi";
import type { Silo } from '../types/silo';

interface Props {
  data: Silo[];
  onEdit: (silo: Silo) => void;
  onDelete: (uid: string) => void;
}

const SiloTable: React.FC<Props> = ({ data, onEdit, onDelete }) => {
  return (
    <div className="bg-[#0f1722] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-[0.2em] bg-white/[0.01] border-b border-white/5">
            <th className="px-8 py-5 font-bold">Identificación del Silo</th>
            <th className="px-6 py-5 font-bold">Descripción / Ubicación</th>
            <th className="px-8 py-5 font-bold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((silo) => (
            <tr key={silo.uid} className="group hover:bg-white/[0.02] transition-colors">
              <td className="px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    <FiBox size={18} />
                  </div>
                  <span className="text-sm font-bold text-white tracking-tight">{silo.nombre}</span>
                </div>
              </td>
              <td className="px-6 py-5">
                <span className="text-xs text-gray-400 leading-relaxed">{silo.descripcion}</span>
              </td>
              <td className="px-8 py-5 text-right">
                <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(silo)} className="p-2.5 hover:bg-blue-500/10 hover:text-blue-400 rounded-xl text-gray-500 transition-all">
                    <FiEdit2 size={16} />
                  </button>
                  <button onClick={() => onDelete(silo.uid)} className="p-2.5 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-gray-500 transition-all">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-600 text-sm italic">No hay silos registrados en el sistema.</p>
        </div>
      )}
    </div>
  );
};

export default SiloTable;