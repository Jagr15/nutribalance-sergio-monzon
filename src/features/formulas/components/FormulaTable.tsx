import React, { useMemo, useState } from 'react';
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiChevronUp, FiClock, FiFileText, FiSearch } from 'react-icons/fi';
import { format } from 'date-fns';
import type { Formula } from '../types';
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
  data?: Formula[];
  onEdit: (formula: Formula) => void;
  onDelete: (uid: string) => void;
  enableSearch?: boolean;
  emptyMessage?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

const FormulaTable: React.FC<Props> = ({ data = [], onEdit, onDelete, enableSearch = true, emptyMessage, canEdit = true, canDelete = true }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredData = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    if (!searchTerm.trim()) return source;
    const search = searchTerm.toLowerCase();
    return source.filter((formula) => (
      formula.nombre_producto?.toLowerCase().includes(search)
      || formula.author?.toLowerCase().includes(search)
      || formula.id_usuario?.toLowerCase().includes(search)
      || (formula.esta_activa ? 'activo' : 'inactivo').includes(search)
    ));
  }, [data, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setExpandedRow(null);
    }
  };

  const getDisplayedProtein = (formula: Formula) => {
    const hasIngredientProteinData = formula.ingredientes?.some((ing) => typeof ing.aporte_proteina_pct === 'number' && !Number.isNaN(ing.aporte_proteina_pct));
    if (hasIngredientProteinData) {
      return formula.ingredientes.reduce((acc, ing) => acc + (Number(ing.aporte_proteina_pct) || 0), 0);
    }

    return typeof formula.proteina_calculada_pct === 'number' ? formula.proteina_calculada_pct : undefined;
  };

  const formatProteina = (value?: number) => (typeof value === 'number' ? `${value.toFixed(2)}%` : 'Sin dato');

  return (
    <div className="space-y-3">
      {enableSearch ? (
      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          type="text"
          placeholder="Buscar fórmula, autor o estado..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500/50"
        />
      </div>
      ) : null}

      <DataTable minWidthClassName="min-w-[1160px]">
        <TableHeader>
          <tr>
            <TableCell header className="w-[24%]">Producto / Versión</TableCell>
            <TableCell header className="w-[21%]">Author (ID / Nombre)</TableCell>
            <TableCell header className="w-[12%] text-center whitespace-nowrap">Creado</TableCell>
            <TableCell header className="w-[13%] text-center whitespace-nowrap">Proteína</TableCell>
            <TableCell header className="w-[14%] text-center whitespace-nowrap">Costo/Ton</TableCell>
            <TableCell header className="w-[10%] text-center whitespace-nowrap">Estado</TableCell>
            <TableCell header className="w-[16%] text-right whitespace-nowrap">Acciones</TableCell>
          </tr>
        </TableHeader>
        <TableBody>
          {paginatedData.map((formula) => {
            const proteinRows = formula.ingredientes?.filter((ing) => typeof ing.aporte_proteina_pct === 'number' || typeof ing.aporte_proteina_g_kg === 'number') ?? [];
            return (
            <React.Fragment key={formula.uid}>
              <TableRow
                className={expandedRow === formula.uid ? 'bg-slate-50' : 'cursor-pointer'}
              >
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setExpandedRow(expandedRow === formula.uid ? null : formula.uid)}
                    className="flex w-full items-center gap-2.5 text-left"
                  >
                    {expandedRow === formula.uid ? <FiChevronUp size={13} className="text-slate-500" /> : <FiChevronDown size={13} className="text-slate-500" />}
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-700">
                      <FiFileText size={12} />
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <span className="text-xs font-semibold text-slate-900 block truncate uppercase">{formula.nombre_producto}</span>
                      <span className="text-xs text-slate-500 font-semibold uppercase">v{formula.version}</span>
                    </div>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-xs text-slate-900 font-semibold uppercase truncate">{formula.author || 'Sin dato'}</span>
                    <span className="text-xs text-slate-600 font-mono truncate">ID: {formula.id_usuario || 'Sin dato'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex items-center gap-1 text-slate-500">
                    <FiCalendar size={11} />
                    <span className="text-xs">{formula.createdAt ? format(new Date(formula.createdAt), 'dd/MM/yy') : '--/--/--'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800 whitespace-nowrap">
                    {formatProteina(getDisplayedProtein(formula))}
                  </span>
                </TableCell>
                <TableCell className="text-center font-semibold text-emerald-700">
                  {typeof formula.costo_por_tonelada === 'number' ? formula.costo_por_tonelada.toFixed(2) : 'Sin dato'}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge value={formula.esta_activa ? 'Activa' : 'Inactiva'} />
                </TableCell>
                <TableCell className="text-right">
                  <TableActions>
                    {canEdit ? <TableActionButton label="Editar" tone="secondary" onClick={() => onEdit(formula)} /> : null}
                    {canDelete ? <TableActionButton label="Desactivar" tone="danger" onClick={() => onDelete(formula.uid)} /> : null}
                  </TableActions>
                </TableCell>
              </TableRow>

              {expandedRow === formula.uid ? (
                <tr className="bg-slate-50">
                  <td colSpan={7} className="px-6 py-4 border-l-2 border-blue-200">
                    <div className="flex flex-col gap-5">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Composición de Mezcla</h4>
                        <div className="flex flex-wrap gap-2">
                          {formula.ingredientes?.map((ing) => (
                            <div key={ing.id_insumo} className="bg-white rounded-lg px-3 py-1.5 border border-slate-200 flex items-center gap-3 max-w-full">
                              <span className="text-xs text-slate-700 font-semibold uppercase truncate">{ing.nombre_insumo}</span>
                              <div className="h-3 w-px bg-slate-200" />
                              <span className="text-xs text-blue-700 font-semibold whitespace-nowrap">{Number(ing.porcentaje || 0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Análisis de proteína</h4>
                        {typeof getDisplayedProtein(formula) === 'number' ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              <p className="text-slate-700">Proteína total fórmula: <strong>{getDisplayedProtein(formula)!.toFixed(2)}%</strong></p>
                              <p className="text-slate-700">Proteína g/kg aproximada: <strong>{(getDisplayedProtein(formula)! * 10).toFixed(1)}</strong></p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[560px] text-xs">
                                <thead className="text-slate-600 bg-slate-50">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left">Ingrediente</th>
                                    <th className="px-2 py-1.5 text-right">Inclusión %</th>
                                    <th className="px-2 py-1.5 text-right">Aporte PB %</th>
                                    <th className="px-2 py-1.5 text-right">Aporte g/kg</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {proteinRows.map((ing) => (
                                    <tr key={`${formula.uid}-${ing.id_insumo}`}>
                                      <td className="px-2 py-1.5 text-slate-800">{ing.nombre_insumo}</td>
                                      <td className="px-2 py-1.5 text-right text-slate-700">{Number(ing.porcentaje || 0).toFixed(2)}%</td>
                                      <td className="px-2 py-1.5 text-right text-slate-700">{typeof ing.aporte_proteina_pct === 'number' ? `${ing.aporte_proteina_pct.toFixed(3)}%` : 'Sin dato'}</td>
                                      <td className="px-2 py-1.5 text-right text-slate-700">{typeof ing.aporte_proteina_g_kg === 'number' ? ing.aporte_proteina_g_kg.toFixed(2) : 'Sin dato'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {proteinRows.length === 0 ? (
                              <p className="text-sm text-slate-600">Sin información proteica disponible.</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">Sin información proteica disponible.</p>
                        )}
                      </div>
                      {(formula.advertencias_nutricionales?.length || formula.advertencias_costos?.length) ? (
                        <div className="text-xs text-amber-700 border-t border-slate-200 pt-3">
                          {[...(formula.advertencias_nutricionales ?? []), ...(formula.advertencias_costos ?? [])].slice(0, 4).map((warning) => (
                            <p key={warning}>• {warning}</p>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 text-slate-600 border-t border-slate-200 pt-3">
                        <FiClock size={11} />
                        <span className="text-xs font-semibold uppercase">Última Edición:</span>
                        <span className="text-xs text-slate-500 font-mono">
                          {formula.ultima_edicion ? format(new Date(formula.ultima_edicion), 'dd/MM/yyyy HH:mm') : 'Sin dato'}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          )})}

          {paginatedData.length === 0 ? (
            <EmptyState
              colSpan={7}
              title="No hay fórmulas para mostrar"
              message={emptyMessage ?? "Probá limpiar la búsqueda o crear una nueva fórmula."}
            />
          ) : null}
        </TableBody>
      </DataTable>

      <div className="px-5 py-3 border border-slate-200 rounded-2xl bg-white shadow-sm flex items-center justify-between">
        <span className="text-xs text-slate-600 font-semibold">
          {filteredData.length} registros • Pág {safeCurrentPage} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button disabled={safeCurrentPage === 1} onClick={() => handlePageChange(safeCurrentPage - 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30">
            <FiChevronLeft size={14} />
          </button>
          <button disabled={safeCurrentPage === totalPages || filteredData.length === 0} onClick={() => handlePageChange(safeCurrentPage + 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30">
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormulaTable;
