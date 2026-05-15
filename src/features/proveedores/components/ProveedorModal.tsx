// src/features/proveedores/components/ProveedorModal.tsx
import React, { useState } from 'react';
import { FiX } from "react-icons/fi";
import { useProveedores } from '../hooks/useProveedores';
import type { Proveedor } from '../types/proveedor';

interface Props {
  proveedor?: Proveedor;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const ProveedorModal: React.FC<Props> = ({ proveedor, onClose, onSuccess }) => {
  const { create, update, isLoading } = useProveedores();
  const [form, setForm] = useState({
    nombre_empresa: proveedor?.nombre_empresa || '',
    contacto_nombre: proveedor?.contacto_nombre || '',
    telefono: proveedor?.telefono || '',
    email: proveedor?.email || '',
    direccion: proveedor?.direccion || '',
    documento: proveedor?.documento || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proveedor?.uid) {
      await update(proveedor.uid, form);
    } else {
      await create(form);
    }
    await onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d121b] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <header className="px-6 py-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">
            {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={20} /></button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre de la Empresa</label>
              <input 
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:border-blue-500 outline-none"
                value={form.nombre_empresa}
                onChange={e => setForm({...form, nombre_empresa: e.target.value.toUpperCase()})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Documento / CUIT</label>
              <input 
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:border-blue-500 outline-none"
                value={form.documento}
                onChange={e => setForm({...form, documento: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre de Contacto</label>
              <input 
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:border-blue-500 outline-none"
                value={form.contacto_nombre}
                onChange={e => setForm({...form, contacto_nombre: e.target.value})}
              />
            </div>
            <div className="space-y-1 text-white">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Teléfono</label>
              <input 
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-sm outline-none"
                value={form.telefono}
                onChange={e => setForm({...form, telefono: e.target.value})}
              />
            </div>
            <div className="space-y-1 text-white">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Email</label>
              <input 
                required
                type="email"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-sm outline-none"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value.toLowerCase()})}
              />
            </div>
          </div>
          
          <div className="space-y-1 text-white">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Dirección</label>
            <input 
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-sm outline-none"
              value={form.direccion}
              onChange={e => setForm({...form, direccion: e.target.value})}
            />
          </div>

          <footer className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">CANCELAR</button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20"
            >
              {isLoading ? 'GUARDANDO...' : (proveedor ? 'ACTUALIZAR' : 'GUARDAR')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ProveedorModal;