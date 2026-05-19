import React, { useState } from 'react';
import { 
  FiChevronDown, FiZap, FiTrash2, FiPlay, 
  FiCheckCircle, FiChevronLeft, FiChevronRight 
} from "react-icons/fi";
import { EstadoOrden, type OrdenProduccion } from '../types/orden';

interface OrdenTableProps {
  data: OrdenProduccion[];
  onFinalizar: (orden: OrdenProduccion) => void;
  onIniciar?: (orden: OrdenProduccion) => void;
  onEliminar?: (orden: OrdenProduccion) => void;
}

const OrdenTable: React.FC<OrdenTableProps> = ({ data, onFinalizar, onIniciar, onEliminar }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Lógica de Paginación
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const sortedData = [...data].sort((a, b) => 
  new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()
);
/*
  const currentData = data.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );*/
  const currentData = sortedData.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-[#0d121b] border border-white/5 rounded-[1.5rem] overflow-hidden flex flex-col shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <th className="px-6 py-5">Identificación / Producto</th>
              <th className="px-4 py-5 text-center">Planificado</th>
              <th className="px-4 py-5 text-center">Salida Real</th>
              <th className="px-4 py-5 text-center">Estado</th>
              <th className="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {currentData.map((orden) => {
              const isExpanded = expandedId === orden.id;
              
              return (
                <React.Fragment key={orden.id}>
                  <tr 
                    onClick={() => setExpandedId(isExpanded ? null : orden.id)}
                    className={`group cursor-pointer transition-all ${
                      isExpanded ? 'bg-blue-600/[0.04]' : 'hover:bg-white/[0.01]'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <FiChevronDown 
                          size={14} 
                          className={`text-gray-500 transition-transform duration-300 ${
                            isExpanded ? 'rotate-180 text-blue-500' : ''
                          }`} 
                        />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-black text-blue-400 tracking-tight uppercase bg-blue-500/5 px-1.5 rounded">
                              {orden.lote}
                            </span>
                            <span className="text-[10px] text-gray-600 font-bold italic uppercase">
                              v{orden.version_formula}
                            </span>
                          </div>
                          <div className="text-[13px] font-bold text-gray-200 tracking-tight group-hover:text-white transition-colors">
                            {orden.nombre_producto}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-center font-mono text-[12px] font-bold text-gray-400">
                      {orden.cantidad_objetivo.toLocaleString()} 
                      <small className="text-[9px] opacity-40 font-sans ml-1 uppercase">kg</small>
                    </td>

                    <td className="px-4 py-4 text-center font-mono text-[12px] font-bold text-emerald-500">
                      {orden.cantidad_real ? (
                        <>
                          {orden.cantidad_real.toLocaleString()}
                          <small className="text-[9px] opacity-40 font-sans ml-1 uppercase">kg</small>
                        </>
                      ) : '--'}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${
                        orden.estado === EstadoOrden.FINALIZADO ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                        orden.estado === EstadoOrden.EN_PROCESO ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-300'
                      }`}>
                        {orden.estado}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {orden.estado === 'PENDIENTE' && (
                          <>
                            <button
                              type="button"
                              aria-label={`Iniciar orden ${orden.lote}`}
                              onClick={() => onIniciar?.(orden)}
                              className="p-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                            >
                              <FiPlay size={14}/>
                            </button>
                            <button
                              type="button"
                              aria-label={`Eliminar orden ${orden.lote}`}
                              onClick={() => onEliminar?.(orden)}
                              className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                            >
                              <FiTrash2 size={14}/>
                            </button>
                          </>
                        )}
                        {orden.estado === 'EN PROCESO' && (
                          <button 
                            type="button"
                            aria-label={`Finalizar orden ${orden.lote}`}
                            onClick={() => onFinalizar(orden)}
                            className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
                          >
                            <FiCheckCircle size={14}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* DESGLOSE DETALLADO (Trazabilidad FIFO) */}
                  {isExpanded && (
                    <tr className="bg-black/40 animate-in fade-in duration-300">
                      <td colSpan={5} className="px-12 py-8 border-l-4 border-blue-500/40">
                        <div className="flex flex-col lg:flex-row gap-10">
                          <div className="min-w-[200px] space-y-4">
                            <div className="flex items-center gap-2 text-blue-500">
                              <FiZap size={14}/>
                              <span className="text-[10px] font-black uppercase tracking-widest">Trazabilidad de Lotes</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                               <div className="flex flex-col border-b border-white/5 pb-2">
                                  <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1">Responsable</span>
                                  <span className="text-[11px] text-white font-bold">{orden.usuario_responsable}</span>
                               </div>
                               {orden.destino_silo && (
                                 <div className="flex flex-col border-b border-white/5 pb-2">
                                    <span className="text-[8px] text-orange-500 uppercase font-black tracking-widest mb-1">Destino Final</span>
                                    <span className="text-[11px] text-orange-400 font-bold uppercase">{orden.destino_silo}</span>
                                 </div>
                               )}
                               <div className="flex flex-col">
                                  <span className="text-[8px] text-emerald-500 uppercase font-black tracking-widest mb-1">Inversión Estimada</span>
                                  <span className="text-[14px] text-emerald-400 font-mono font-black">
                                    ARS {orden.costo_total_insumos.toFixed(2)}
                                  </span>
                               </div>
                            </div>
                          </div>

                          <div className="flex-1 overflow-hidden border border-white/5 rounded-2xl bg-black/20">
                            <table className="w-full text-[11px] font-mono">
                              <thead className="bg-white/[0.02] text-[9px] text-gray-500 uppercase font-black border-b border-white/5">
                                <tr>
                                  <th className="px-4 py-3">Insumo</th>
                                  <th className="px-4 py-3">Lote Origen</th>
                                  <th className="px-4 py-3 text-right">Cantidad</th>
                                  <th className="px-4 py-3 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {orden.detalle_insumos && orden.detalle_insumos.length > 0 ? (
                                  orden.detalle_insumos.map((lote, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                      <td className="px-4 py-3 text-gray-200 font-bold">{lote.nombre_insumo}</td>
                                      <td className="px-4 py-3 text-blue-400/60 font-black">{lote.id_lote}</td>
                                      <td className="px-4 py-3 text-right text-gray-300">
                                        {lote.cantidad_usada} <small className="opacity-40 font-sans uppercase">{lote.tipo_unidad}</small>
                                      </td>
                                      <td className="px-4 py-3 text-right text-emerald-500/80 font-bold">
                                        ARS {lote.costo_total.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-700 italic text-[10px] uppercase font-black">
                                      Sin registros de consumo
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER: PAGINACIÓN SLIM */}
      <div className="px-8 py-5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
          Mostrando <span className="text-gray-400">{currentData.length}</span> de <span className="text-gray-400">{data.length}</span> registros
        </p>
        <div className="flex gap-3">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase text-gray-500 hover:bg-white/5 transition-all disabled:opacity-10 active:scale-95"
          >
            <FiChevronLeft size={14}/> Anterior
          </button>
          <button 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase text-gray-500 hover:bg-white/5 transition-all disabled:opacity-10 active:scale-95"
          >
            Siguiente <FiChevronRight size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrdenTable;
