import React, { useMemo, useState } from 'react';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiFileText, FiMapPin, FiSearch, FiTruck } from 'react-icons/fi';
import type { StockMateriaPrima, Insumo } from '../types';
import type { Proveedor } from '../../proveedores/types';
import {
  DataTable,
  EmptyState,
  StatusBadge,
  TableActionButton,
  TableActions,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '../../../shared/components/table';

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
  const proveedorById = useMemo(
    () => Object.fromEntries((proveedores ?? []).map((p) => [p.uid, p.nombre_empresa])),
    [proveedores]
  );
  const insumoById = useMemo(
    () => Object.fromEntries((insumos ?? []).map((i) => [i.uid, i])),
    [insumos]
  );

  const filteredData = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    const search = searchTerm.toLowerCase();
    return source.filter((item) => {
      const prov = proveedorById[item.id_proveedor] || '';
      const insu = insumoById[item.id_insumo]?.nombre || '';
      const lote = (item.lote || '').toLowerCase();
      return lote.includes(search) || prov.toLowerCase().includes(search) || insu.toLowerCase().includes(search);
    });
  }, [data, insumoById, proveedorById, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          type="text"
          placeholder="Buscar lote, insumo o proveedor..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500/50"
        />
      </div>

      <DataTable minWidthClassName="table-fixed min-w-[1100px]">
        <TableHeader>
          <tr>
            <TableCell header className="w-[25%]">Lote / Proveedor</TableCell>
            <TableCell header className="w-[30%]">Estado de Consumo</TableCell>
            <TableCell header className="w-[15%] text-center">Ubicación</TableCell>
            <TableCell header className="w-[18%] text-right">Existencias</TableCell>
            <TableCell header className="w-[12%] text-right">Acciones</TableCell>
          </tr>
        </TableHeader>
        <TableBody>
          {paginatedData.map((lote) => {
            const isExpanded = expandedId === lote.uid;
            const insu = insumoById[lote.id_insumo];
            const unidad = insu?.unidad_medida || 'KG';
            const insuNombre = insu?.nombre || 'Sin dato';
            const provNombre = proveedorById[lote.id_proveedor] || 'Sin dato';

            const baseCantidad = lote.cantidad_inicial > 0 ? lote.cantidad_inicial : 1;
            const porcentajeFisico = (lote.cantidad_actual / baseCantidad) * 100;
            const comprometido = lote.cantidad_comprometida || 0;
            const porcentajeComprometido = (comprometido / baseCantidad) * 100;
            const dispReal = lote.cantidad_actual - comprometido;
            const umbralCritico = insu?.umbral_alerta || 0;
            const estadoStock = porcentajeFisico <= 20 || dispReal <= umbralCritico ? 'CRÍTICO' : porcentajeFisico <= 40 ? 'BAJO' : 'DISPONIBLE';

            return (
              <React.Fragment key={lote.uid}>
                <TableRow className={isExpanded ? 'bg-slate-50' : 'cursor-pointer'}>
                  <TableCell>
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : lote.uid)} className="flex items-center gap-3 text-left w-full">
                      <FiChevronDown size={12} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-900 truncate uppercase">{lote.lote}</p>
                        <p className="text-xs text-slate-500 truncate uppercase">{provNombre}</p>
                      </div>
                    </button>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1.5 relative group/tooltip">
                      <div className="flex justify-between items-center text-xs font-semibold uppercase">
                        <span className="text-blue-700">{insuNombre}</span>
                        <span className={porcentajeFisico < 20 ? 'text-red-700' : 'text-blue-700'}>{porcentajeFisico.toFixed(0)}% físico</span>
                      </div>
                      <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div className={`absolute h-full ${porcentajeFisico < 20 ? 'bg-red-300' : 'bg-blue-300'}`} style={{ width: `${porcentajeFisico}%` }} />
                        {comprometido > 0 ? <div className="absolute h-full bg-orange-400" style={{ width: `${porcentajeComprometido}%` }} /> : null}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Disponibilidad real</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900">{dispReal.toLocaleString()} {unidad}</span>
                          <StatusBadge value={estadoStock} />
                        </div>
                      </div>
                      {lote.stock_transito ? (
                        <div className="absolute hidden group-hover/tooltip:block z-10 bg-white border border-orange-200 p-2 rounded-lg shadow-sm -top-12 left-0 min-w-[160px]">
                          <p className="text-xs text-orange-700 font-semibold uppercase flex items-center gap-1 mb-1"><FiTruck size={8} /> Stock Reservado</p>
                          <p className="text-xs text-slate-900 font-semibold">{lote.stock_transito.nro_operacion || 'Sin operación'}</p>
                          <p className="text-xs text-slate-500">Cant: {(lote.stock_transito.cantidad || 0).toLocaleString()} {unidad}</p>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-slate-500">Ingreso: {lote.fecha_ingreso ? new Date(lote.fecha_ingreso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : 'Sin dato'}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold uppercase"><FiMapPin size={10} /> {lote.ubicacion}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-slate-900 font-semibold">{lote.cantidad_actual?.toLocaleString()} <span className="text-xs text-slate-500">{unidad}</span></span>
                      <span className="text-xs text-slate-500">Inicial: {lote.cantidad_inicial?.toLocaleString()} {unidad}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <TableActions>
                      <TableActionButton label="Desactivar" tone="danger" onClick={() => onDelete(lote.uid)} />
                    </TableActions>
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-6 py-5 border-l-2 border-blue-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2"><FiFileText size={12} /> Información Económica</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <p className="text-xs text-slate-500 uppercase">Costo Total</p>
                              <p className="text-sm text-emerald-700 font-semibold">ARS {lote.costo_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <p className="text-xs text-slate-500 uppercase">Por {unidad}</p>
                              <p className="text-sm text-slate-900 font-semibold">ARS {lote.costo_unitario?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500 uppercase mb-1">Documento Ref.</p>
                          <p className="text-sm text-slate-900 font-semibold uppercase">{lote.remito_nro || 'SIN NÚMERO'}</p>
                          <p className="text-xs text-slate-500 mt-3">Último movimiento: {lote.operaciones ? `${lote.operaciones.operacion} - ${lote.operaciones.destino}` : 'Sin salidas registradas'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}

          {paginatedData.length === 0 ? (
            <EmptyState
              colSpan={5}
              title="No hay lotes para mostrar"
              message={searchTerm.trim()
                ? 'No se encontraron resultados con el filtro aplicado.'
                : 'Registrá un ingreso de materia prima para comenzar.'}
            />
          ) : null}
        </TableBody>
      </DataTable>

      <div className="px-5 py-3 border border-slate-200 rounded-2xl bg-white shadow-sm flex items-center justify-between">
        <span className="text-xs text-slate-600 font-semibold">{filteredData.length} lotes • Página {currentPage} de {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30"><FiChevronLeft size={16} /></button>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30"><FiChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default StockMateriaPrimaTable;
