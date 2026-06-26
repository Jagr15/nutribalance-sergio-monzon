import React from 'react';
import type { Insumo } from '../types/insumo';
import { DataTable, EmptyState, TableActions, TableActionButton, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';

interface Props {
  data: Insumo[];
  onEdit: (i: Insumo) => void;
  onDelete: (uid: string) => void;
  emptyMessage?: string;
}

const InsumoTable: React.FC<Props> = ({ data, onEdit, onDelete, emptyMessage }) => {
  return (
    <DataTable minWidthClassName="min-w-[900px]">
      <TableHeader>
        <tr>
          <TableCell header>Producto</TableCell>
          <TableCell header>Categoría</TableCell>
          <TableCell header>Unidad</TableCell>
          <TableCell header>Costo</TableCell>
          <TableCell header>Eq. kg</TableCell>
          <TableCell header className="text-center">Umbral de Alerta</TableCell>
          <TableCell header className="text-right">Acciones</TableCell>
        </tr>
      </TableHeader>
      <TableBody>
        {data.map((insumo) => (
          <TableRow key={insumo.uid}>
            <TableCell><span className="font-semibold text-slate-900">{insumo.nombre}</span></TableCell>
            <TableCell><span className="text-slate-500">{insumo.categoria}</span></TableCell>
            <TableCell><span className="text-slate-700 uppercase">{insumo.unidad_medida}</span></TableCell>
            <TableCell>
              <span className="text-slate-700">
                {typeof insumo.costo === 'number'
                  ? `${insumo.costo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${insumo.unidad_costo ?? 'KG'}`
                  : typeof insumo.ref_costo_unitario === 'number'
                    ? `${insumo.ref_costo_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / KG`
                    : 'N/D'}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-slate-700">
                {typeof insumo.costo_por_kg === 'number'
                  ? insumo.costo_por_kg.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : typeof insumo.ref_costo_unitario === 'number'
                    ? insumo.ref_costo_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : 'Sin costo'}
              </span>
            </TableCell>
            <TableCell className="text-center">
              <span className="font-semibold text-slate-900">{insumo.umbral_alerta}</span>
              <span className="ml-2 text-xs text-slate-500 uppercase">{insumo.unidad_medida}</span>
            </TableCell>
            <TableCell className="text-right">
              <TableActions>
                <TableActionButton label="Editar" tone="secondary" onClick={() => onEdit(insumo)} />
                <TableActionButton label="Desactivar" tone="danger" onClick={() => onDelete(insumo.uid)} />
              </TableActions>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 ? (
          <EmptyState colSpan={7} message={emptyMessage || "No hay registros en el maestro de insumos."} />
        ) : null}
      </TableBody>
    </DataTable>
  );
};

export default InsumoTable;
