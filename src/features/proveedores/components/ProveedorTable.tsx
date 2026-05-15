// src/features/proveedores/components/ProveedorTable.tsx
import React from 'react';
import { FiEdit2, FiTrash2, FiUser, FiPhone } from "react-icons/fi";
import type { Proveedor } from '../types/proveedor';

interface Props {
  data: Proveedor[];
  onEdit: (p: Proveedor) => void;
  onDelete: (uid: string) => void;
}

const ProveedorTable: React.FC<Props> = ({ data, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-[0.2em] bg-white/[0.01] border-b border-white/5">
            <th className="px-8 py-5 font-bold">Empresa / Documento</th>
            <th className="px-6 py-5 font-bold">Contacto Principal</th>
            <th className="px-6 py-5 font-bold">Teléfono</th>
            <th className="px-8 py-5 font-bold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((p) => (
            <tr key={p.uid} className="group hover:bg-white/[0.02] transition-colors">
              <td className="px-8 py-5">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-200 uppercase">{p.nombre_empresa}</span>
                  <span className="text-[10px] font-mono text-gray-500">{p.documento || 'SIN DOC'}</span>
                </div>
              </td>
              <td className="px-6 py-5 text-gray-400 text-sm">
                <div className="flex items-center gap-2">
                  <FiUser className="text-blue-500/50" size={12} />
                  {p.contacto_nombre}
                </div>
              </td>
              <td className="px-6 py-5 text-gray-400 text-sm">
                <div className="flex items-center gap-2">
                  <FiPhone className="text-green-500/50" size={12} />
                  {p.telefono}
                </div>
              </td>
              <td className="px-8 py-5 text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(p)} className="p-2 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 rounded-lg transition-all">
                    <FiEdit2 size={16} />
                  </button>
                  <button onClick={() => onDelete(p.uid)} className="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg transition-all">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProveedorTable;