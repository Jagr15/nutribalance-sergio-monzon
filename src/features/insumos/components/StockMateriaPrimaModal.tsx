// src/features/insumos/components/StockMateriaPrimaModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiSave, FiBox, FiTruck, FiMapPin, FiCalendar, FiHash, FiFileText, FiDollarSign } from "react-icons/fi";
import { useStockMateriaPrima } from '../hooks';
import { ApiService } from '../../../infrastructure/api';
import type { Insumo } from '../types';
import type { Proveedor } from '../../proveedores/types';
import type { Silo } from '../../silos/types';
import Swal from 'sweetalert2';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const StockMPModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { create, isLoading } = useStockMateriaPrima();
  
  // Listas para catálogos
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [silos, setSilos] = useState<Silo[]>([]);
  
  // Control de Dropdowns y Búsqueda
  const [activeDropdown, setActiveDropdown] = useState<'insumo' | 'prov' | 'silo' | null>(null);
  const [searchs, setSearchs] = useState({ insumo: '', prov: '', silo: '' });

  const [formData, setFormData] = useState({
    id_insumo: '',
    nombre_insumo: '',
    id_proveedor: '',
    nombre_prov: '',
    ubicacion: '', // Representa el Silo/Almacén
    lote: '',
    remito_nro: '',
    cantidad: 0,
    unidad_entrada: 'KG' as 'KG' | 'TON',
    costo_total: 0,
    costo_unitario:0,
    fecha_ingreso: new Date().toISOString().split('T')[0]
  });

  // CARGA DE DATOS ORIGINALES (Insumos, Proveedores, Silos)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [resI, resP, resS] = await Promise.all([
          ApiService.insumos.getAllInsumos(),
          ApiService.proveedores.getAll(),
          ApiService.silos.getAll()
        ]);
        setInsumos(resI || []);
        setProveedores(resP || []);
        setSilos(resS || []);
      } catch (error) {
        console.error("Error cargando catálogos", error);
      }
    };
    loadData();
  }, []);

  // CÁLCULO DINÁMICO DEL COSTO UNITARIO (ARS por KG)
  const costoUnitarioCalculado = useMemo(() => {
    if (formData.cantidad <= 0 || formData.costo_total <= 0) return 0;
    const cantidadEnKg = formData.unidad_entrada === 'TON' ? formData.cantidad * 1000 : formData.cantidad;
    return formData.costo_total / cantidadEnKg;
  }, [formData.cantidad, formData.costo_total, formData.unidad_entrada]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id_insumo || !formData.id_proveedor || !formData.ubicacion) {
      return Swal.fire({ 
        icon: 'warning', 
        title: 'Faltan selecciones', 
        text: 'Por favor seleccione Insumo, Proveedor y Ubicación.',
        background: '#0d121b', 
        color: '#fff' 
      });
    }

    // Conversión a KG para la base de datos
    const cantidadFinal = formData.unidad_entrada === 'TON' ? formData.cantidad * 1000 : formData.cantidad;

    const dataToSave = {
      ...formData,
      cantidad_actual: cantidadFinal,
      cantidad_inicial: cantidadFinal,
      costo_unitario: costoUnitarioCalculado,
      costo_total: formData.costo_total
    };

    try {
      await create(dataToSave);
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  // Clases para quitar el scroll/flechas del input number
  const noSpinnerClasses = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const inputStyles = `w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600`;
  const labelStyles = "text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#0d121b] border border-white/10 rounded-[1.5rem] w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        <header className="px-8 py-5 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Ingreso de Materia Prima</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><FiX size={18} /></button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* SECCIÓN 1: SELECTORES (Originales) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* INSUMO */}
            <div className="relative">
              <label className={labelStyles}><FiBox className="text-blue-500" /> Insumo</label>
              <input 
                type="text" className={inputStyles} placeholder="Buscar insumo..." 
                value={formData.nombre_insumo || searchs.insumo}
                onFocus={() => setActiveDropdown('insumo')}
                onChange={(e) => {
                  setSearchs({ ...searchs, insumo: e.target.value });
                  if(formData.nombre_insumo) setFormData({...formData, nombre_insumo: '', id_insumo: ''});
                }}
              />
              {activeDropdown === 'insumo' && (
                <div className="absolute top-full left-0 w-full bg-[#161b26] border border-white/10 rounded-xl z-50 max-h-40 overflow-y-auto shadow-2xl mt-1">
                  {insumos.filter(i => i.nombre.toLowerCase().includes(searchs.insumo.toLowerCase())).map(i => (
                    <div key={i.uid} onClick={() => { setFormData({ ...formData, id_insumo: i.uid, nombre_insumo: i.nombre }); setActiveDropdown(null); }}
                      className="px-4 py-2 text-[11px] text-gray-400 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors">{i.nombre}</div>
                  ))}
                </div>
              )}
            </div>

            {/* PROVEEDOR */}
            <div className="relative">
              <label className={labelStyles}><FiTruck className="text-orange-500" /> Proveedor</label>
              <input 
                type="text" className={inputStyles} placeholder="Buscar proveedor..." 
                value={formData.nombre_prov || searchs.prov}
                onFocus={() => setActiveDropdown('prov')}
                onChange={(e) => {
                  setSearchs({ ...searchs, prov: e.target.value });
                  if(formData.nombre_prov) setFormData({...formData, nombre_prov: '', id_proveedor: ''});
                }}
              />
              {activeDropdown === 'prov' && (
                <div className="absolute top-full left-0 w-full bg-[#161b26] border border-white/10 rounded-xl z-50 max-h-40 overflow-y-auto shadow-2xl mt-1">
                  {proveedores.filter(p => p.nombre_empresa.toLowerCase().includes(searchs.prov.toLowerCase())).map(p => (
                    <div key={p.uid} onClick={() => { setFormData({ ...formData, id_proveedor: p.uid, nombre_prov: p.nombre_empresa }); setActiveDropdown(null); }}
                      className="px-4 py-2 text-[11px] text-gray-400 hover:bg-orange-600 hover:text-white cursor-pointer transition-colors">{p.nombre_empresa}</div>
                  ))}
                </div>
              )}
            </div>

            {/* UBICACIÓN / SILO */}
            <div className="relative">
              <label className={labelStyles}><FiMapPin className="text-emerald-500" /> Ubicación (Silo)</label>
              <input 
                type="text" className={inputStyles} placeholder="Seleccionar silo..." 
                value={formData.ubicacion || searchs.silo}
                onFocus={() => setActiveDropdown('silo')}
                readOnly // Para forzar selección de la lista
              />
              {activeDropdown === 'silo' && (
                <div className="absolute top-full left-0 w-full bg-[#161b26] border border-white/10 rounded-xl z-50 max-h-40 overflow-y-auto shadow-2xl mt-1">
                  {silos.map(s => (
                    <div key={s.uid} onClick={() => { setFormData({ ...formData, ubicacion: s.nombre }); setActiveDropdown(null); }}
                      className="px-4 py-2 text-[11px] text-gray-400 hover:bg-emerald-600 hover:text-white cursor-pointer transition-colors">{s.nombre}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: DATOS TÉCNICOS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="space-y-1">
              <label className={labelStyles}><FiHash /> Lote</label>
              <input required className={`${inputStyles} font-mono uppercase`} placeholder="L-2026-X" onChange={e => setFormData({ ...formData, lote: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1">
              <label className={labelStyles}><FiFileText /> Nro Remito</label>
              <input required className={`${inputStyles} font-mono`} placeholder="000-000" onChange={e => setFormData({ ...formData, remito_nro: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className={labelStyles}>Cantidad Ingreso</label>
              <div className={`flex bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500/50 transition-all`}>
                <input 
                  required type="number" step="any" 
                  className={`w-full bg-transparent px-4 py-2.5 text-xs text-white outline-none ${noSpinnerClasses}`}
                  placeholder="0.00" 
                  onChange={e => setFormData({ ...formData, cantidad: Number(e.target.value) })} 
                />
                <select 
                  className="bg-[#161b26] text-[10px] font-bold text-blue-400 px-3 border-l border-white/5 outline-none cursor-pointer"
                  value={formData.unidad_entrada} 
                  onChange={e => setFormData({ ...formData, unidad_entrada: e.target.value as 'KG' | 'TON' })}
                >
                  <option value="KG">KG</option>
                  <option value="TON">TON</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelStyles}><FiCalendar /> Fecha Ingreso</label>
              <input type="date" className={`${inputStyles} [color-scheme:dark]`} value={formData.fecha_ingreso} onChange={e => setFormData({ ...formData, fecha_ingreso: e.target.value })} />
            </div>
          </div>

          {/* SECCIÓN 3: COSTOS DINÁMICOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-emerald-500/[0.03] rounded-2xl border border-emerald-500/10">
            <div className="space-y-1">
              <label className={labelStyles}><FiDollarSign className="text-emerald-500"/> Costo Total de Compra (ARS)</label>
              <div className="relative">
                <input 
                  required type="number" step="any" 
                  className={`${inputStyles} ${noSpinnerClasses} bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-bold pl-8 text-sm`}
                  placeholder="0.00" 
                  onChange={e => setFormData({ ...formData, costo_total: Number(e.target.value) })} 
                />
                <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" size={14} />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelStyles}>Precio Unitario Proyectado</label>
              <div className="h-[42px] flex items-center px-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-sm font-black text-white">
                  ARS {costoUnitarioCalculado.toFixed(2)} 
                  <span className="text-[10px] ml-2 text-emerald-500/50 font-bold uppercase tracking-widest">x kilogramo</span>
                </span>
              </div>
            </div>
          </div>

          <footer className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white/5 hover:bg-red-500/10 hover:text-red-400 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-30">
              <FiSave size={14} /> {isLoading ? 'Procesando Registro...' : 'Confirmar Ingreso a Almacén'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default StockMPModal;
