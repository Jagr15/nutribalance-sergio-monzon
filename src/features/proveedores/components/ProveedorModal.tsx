// src/features/proveedores/components/ProveedorModal.tsx
import React, { useState } from 'react';
import { FiX } from "react-icons/fi";
import { useProveedores } from '../hooks/useProveedores';
import type { Proveedor } from '../types/proveedor';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

interface Props {
  proveedor?: Proveedor;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const ProveedorModal: React.FC<Props> = ({ proveedor, onClose, onSuccess }) => {
  const { create, update, isLoading } = useProveedores();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    nombre_empresa: proveedor?.nombre_empresa || '',
    producto_que_provee: proveedor?.producto_que_provee || '',
    contacto_nombre: proveedor?.contacto_nombre || '',
    telefono: proveedor?.telefono || '',
    email: proveedor?.email || '',
    direccion: proveedor?.direccion || '',
    documento: proveedor?.documento || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;

    setSubmitError(null);
    const normalized = {
      nombre_empresa: form.nombre_empresa.trim().toUpperCase(),
      producto_que_provee: form.producto_que_provee.trim() || null,
      contacto_nombre: form.contacto_nombre.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim().toLowerCase() || null,
      direccion: form.direccion.trim(),
      documento: form.documento.trim() || null,
    };

    if (!normalized.nombre_empresa) return setSubmitError("La empresa es obligatoria.");
    if (!normalized.contacto_nombre) return setSubmitError("El contacto es obligatorio.");
    if (!normalized.telefono) return setSubmitError("El teléfono es obligatorio.");
    if (normalized.email && !EMAIL_REGEX.test(normalized.email)) return setSubmitError("Ingresa un email válido.");
    if (normalized.documento && !CUIT_REGEX.test(normalized.documento)) return setSubmitError("Ingresa un CUIT válido.");

    setIsSubmitting(true);
    try {
      if (proveedor?.uid) {
        await update(proveedor.uid, normalized);
      } else {
        await create(normalized);
      }
      await onSuccess();
      onClose();
    } catch {
      setSubmitError("No se pudo guardar el proveedor. Verifica los datos e intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-slide">
        <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
            {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-slate-900"><FiX size={20} /></button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre de la Empresa</label>
              <input 
                required
                className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
                value={form.nombre_empresa}
                onChange={e => setForm({...form, nombre_empresa: e.target.value})}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Producto que provee</label>
              <input
                className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
                placeholder="Ej: Harina de soja 47%"
                value={form.producto_que_provee}
                onChange={e => setForm({...form, producto_que_provee: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Documento / CUIT</label>
              <input 
                className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
                placeholder="Opcional"
                value={form.documento}
                onChange={e => setForm({...form, documento: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre de Contacto</label>
              <input 
                required
                className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
                value={form.contacto_nombre}
                onChange={e => setForm({...form, contacto_nombre: e.target.value})}
              />
            </div>
            <div className="space-y-1 text-slate-900">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Teléfono</label>
              <input 
                required
                className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
                value={form.telefono}
                onChange={e => setForm({...form, telefono: e.target.value})}
              />
            </div>
            <div className="space-y-1 text-slate-900">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Email</label>
              <input 
                type="email"
                className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
                placeholder="Opcional"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
              />
            </div>
          </div>
          
          <div className="space-y-1 text-slate-900">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Dirección</label>
            <input 
              className="ui-input w-full rounded-xl py-2.5 px-4 text-sm"
              value={form.direccion}
              onChange={e => setForm({...form, direccion: e.target.value})}
            />
          </div>

          <footer className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-slate-900 transition-colors">CANCELAR</button>
            <button
              type="submit" 
              disabled={isLoading || isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
            >
              {(isLoading || isSubmitting) ? 'GUARDANDO...' : (proveedor ? 'ACTUALIZAR' : 'GUARDAR')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ProveedorModal;
