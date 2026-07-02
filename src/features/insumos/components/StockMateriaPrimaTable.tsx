import React, { useMemo, useState } from 'react';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiFileText, FiMapPin, FiSearch } from 'react-icons/fi';
import type { StockMateriaPrima, StockMateriaPrimaResumen } from '../types';
import type { Proveedor } from '../../proveedores/types';
import { resolveStockMPGroupingKey } from '../utils/stockResumen';
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
  resumen: StockMateriaPrimaResumen[];
  lotes: StockMateriaPrima[];
  proveedores: Proveedor[];
  onDelete: (uid: string) => void;
}

const unitLabel = (value: string) => (value || 'KG').toUpperCase();
const formatMoney = (value: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
}).format(value);

const StockMateriaPrimaTable: React.FC<Props> = ({ resumen = [], lotes = [], proveedores, onDelete }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const proveedorById = useMemo(
    () => Object.fromEntries((proveedores ?? []).map((p) => [p.uid, p.nombre_empresa])),
    [proveedores]
  );

  const resumenByKey = useMemo(() => {
    const map = new Map<string, StockMateriaPrimaResumen>();
    resumen.forEach((item) => {
      map.set(item.insumo_id.trim().toLowerCase(), item);
      map.set(item.nombre_insumo.trim().toLowerCase(), item);
    });
    return map;
  }, [resumen]);

  const lotesByInsumo = useMemo(() => {
    const map = new Map<string, StockMateriaPrima[]>();
    lotes.forEach((lote) => {
      const resolvedSummary = resumenByKey.get((lote.insumo_id ?? '').trim().toLowerCase())
        ?? resumenByKey.get((lote.id_insumo ?? '').trim().toLowerCase())
        ?? resumenByKey.get((lote.nombre_insumo ?? '').trim().toLowerCase());
      const key = resolvedSummary?.insumo_id ?? resolveStockMPGroupingKey(lote, []);
      const current = map.get(key) ?? [];
      current.push(lote);
      map.set(key, current);
    });
    return map;
  }, [lotes, resumenByKey]);

  const filteredData = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return resumen;

    return resumen.filter((item) => {
      const directMatch =
        item.nombre_insumo.toLowerCase().includes(search) ||
        item.unidad.toLowerCase().includes(search) ||
        item.estado.toLowerCase().includes(search) ||
        item.umbral_alerta.toString().includes(search) ||
        item.stock_actual.toString().includes(search) ||
        item.stock_comprometido.toString().includes(search) ||
        item.stock_disponible.toString().includes(search);

      if (directMatch) return true;

      return (lotesByInsumo.get(item.insumo_id) ?? []).some((lote) => {
        const prov = proveedorById[lote.id_proveedor] ?? '';
        return (
          lote.lote.toLowerCase().includes(search) ||
          item.nombre_insumo.toLowerCase().includes(search) ||
          prov.toLowerCase().includes(search) ||
          lote.ubicacion.toLowerCase().includes(search)
        );
      });
    });
  }, [lotesByInsumo, proveedorById, resumen, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          type="text"
          placeholder="Buscar insumo, lote o proveedor..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500/50"
        />
      </div>

      <DataTable minWidthClassName="table-fixed min-w-[1560px]">
        <TableHeader>
          <tr>
            <TableCell header className="w-[22%]">Insumo</TableCell>
            <TableCell header className="w-[12%] text-right">Stock actual</TableCell>
            <TableCell header className="w-[12%] text-right">Comprometido</TableCell>
            <TableCell header className="w-[12%] text-right">Disponible</TableCell>
            <TableCell header className="w-[12%] text-right">Costo promedio</TableCell>
            <TableCell header className="w-[12%] text-right">Valor inventario</TableCell>
            <TableCell header className="w-[8%] text-center">Estado</TableCell>
            <TableCell header className="w-[8%] text-right">Umbral</TableCell>
            <TableCell header className="w-[12%] text-right">Acciones</TableCell>
          </tr>
        </TableHeader>
        <TableBody>
          {paginatedData.map((item, index) => {
            const isExpanded = expandedId === item.insumo_id;
            const detalleLotes = lotesByInsumo.get(item.insumo_id) ?? [];
            const totalLotes = detalleLotes.length;

            return (
              <React.Fragment key={`${item.insumo_id ?? 'insumo'}-${index}`}>
                <TableRow className={isExpanded ? 'bg-slate-50' : 'cursor-pointer'}>
                  <TableCell>
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.insumo_id)} className="flex items-center gap-3 text-left w-full">
                      <FiChevronDown size={12} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-900 truncate uppercase">{item.nombre_insumo}</p>
                        <p className="text-xs text-slate-500 truncate uppercase">{totalLotes} lotes • {unitLabel(item.unidad)}</p>
                      </div>
                    </button>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-slate-900 font-semibold">{item.stock_actual.toLocaleString()} <span className="text-xs text-slate-500">{unitLabel(item.unidad)}</span></span>
                      <span className="text-xs text-slate-500">Suma de lotes activos</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-orange-700 font-semibold">{item.stock_comprometido.toLocaleString()} <span className="text-xs text-slate-500">{unitLabel(item.unidad)}</span></span>
                      <span className="text-xs text-slate-500">Reservado por OP</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-emerald-700 font-semibold">{item.stock_disponible.toLocaleString()} <span className="text-xs text-slate-500">{unitLabel(item.unidad)}</span></span>
                      <span className="text-xs text-slate-500">Actual - comprometido</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-slate-900 font-semibold">{formatMoney(item.costo_promedio_ponderado)}</span>
                      <span className="text-xs text-slate-500">Costo promedio ponderado</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-blue-700 font-semibold">{formatMoney(Number(item.valor_inventario ?? 0))}</span>
                      <span className="text-xs text-slate-500">
                        {item.lotes_sin_costo ? `${item.lotes_sin_costo} lotes sin costo` : 'Valorizado por lotes'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <StatusBadge value={item.estado} />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm text-slate-900 font-semibold">{item.umbral_alerta.toLocaleString()} <span className="text-xs text-slate-500">{unitLabel(item.unidad)}</span></span>
                      <span className="text-xs text-slate-500">Límite configurable</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <TableActions>
                      <TableActionButton
                        label={isExpanded ? 'Ocultar' : 'Ver lotes'}
                        tone="secondary"
                        onClick={() => setExpandedId(isExpanded ? null : item.insumo_id)}
                      />
                    </TableActions>
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <tr className="bg-slate-50">
                    <td colSpan={9} className="px-6 py-5 border-l-2 border-blue-200">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                            <FiFileText size={12} /> Detalle por lote
                          </h4>
                          <p className="text-xs text-slate-500">{detalleLotes.length} registros</p>
                        </div>

                        {detalleLotes.length > 0 ? (
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide">
                                <tr>
                                  <th className="text-left px-4 py-3">Lote</th>
                                  <th className="text-left px-4 py-3">Proveedor</th>
                                  <th className="text-center px-4 py-3">Ubicación</th>
                                  <th className="text-right px-4 py-3">Costo unitario</th>
                                  <th className="text-right px-4 py-3">Costo total</th>
                                  <th className="text-right px-4 py-3">Actual</th>
                                  <th className="text-right px-4 py-3">Comprometido</th>
                                  <th className="text-right px-4 py-3">Disponible</th>
                                  <th className="text-right px-4 py-3">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalleLotes.map((lote) => {
                                  const proveedor = proveedorById[lote.id_proveedor] || 'Sin dato';
                                  const disponible = (lote.cantidad_actual || 0) - (lote.cantidad_comprometida || 0);

                                  return (
                                    <tr key={lote.uid} className="border-t border-slate-100">
                                      <td className="px-4 py-3">
                                        <p className="text-xs font-semibold text-slate-900 uppercase">{lote.lote}</p>
                                        <p className="text-[11px] text-slate-500">{lote.remito_nro || 'Sin remito'}</p>
                                      </td>
                                      <td className="px-4 py-3 text-xs text-slate-700">{proveedor}</td>
                                      <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-semibold uppercase">
                                          <FiMapPin size={10} /> {lote.ubicacion}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right text-xs text-slate-700 font-semibold">{formatMoney(Number(lote.costo_unitario ?? 0))}</td>
                                      <td className="px-4 py-3 text-right text-xs text-slate-700 font-semibold">{formatMoney(Number(lote.costo_total ?? 0))}</td>
                                      <td className="px-4 py-3 text-right text-xs text-slate-900 font-semibold">{(lote.cantidad_actual || 0).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right text-xs text-orange-700 font-semibold">{(lote.cantidad_comprometida || 0).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right text-xs text-emerald-700 font-semibold">{disponible.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right">
                                        <TableActions>
                                          <TableActionButton label="Desactivar" tone="danger" onClick={() => onDelete(lote.uid)} />
                                        </TableActions>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                            No hay lotes activos asociados a este insumo.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}

          {paginatedData.length === 0 ? (
            <EmptyState
              colSpan={9}
              title="No hay insumos para mostrar"
              message={searchTerm.trim()
                ? 'No se encontraron resultados con el filtro aplicado.'
                : 'Registrá un ingreso de materia prima para comenzar.'}
            />
          ) : null}
        </TableBody>
      </DataTable>

      <div className="px-5 py-3 border border-slate-200 rounded-2xl bg-white shadow-sm flex items-center justify-between">
        <span className="text-xs text-slate-600 font-semibold">{filteredData.length} insumos • Página {currentPage} de {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30"><FiChevronLeft size={16} /></button>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30"><FiChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default StockMateriaPrimaTable;
