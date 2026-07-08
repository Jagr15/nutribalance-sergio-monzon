import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiZap } from 'react-icons/fi';
import { ROUTES } from '../../../app/config/routes';
import { EstadoOrden, type OrdenProduccion } from '../types/orden';
import type { Formula } from '../../formulas/types';
import { ApiService } from '../../../infrastructure/api';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
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
import { usePermissions } from '../../auth/usePermissions';

interface OrdenTableProps {
  data: OrdenProduccion[];
  onFinalizar?: (orden: OrdenProduccion) => void;
  onIniciar?: (orden: OrdenProduccion) => void;
  onEliminar?: (orden: OrdenProduccion) => void;
  actionOrderId?: string | null;
  hasActiveFilter?: boolean;
}

const OrdenTable: React.FC<OrdenTableProps> = ({ data, onFinalizar, onIniciar, onEliminar, actionOrderId, hasActiveFilter }) => {
  const { canSeeFinancials } = usePermissions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const navigate = useNavigate();
  const itemsPerPage = 6;

  useEffect(() => {
    void ApiService.formulas.findAll().then(setFormulas).catch(() => setFormulas([]));
  }, []);

  const formulaById = useMemo(() => {
    const map = new Map<string, Formula>();
    formulas.forEach((f) => map.set(f.uid, f));
    return map;
  }, [formulas]);

  const getProteinaObjetivo = (orden: OrdenProduccion): string => {
    const formula = formulaById.get(orden.id_formula);
    if (typeof formula?.proteina_calculada_pct === 'number') {
      return `${formula.proteina_calculada_pct.toFixed(2)}%`;
    }
    return 'Sin dato';
  };

  const sortedData = [...data].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const currentData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-3">
      <DataTable minWidthClassName="min-w-[1080px]">
        <TableHeader>
          <tr>
            <TableCell header>Identificación / Producto</TableCell>
            <TableCell header className="text-center">Responsable</TableCell>
            <TableCell header className="text-center">Planificado</TableCell>
            <TableCell header className="text-center">Salida Real</TableCell>
            <TableCell header className="text-center">Stock Disponible</TableCell>
            <TableCell header className="text-center">Programada</TableCell>
            <TableCell header className="text-center">Estado</TableCell>
            <TableCell header className="text-right">Acciones</TableCell>
          </tr>
        </TableHeader>
        <TableBody>
          {currentData.map((orden) => {
            const isExpanded = expandedId === orden.id;
            return (
              <React.Fragment key={orden.id}>
                <TableRow className={isExpanded ? 'bg-slate-50' : 'cursor-pointer'}>
                  <TableCell>
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : orden.id)} className="flex items-center gap-3 text-left w-full">
                      <FiChevronDown size={14} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded">{orden.lote}</span>
                          <span className="text-xs text-slate-500 uppercase">v{orden.version_formula}</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">{orden.nombre_producto}</div>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="text-center text-slate-700">{orden.usuario_responsable}</TableCell>
                  <TableCell className="text-center font-semibold text-slate-700">
                    {orden.cantidad_objetivo.toLocaleString()} <span className="text-xs text-slate-500 uppercase">kg</span>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-emerald-700">
                    {orden.cantidad_real ? `${orden.cantidad_real.toLocaleString()} kg` : '--'}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-slate-700">
                    {(() => {
                      if (orden.estado !== 'FINALIZADO') {
                        return <span className="text-slate-400">—</span>;
                      }
                      if (orden.stock_disponible === undefined || orden.stock_disponible === null) {
                        return <span className="text-slate-400">—</span>;
                      }
                      const stockVal = Number(orden.stock_disponible);
                      if (stockVal <= 0) {
                        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Agotado</span>;
                      }
                      
                      const showBadge = orden.cantidad_real && stockVal < orden.cantidad_real;
                      return (
                        <div className="flex flex-col items-center">
                          <span className={showBadge ? "text-cyan-700 font-bold" : "text-slate-900 font-medium"}>
                            {stockVal.toLocaleString()} kg
                          </span>
                          {showBadge && (
                            <span className="inline-flex items-center rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 mt-0.5">
                              disponibles
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-center text-slate-700">
                    {orden.fecha_programada ? formatDateDDMMYYYY(orden.fecha_programada) : '—'}
                  </TableCell>
                  <TableCell className="text-center"><StatusBadge value={orden.estado} /></TableCell>
                  <TableCell className="text-right">
                    <TableActions>
                      {orden.estado === EstadoOrden.PENDIENTE ? (
                        <>
                          <TableActionButton label={actionOrderId === orden.id ? "Procesando..." : "Iniciar"} tone="primary" disabled={actionOrderId === orden.id} onClick={() => onIniciar?.(orden)} />
                          <TableActionButton label={actionOrderId === orden.id ? "Procesando..." : "Eliminar"} tone="danger" disabled={actionOrderId === orden.id} onClick={() => onEliminar?.(orden)} />
                        </>
                      ) : null}
                      {orden.estado === EstadoOrden.EN_PROCESO && onFinalizar ? (
                        <TableActionButton label={actionOrderId === orden.id ? "Procesando..." : "Finalizar"} tone="success" disabled={actionOrderId === orden.id} onClick={() => onFinalizar(orden)} />
                      ) : null}
                      <TableActionButton label="Trazabilidad" tone="secondary" onClick={() => navigate(ROUTES.TRAZABILIDAD)} />
                      <TableActionButton label="Detalle" tone="secondary" onClick={() => setExpandedId(isExpanded ? null : orden.id)} />
                    </TableActions>
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-6 py-5 border-l-2 border-blue-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold uppercase"><FiZap size={12} /> Trazabilidad de Lotes</div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm text-slate-700">
                            <p>Estado operativo: <strong>{orden.estado}</strong></p>
                            <p>Fecha programada: <strong>{orden.fecha_programada ? formatDateDDMMYYYY(orden.fecha_programada) : 'Sin fecha'}</strong></p>
                            <p>Fecha de creación: <strong>{formatDateDDMMYYYY(orden.fecha_creacion)}</strong></p>
                            <p>Responsable: <strong>{orden.usuario_responsable}</strong></p>
                            <p>Silo destino: <strong>{orden.destino_silo || 'Sin dato'}</strong></p>
                            <p>Proteína objetivo: <strong>{getProteinaObjetivo(orden)}</strong></p>
                            <p>Merma manual: <strong>{orden.merma_manual ? `${orden.merma_manual.toFixed(2)}%` : 'Sin dato'}</strong></p>
                            {canSeeFinancials && <p>Costo estimado: <strong>ARS {orden.costo_total_insumos.toFixed(2)}</strong></p>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-3 py-2 text-left">Insumo</th>
                                <th className="px-3 py-2 text-left">Lote Origen</th>
                                <th className="px-3 py-2 text-right">Cantidad</th>
                                {canSeeFinancials && <th className="px-3 py-2 text-right">Subtotal</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {orden.detalle_insumos && orden.detalle_insumos.length > 0 ? orden.detalle_insumos.map((lote, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-900 font-medium">{lote.nombre_insumo}</td>
                                  <td className="px-3 py-2 text-slate-500">{lote.id_lote}</td>
                                  <td className="px-3 py-2 text-right text-slate-700">{lote.cantidad_usada} {lote.tipo_unidad}</td>
                                  {canSeeFinancials && <td className="px-3 py-2 text-right text-emerald-700 font-semibold">ARS {lote.costo_total.toFixed(2)}</td>}
                                </tr>
                              )) : <tr><td colSpan={canSeeFinancials ? 4 : 3} className="px-3 py-6 text-center text-slate-500">Sin registros de consumo</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}

          {currentData.length === 0 ? (
            <EmptyState
              colSpan={8}
              title="No hay órdenes para mostrar"
              message={data.length === 0
                ? (hasActiveFilter ? "No se encontraron órdenes para la búsqueda aplicada." : "Todavía no hay órdenes cargadas.")
                : "No hay órdenes en la página/filtro actual."}
            />
          ) : null}
        </TableBody>
      </DataTable>

      <div className="px-5 py-3 border border-slate-200 rounded-2xl bg-white shadow-sm flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">Mostrando {currentData.length} de {data.length} registros</p>
        <div className="flex gap-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => prev - 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"><FiChevronLeft size={12} />Anterior</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((prev) => prev + 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30">Siguiente<FiChevronRight size={12} /></button>
        </div>
      </div>
    </div>
  );
};

export default OrdenTable;
