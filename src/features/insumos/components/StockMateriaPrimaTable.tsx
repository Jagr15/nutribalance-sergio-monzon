import React, { useState, useMemo } from 'react';
import { 
  FiTrash2, FiBox, FiChevronDown, FiCalendar, FiClock, FiActivity, 
  FiMapPin, FiSearch, FiTruck, FiFileText, FiChevronLeft, FiChevronRight 
} from "react-icons/fi";
import { format } from 'date-fns';
import type { StockMateriaPrima, Insumo } from '../types';
import type { Proveedor } from '../../proveedores/types';

interface Props {
  data: StockMateriaPrima[];
  insumos: Insumo[];
  proveedores: Proveedor[];
  onDelete: (uid: string) => void;
}

const StockMateriaPrimaTable: React.FC<Props> = ({ data = [], insumos, proveedores, onDelete }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const truncate = (str: string, n: number) => {
    return (str?.length > n) ? str.substr(0, n - 1) + "..." : str;
  };

  // Filtrado Global Slim
  const filteredData = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return source.filter(item => {
      const search = searchTerm.toLowerCase();
      const prov = proveedores.find(p => p.uid === item.id_proveedor)?.nombre_empresa || '';
      const insu = insumos.find(i => i.uid === item.id_insumo)?.nombre || '';
      const lote = (item.lote || item.lote || "").toLowerCase();

      return lote.includes(search) || 
             prov.toLowerCase().includes(search) || 
             insu.toLowerCase().includes(search);
    });
  }, [data, insumos, proveedores, searchTerm]);
  console.log(filteredData)
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-3">
      {/* BUSCADOR MINIMALISTA */}
      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
        <input 
          type="text"
          placeholder="Buscar lote, insumo o proveedor..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="w-full bg-[#0f1722] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[11px] text-white outline-none focus:border-blue-500/50 transition-all shadow-lg font-medium"
        />
      </div>

      <div className="bg-[#0f1722] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="text-gray-500 text-[9px] uppercase tracking-[0.15em] bg-white/[0.02] border-b border-white/5">
                <th className="px-5 py-3 font-black w-[25%]">Lote / Proveedor</th>
                <th className="px-4 py-3 font-black w-[30%]">Estado de Consumo</th>
                <th className="px-4 py-3 font-black w-[15%] text-center">Ubicación</th>
                <th className="px-4 py-3 font-black w-[18%] text-right">Existencias</th>
                <th className="px-5 py-3 font-black w-[12%] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedData.map((lote) => {
                const isExpanded = expandedId === lote.uid;
                
                // Cruce de datos para obtener el Insumo y su unidad
                const insu = insumos.find(i => i.uid === lote.id_insumo);
                const unidad = insu?.unidad_medida || 'KG';
                const insuNombre = insu?.nombre || "---";
                const provNombre = proveedores.find(p => p.uid === lote.id_proveedor)?.nombre_empresa || "---";

                // Cálculos de Stock
                const porcentajeFisico = (lote.cantidad_actual / lote.cantidad_inicial) * 100;
                const comprometido = lote.cantidad_comprometida || 0;
                const porcentajeComprometido = (comprometido / lote.cantidad_inicial) * 100;
                const dispReal = lote.cantidad_actual - comprometido;

                return (
                  <React.Fragment key={lote.uid}>
                    <tr 
                      onClick={() => setExpandedId(isExpanded ? null : lote.uid)}
                      className={`group hover:bg-white/[0.01] transition-colors cursor-pointer ${isExpanded ? 'bg-blue-500/[0.04]' : ''}`}
                    >
                      {/* Lote / Proveedor */}
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <FiChevronDown size={12} className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180 text-blue-500' : ''}`} />
                          <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-white truncate uppercase tracking-tight">{lote.lote || lote.lote}</p>
                            <p className="text-[8px] text-gray-500 font-bold uppercase truncate">{provNombre}</p>
                          </div>
                        </div>
                      </td>

                      {/* Estado de Consumo con Doble Barra */}
                      <td className="px-4 py-2.5">
                        <div className="space-y-1.5 relative group/tooltip">
                          <div className="flex justify-between items-center text-[8px] font-black uppercase">
                            <span className="text-blue-400 flex items-center gap-1">
                              <FiBox size={10}/> {truncate(insuNombre, 18)}
                            </span>
                            <div className="flex gap-2">
                              <span className={porcentajeFisico < 20 ? 'text-red-500' : 'text-blue-500'}>
                                {porcentajeFisico.toFixed(0)}% FÍSICO
                              </span>
                            </div>
                          </div>

                          {/* Contenedor de Barras */}
                          <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            {/* Barra Físico */}
                            <div 
                              className={`absolute h-full transition-all duration-700 ${porcentajeFisico < 20 ? 'bg-red-500/30' : 'bg-blue-500/20'}`} 
                              style={{ width: `${porcentajeFisico}%` }} 
                            />
                            {/* Barra Comprometida */}
                            {comprometido > 0 && (
                              <div 
                                className="absolute h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)] transition-all duration-700"
                                style={{ width: `${porcentajeComprometido}%` }}
                              />
                            )}
                          </div>

                          <div className="flex justify-between text-[7px] font-black uppercase tracking-tighter">
                            <span className="text-gray-600">Disponibilidad Real:</span>
                            <span className={dispReal < (lote.cantidad_inicial * 0.1) ? 'text-orange-400' : 'text-white'}>
                              {dispReal.toLocaleString()} {unidad}
                            </span>
                          </div>

                          {/* Tooltip Detalle Reserva */}
                          {lote.stock_transito && (
                            <div className="absolute hidden group-hover/tooltip:block z-50 bg-[#1a222c] border border-orange-500/30 p-2 rounded-lg shadow-2xl -top-12 left-0 min-w-[140px]">
                              <p className="text-[7px] text-orange-400 font-black uppercase flex items-center gap-1 mb-1">
                                <FiTruck size={8}/> Stock Reservado
                              </p>
                              <p className="text-[9px] text-white font-bold">{lote.stock_transito.nro_operacion}</p>
                              <p className="text-[8px] text-gray-400">Cant: {lote.stock_transito.cantidad.toLocaleString()} {unidad}</p>
                            </div>
                          )}
                        </div>
                      </td>

                    {/* Ubicación y Fecha */}
<td className="px-4 py-2.5 text-center">
  <div className="flex flex-col items-center gap-1">
    {/* Convertimos Date a String para evitar el error */}
    <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">
  Ingreso: {lote.fecha_ingreso 
    ? new Date(lote.fecha_ingreso).toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        timeZone: 'UTC' // <--- ESTO EVITA QUE RESTE LAS 5 HORAS
      }) 
    : '---'}
</span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/5 border border-blue-500/10 text-blue-400/80 text-[9px] font-black uppercase">
      <FiMapPin size={10} /> {lote.ubicacion}
    </span>
  </div>
</td>

                      {/* Cantidades con Unidad */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex flex-col leading-tight">
                          <span className="text-[11px] text-white font-mono font-bold italic">
                            {lote.cantidad_actual?.toLocaleString()} <span className="text-[9px] text-blue-500/50">{unidad}</span>
                          </span>
                          <span className="text-[8px] text-gray-600 font-bold uppercase">
                            Inicial: {lote.cantidad_inicial?.toLocaleString()} {unidad}
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-2.5 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(lote.uid); }}
                          className="p-1.5 hover:bg-red-500/20 text-gray-700 hover:text-red-400 rounded-lg transition-all"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </td>
                    </tr>

                    {/* DETALLE EXPANDIDO */}
                    {isExpanded && (
                      <tr className="bg-white/[0.01]">
                        <td colSpan={5} className="px-12 py-6 border-l-2 border-blue-500/30">
                          <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-4">
                              <h4 className="text-[8px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <FiFileText /> Información Económica
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                                  <p className="text-[7px] text-gray-500 uppercase font-bold mb-1">Costo Total</p>
                                  <p className="text-[11px] text-emerald-500 font-black tracking-tight">
                                    S/ {lote.costo_total?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </p>
                                </div>
                                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                                  <p className="text-[7px] text-gray-500 uppercase font-bold mb-1">Por {unidad}</p>
                                  <p className="text-[11px] text-white font-bold tracking-tight">
                                    S/ {lote.costo_unitario?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </p>
                                </div>
                                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 group/doc hover:border-blue-500/30 transition-all">
  <p className="text-[7px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
    <FiFileText size={8} className="text-blue-500" /> Documento Ref.
  </p>
  <p className="text-[11px] text-white font-bold tracking-tight uppercase group-hover/doc:text-blue-400 transition-colors">
    {lote.remito_nro || "SIN NÚMERO"}
  </p>
</div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-[8px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <FiActivity /> Último Movimiento
                              </h4>
                              {lote.operaciones ? (
                                <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                                  <div>
                                    <p className="text-[9px] text-white font-black uppercase">{lote.operaciones.operacion}</p>
                                    <p className="text-[8px] text-gray-500">{lote.operaciones.destino}</p>
                                  </div>
                                  <span className="text-[10px] text-blue-400 font-black italic">
                                    -{lote.operaciones.cantidad.toLocaleString()} {unidad}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-[9px] text-gray-700 italic border border-dashed border-white/5 p-4 rounded-xl text-center">
                                  Sin salidas registradas
                                </p>
                              )}
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

        {/* PAGINACIÓN */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            {filteredData.length} Lotes • Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-white transition-all">
              <FiChevronLeft size={16} />
            </button>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-white transition-all">
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockMateriaPrimaTable;