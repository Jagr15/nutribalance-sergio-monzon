// src/features/insumos/components/StockMateriaPrimaModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiSave, FiBox, FiTruck, FiMapPin, FiCalendar, FiHash, FiFileText } from "react-icons/fi";
import { useStockMateriaPrima } from '../hooks';
import { ApiService } from '../../../infrastructure/api';
import type { Insumo } from '../types';
import type { Proveedor } from '../../proveedores/types';
import type { Silo } from '../../silos/types';
import { findSiloByName, getMateriaPrimaSilos } from '../../silos/utils/siloFilters';
import { normalizeNumericInputChange, parseNumericInput } from '../../../shared/utils/formatters';
import { resolverCostoIngresoMP } from '../utils/costoIngreso';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const StockMPModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { create, isLoading } = useStockMateriaPrima();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
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
    cantidad: '',
    unidad_entrada: 'KG' as 'KG' | 'TON',
    costo_unitario: '',
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

  const silosMateriaPrima = useMemo(() => getMateriaPrimaSilos(silos), [silos]);
  const selectedInsumo = useMemo(() => insumos.find((insumo) => insumo.uid === formData.id_insumo) ?? null, [formData.id_insumo, insumos]);
  const refCost = useMemo(() => {
    if (!selectedInsumo) return null;
    return selectedInsumo.costo_por_kg ?? selectedInsumo.ref_costo_unitario ?? selectedInsumo.costo ?? null;
  }, [selectedInsumo]);

  const hasNoCostoReferencia = useMemo(() => {
    return selectedInsumo !== null && (refCost === null || refCost <= 0);
  }, [selectedInsumo, refCost]);
  const costoPreview = useMemo(() => {
    const cantidad = parseNumericInput(String(formData.cantidad));
    const costoUnitario = parseNumericInput(String(formData.costo_unitario));

    if (cantidad === null || cantidad <= 0) {
      return null;
    }

    return resolverCostoIngresoMP({
      cantidad,
      unidad_entrada: formData.unidad_entrada,
      costo_unitario: costoUnitario,
      costo_por_kg: selectedInsumo?.costo_por_kg ?? null,
      ref_costo_unitario: selectedInsumo?.ref_costo_unitario ?? null,
      costo: selectedInsumo?.costo ?? null,
    });
  }, [formData.cantidad, formData.costo_unitario, formData.unidad_entrada, selectedInsumo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    if (!formData.id_insumo || !formData.id_proveedor || !formData.ubicacion) {
      setSubmitError('Seleccioná insumo, proveedor y ubicación.');
      return;
    }
    if (!formData.lote.trim()) {
      setSubmitError('El lote es obligatorio.');
      return;
    }
    const cantidad = parseNumericInput(String(formData.cantidad));
    if (cantidad === null || cantidad <= 0) {
      setSubmitError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (hasNoCostoReferencia) {
      setSubmitError('Este insumo no tiene costo de referencia configurado. Configúralo en Maestro de Insumos antes de registrar el ingreso.');
      return;
    }
    const costoUnitarioManual = parseNumericInput(String(formData.costo_unitario));
    if (costoUnitarioManual !== null && costoUnitarioManual < 0) {
      setSubmitError('El costo unitario no puede ser negativo.');
      return;
    }
    const siloSeleccionado = findSiloByName(silos, formData.ubicacion);
    if (!siloSeleccionado) {
      setSubmitError('El silo seleccionado no existe.');
      return;
    }
    if (siloSeleccionado.tipo_uso !== 'MATERIA_PRIMA') {
      setSubmitError('Solo se pueden ingresar materias primas en silos de Materia Prima.');
      return;
    }

    const dataToSave = {
      ...formData,
      lote: formData.lote.trim().toUpperCase(),
      remito_nro: formData.remito_nro.trim(),
      costo_unitario: costoUnitarioManual ?? undefined,
      cantidad_actual: cantidad,
      cantidad_inicial: cantidad,
      cantidad,
    };

    try {
      setIsSubmitting(true);
      await create(dataToSave);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar el ingreso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clases para quitar el scroll/flechas del input number
  const noSpinnerClasses = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const inputStyles = `w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-100 transition-all duration-200 ease-out placeholder:text-gray-600`;
  const labelStyles = "text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2 mb-1.5";

  return (
    <div className="fixed inset-0 bg-white/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-[1.5rem] w-full max-w-4xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
        
        <header className="px-8 py-5 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Ingreso de Materia Prima</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-slate-900 transition-colors duration-200 transition-colors"><FiX size={18} /></button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}
          
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
                  if(formData.nombre_insumo) setFormData({...formData, nombre_insumo: '', id_insumo: '', costo_unitario: ''});
                }}
              />
              {activeDropdown === 'insumo' && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl z-50 max-h-40 overflow-y-auto shadow-xl mt-1">
                  {insumos.filter(i => i.nombre.toLowerCase().includes(searchs.insumo.toLowerCase())).map(i => (
                    <div key={i.uid} onClick={() => {
                      const refCostVal = i.costo_por_kg ?? i.ref_costo_unitario ?? i.costo ?? null;
                      setFormData({
                        ...formData,
                        id_insumo: i.uid,
                        nombre_insumo: i.nombre,
                        costo_unitario: refCostVal !== null ? String(refCostVal) : ''
                      });
                      setActiveDropdown(null);
                    }}
                      className="px-4 py-2 text-[11px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors">{i.nombre}</div>
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
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl z-50 max-h-40 overflow-y-auto shadow-xl mt-1">
                  {proveedores.filter(p => p.nombre_empresa.toLowerCase().includes(searchs.prov.toLowerCase())).map(p => (
                    <div key={p.uid} onClick={() => { setFormData({ ...formData, id_proveedor: p.uid, nombre_prov: p.nombre_empresa }); setActiveDropdown(null); }}
                      className="px-4 py-2 text-[11px] text-slate-600 hover:bg-orange-50 hover:text-orange-600 cursor-pointer transition-colors">{p.nombre_empresa}</div>
                  ))}
                </div>
              )}
            </div>

            {/* UBICACIÓN / SILO */}
            <div className="relative">
              <label className={labelStyles}><FiMapPin className="text-emerald-500" /> Ubicación (Silo)</label>
              <input 
                type="text" className={inputStyles} placeholder="Seleccionar silo de Materia Prima..." 
                value={formData.ubicacion || searchs.silo}
                onFocus={() => setActiveDropdown('silo')}
                readOnly // Para forzar selección de la lista
              />
              {activeDropdown === 'silo' && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl z-50 max-h-40 overflow-y-auto shadow-xl mt-1">
                  {silosMateriaPrima.map(s => (
                    <div key={s.uid} onClick={() => { setFormData({ ...formData, ubicacion: s.nombre }); setActiveDropdown(null); }}
                      className="px-4 py-2 text-[11px] text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer transition-colors">{s.nombre}</div>
                  ))}
                </div>
              )}
              {activeDropdown === 'silo' && silosMateriaPrima.length === 0 ? (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl z-50 shadow-xl mt-1 px-4 py-3 text-xs text-slate-500">
                  No hay silos de Materia Prima disponibles.
                </div>
              ) : null}
            </div>
          </div>

          {/* SECCIÓN 2: DATOS TÉCNICOS */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <div className="space-y-1">
              <label className={labelStyles}><FiHash /> Lote</label>
              <input required className={`${inputStyles} font-mono uppercase`} placeholder="L-2026-X" onChange={e => setFormData({ ...formData, lote: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className={labelStyles}><FiFileText /> Nro Remito</label>
              <input required className={`${inputStyles} font-mono`} placeholder="000-000" onChange={e => setFormData({ ...formData, remito_nro: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className={labelStyles}>Cantidad Ingreso</label>
              <div className={`flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500/50 transition-all duration-200 ease-out`}>
                <input 
                  required type="number" step="any" 
                  className={`w-full bg-transparent px-4 py-2.5 text-xs text-slate-900 outline-none ${noSpinnerClasses}`}
                  placeholder="0.00" 
                  value={formData.cantidad}
                  onChange={e => setFormData({ ...formData, cantidad: normalizeNumericInputChange(e.target.value) })} 
                />
                <select 
                  className="bg-slate-50 text-[10px] font-bold text-blue-600 px-3 border-l border-slate-200 outline-none cursor-pointer"
                  value={formData.unidad_entrada} 
                  onChange={e => setFormData({ ...formData, unidad_entrada: e.target.value as 'KG' | 'TON' })}
                >
                  <option value="KG">KG</option>
                  <option value="TON">TON</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500 px-1">
                {costoPreview ? `Costo estimado: ARS ${costoPreview.costo_total.toFixed(2)} en inventario` : 'Se calculará el costo total según la cantidad y el costo unitario.'}
              </p>
            </div>
            <div className="space-y-1">
              <label className={labelStyles}>
                Costo de referencia{' '}
                <span className="normal-case font-medium text-slate-400">
                  (ARS / {selectedInsumo?.unidad_medida?.toLowerCase() ?? 'kg'})
                </span>
              </label>
              <input
                type="text"
                disabled
                className={`${inputStyles} bg-slate-100 cursor-not-allowed font-mono`}
                placeholder="0.00"
                value={
                  selectedInsumo && refCost !== null
                    ? refCost.toFixed(2)
                    : '0.00'
                }
              />
              {selectedInsumo && !hasNoCostoReferencia ? (
                <p className="text-[11px] text-slate-500 px-1">
                  Costo tomado del insumo: ARS {refCost?.toFixed(2)} / {selectedInsumo.unidad_medida?.toLowerCase() ?? 'kg'}
                </p>
              ) : null}
              {hasNoCostoReferencia && (
                <p className="text-[11px] text-red-500 font-bold px-1">
                  Este insumo no tiene costo de referencia configurado. Configúralo en Maestro de Insumos antes de registrar el ingreso.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelStyles}><FiCalendar /> Fecha Ingreso</label>
              <input type="date" className={`${inputStyles} [color-scheme:light]`} value={formData.fecha_ingreso} onChange={e => setFormData({ ...formData, fecha_ingreso: e.target.value })} />
            </div>
          </div>

          <footer className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-500 transition-all duration-200 ease-out">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading || isSubmitting || hasNoCostoReferencia} className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all duration-200 ease-out disabled:opacity-30">
              <FiSave size={14} /> {isLoading || isSubmitting ? 'Procesando Registro...' : 'Confirmar Ingreso a Almacén'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default StockMPModal;
