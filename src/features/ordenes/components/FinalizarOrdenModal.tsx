import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  FiX, FiActivity, FiLayers, FiCheck, 
  FiArrowRight, FiSearch, FiDatabase 
} from "react-icons/fi";
import type { OrdenProduccion } from '../types/orden';
import { ApiService } from '../../../infrastructure/api';
import type { Silo } from '../../silos/types';
import { getProductoTerminadoSilos, findSiloByName } from '../../silos/utils/siloFilters';
import { parseNumericInput } from '../../../shared/utils/formatters';
import {
  buildFinalizationStockCheck,
  type FinalizationStockCheckResult,
  type StockLoteForFlow,
} from '../utils/productionFlow';

interface Props {
  orden: OrdenProduccion;
  onClose: () => void;
  onConfirm: (data: { 
    lote_salida: string; 
    merma: number; 
    cantidad_real: number;
    destino_silo: string;
  }) => void;
}

const FinalizarOrdenModal: React.FC<Props> = ({ orden, onClose, onConfirm }) => {
  const [merma, setMerma] = useState<string>('');
  const [cantidadReal, setCantidadReal] = useState<string>(orden.cantidad_real ? String(orden.cantidad_real) : String(orden.cantidad_objetivo ?? ''));
  const [destinoSilo, setDestinoSilo] = useState("");
  const [silos, setSilos] = useState<Silo[]>([]);
  const [stockLotes, setStockLotes] = useState<StockLoteForFlow[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loteSalida = `${orden.lote}-PT`;

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) return error.message;
    if (error && typeof error === 'object') {
      const candidate = error as { message?: string; details?: string; hint?: string };
      return [candidate.message, candidate.details, candidate.hint].filter(Boolean).join(' | ') || fallback;
    }
    return fallback;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [silosData, lotesData] = await Promise.all([
          ApiService.silos.getAll(),
          ApiService.stockMP.getAllLotes(),
        ]);
        if (import.meta.env.DEV) {
          console.table(
            orden.detalle_insumos.map((item) => ({
              id_lote: item.id_lote,
              id_insumo: item.id_insumo,
              nombre_insumo: item.nombre_insumo,
              cantidad_usada: item.cantidad_usada,
            }))
          );
          console.table(
            lotesData.map((lote) => ({
              id: lote.uid,
              legacy_uid: lote.uid,
              insumo_id: lote.insumo_id,
              id_insumo: lote.id_insumo,
              insumo_legacy_uid: lote.id_insumo,
              nombre_insumo: lote.nombre_insumo ?? '',
              cantidad_actual: lote.cantidad_actual,
              cantidad_comprometida: lote.cantidad_comprometida ?? 0,
            }))
          );
        }
        setSilos(silosData);
        setStockLotes(
          lotesData.map((lote) => ({
            id: lote.uid,
            legacy_uid: lote.uid,
            lote: lote.lote,
            insumo_id: lote.insumo_id,
            insumo_legacy_uid: lote.id_insumo,
            insumo_nombre: lote.nombre_insumo ?? lote.id_insumo,
            fecha_ingreso: lote.fecha_ingreso.toISOString(),
            cantidad_actual: lote.cantidad_actual,
            cantidad_comprometida: lote.cantidad_comprometida,
            costo_unitario: lote.costo_unitario,
          }))
        );
      } catch (error) {
        console.error('Error cargando selectores de finalización:', error);
      } finally {
        setIsStockLoading(false);
      }
    };
    void load();
  }, [orden.detalle_insumos]);

  const stockCheck = useMemo<FinalizationStockCheckResult | null>(() => {
    if (!orden.detalle_insumos || orden.detalle_insumos.length === 0 || stockLotes.length === 0) {
      return null;
    }

    return buildFinalizationStockCheck(
      orden.cantidad_objetivo,
      parseNumericInput(cantidadReal) ?? orden.cantidad_objetivo,
      orden.detalle_insumos,
      stockLotes
    );
  }, [cantidadReal, orden.cantidad_objetivo, orden.detalle_insumos, stockLotes]);

  const silosProductoTerminado = useMemo(() => getProductoTerminadoSilos(silos), [silos]);

  const handleConfirm = () => {
    if (isSubmitting) return;
    setSubmitError(null);
    const loteNormalizado = loteSalida.trim().toUpperCase();
    if (!loteNormalizado) {
      setSubmitError('El lote de salida es obligatorio.');
      return;
    }
    if (!destinoSilo) {
      setSubmitError('Debes seleccionar un silo de destino.');
      return;
    }
    const siloSeleccionado = findSiloByName(silos, destinoSilo);
    if (!siloSeleccionado) {
      setSubmitError('El silo de destino seleccionado no existe.');
      return;
    }
    if (siloSeleccionado.tipo_uso !== 'PRODUCTO_TERMINADO') {
      setSubmitError('Solo se puede finalizar la orden en silos de Producto Terminado.');
      return;
    }
    const cantidadRealValue = parseNumericInput(cantidadReal);
    const mermaValue = parseNumericInput(merma) ?? 0;
    if (cantidadRealValue === null || cantidadRealValue <= 0) {
      setSubmitError('La cantidad real debe ser mayor a 0.');
      return;
    }
    if (mermaValue < 0) {
      setSubmitError('La merma no puede ser negativa.');
      return;
    }
    if (mermaValue > orden.cantidad_objetivo) {
      setSubmitError('La merma no puede superar la cantidad planificada.');
      return;
    }
    if (isStockLoading) {
      setSubmitError('Validando stock disponible, por favor espera un momento.');
      return;
    }
    if (stockCheck && !stockCheck.stockSuficiente) {
      setSubmitError(stockCheck.mensaje || 'No puedes finalizar esta orden porque faltan insumos para producirla.');
      return;
    }
    setIsSubmitting(true);
    Promise.resolve(onConfirm({
      lote_salida: loteNormalizado,
      merma: mermaValue,
      cantidad_real: cantidadRealValue,
      destino_silo: destinoSilo
    }))
      .catch((error: unknown) => {
        setSubmitError(getErrorMessage(error, 'No se pudo finalizar la orden.'));
      })
      .finally(() => setIsSubmitting(false));
  };

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <div className="bg-white border border-slate-200 w-full max-w-[420px] rounded-[2rem] shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* HEADER SLIM */}
        <header className="px-8 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-0.5">Cierre de Producción</p>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight italic uppercase">{orden.lote}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-gray-600 transition-all duration-200 ease-out active:scale-95">
            <FiX size={18}/>
          </button>
        </header>

        <div className="p-8 space-y-5">
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          {stockCheck && !stockCheck.stockSuficiente ? (
            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-red-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Insumo</th>
                      <th className="px-3 py-2 text-right">Disponible</th>
                      <th className="px-3 py-2 text-right">Requerido</th>
                      <th className="px-3 py-2 text-right">Faltante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {stockCheck.faltantes.map((row) => (
                      <tr key={`${row.id_lote}-${row.nombre_insumo}`}>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.nombre_insumo}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{row.disponible.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg</td>
                        <td className="px-3 py-2 text-right text-slate-700">{row.requerida.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-700">{row.faltante.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                to="/stock-materia-prima"
                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Ver stock de materia prima
              </Link>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Producto / Fórmula</p>
            <p className="font-semibold text-slate-900">{orden.nombre_producto || 'Sin dato'}</p>
            <p className="text-slate-600">
              Versión de fórmula: <strong>{typeof orden.version_formula === 'number' ? `v${orden.version_formula}` : 'Sin dato'}</strong>
            </p>
          </div>
          
          {/* LOTE DE SALIDA */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase ml-1 tracking-[0.2em] flex items-center gap-2">
              <FiLayers size={10} className="text-blue-500"/> ID Lote de Salida (PT)
            </label>
            <input 
              type="text"
              readOnly
              value={loteSalida}
              className="ui-input w-full rounded-xl py-2.5 px-4 text-[13px] text-slate-900 font-bold outline-none bg-slate-50"
            />
            <p className="text-[10px] text-slate-500 ml-1">Se deriva automáticamente del número de OP.</p>
          </div>

          {/* DESTINO (SILO) - BUSCADOR SLIM */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase ml-1 tracking-[0.2em] flex items-center gap-2">
              <FiDatabase size={10} className="text-orange-500"/> Destino / Almacenamiento (Silo)
            </label>
            <div className="relative group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-500 transition-colors" size={12}/>
              <select
                value={destinoSilo}
                onChange={(e) => setDestinoSilo(e.target.value)}
                className="ui-input w-full rounded-xl py-2.5 pl-10 pr-4 text-[13px] text-slate-700 font-bold outline-none focus:border-orange-500/30 transition-all duration-200 ease-out"
              >
                <option value="">Seleccionar silo de destino</option>
                {silosProductoTerminado.map((silo) => (
                  <option key={silo.uid} value={silo.nombre}>
                    {silo.nombre}
                  </option>
                ))}
              </select>
            </div>
            {silos.length === 0 ? <p className="text-xs text-amber-300">No hay silos cargados. Creá uno en el módulo Silos antes de finalizar.</p> : null}
            {silos.length > 0 && silosProductoTerminado.length === 0 ? (
              <p className="text-xs text-amber-300">No hay silos de Producto Terminado disponibles. Creá uno en el módulo Silos antes de finalizar.</p>
            ) : null}
          </div>

          {/* GRID: CANTIDAD REAL Y MERMA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase ml-1 tracking-[0.2em] flex items-center gap-2">
                <FiActivity size={10} className="text-emerald-500"/> Cantidad Real (KG)
              </label>
              <input 
                type="number"
                value={cantidadReal}
                onChange={(e) => setCantidadReal(e.target.value === '' ? '' : e.target.value.replace(/^0+(?=\d)/, ''))}
                onFocus={(e) => e.target.select()}
                className="w-full bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl py-2.5 px-4 text-[13px] text-emerald-600 font-mono font-black outline-none focus:border-emerald-500/30 transition-all duration-200 ease-out [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                <FiActivity size={10} className="text-red-500"/> Merma (KG)
              </label>
              <input 
                type="number"
                value={merma}
                onChange={(e) => setMerma(e.target.value === '' ? '' : e.target.value.replace(/^0+(?=\d)/, ''))}
                onFocus={(e) => e.target.select()}
                className="w-full bg-red-500/[0.02] border border-red-500/10 rounded-xl py-2.5 px-4 text-[13px] text-red-400 font-mono font-black outline-none focus:border-red-500/30 transition-all duration-200 ease-out [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* RESUMEN DE COMPARACIÓN SLIM */}
          <div className="bg-gradient-to-r from-white/[0.02] to-transparent border border-slate-200 rounded-xl p-3 flex justify-between items-center px-5">
             <div className="flex flex-col">
               <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Planificado</span>
               <span className="text-[11px] font-bold text-slate-500 font-mono">{orden.cantidad_objetivo} kg</span>
             </div>
             <FiArrowRight className="text-gray-800" size={14}/>
             <div className="flex flex-col text-right">
               <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">Cantidad Real</span>
               <span className="text-[11px] font-black text-emerald-500 font-mono">{cantidadReal || '0'} kg</span>
             </div>
          </div>
        </div>

        {/* FOOTER ACCIONES SLIM */}
        <footer className="px-8 py-6 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 py-2.5 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:bg-slate-100 rounded-lg transition-all duration-200 ease-out"
          >
            CANCELAR
          </button>
          <button 
            disabled={!loteSalida.trim() || !destinoSilo || isSubmitting || isStockLoading || (stockCheck !== null && !stockCheck.stockSuficiente)}
            onClick={handleConfirm}
            className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-blue-900/20 transition-all duration-200 ease-out disabled:opacity-20 flex items-center justify-center gap-2 tracking-[0.2em] active:scale-95"
          >
            <FiCheck size={14}/> {isSubmitting ? 'FINALIZANDO...' : 'FINALIZAR ORDEN'}
          </button>
        </footer>
        {stockCheck && !stockCheck.stockSuficiente ? (
          <div className="px-8 pb-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                No hay stock suficiente para finalizar esta orden. Revisa materia prima disponible.
              </p>
              <div className="mt-3 space-y-2">
                {stockCheck.faltantes.slice(0, 3).map((item) => (
                  <div key={`${item.id_lote}-${item.lote}`} className="rounded-xl bg-white/80 px-3 py-2 border border-amber-100">
                    <p className="font-medium text-slate-900">{item.nombre_insumo}</p>
                    <p className="text-xs text-slate-600">
                      Lote {item.lote} · Disponible {item.disponible.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg ·
                      Requerido {item.requerida.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg
                    </p>
                  </div>
                ))}
                {stockCheck.faltantes.length > 3 ? (
                  <p className="text-xs text-amber-700">
                    Y {stockCheck.faltantes.length - 3} lote(s) más con faltante.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FinalizarOrdenModal;
