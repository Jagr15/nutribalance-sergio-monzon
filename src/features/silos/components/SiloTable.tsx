import React from 'react';
import type { Silo } from '../types/silo';
import { DataTable, EmptyState, TableActions, TableActionButton, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';

interface Props {
  data: Silo[];
  onEdit: (silo: Silo) => void;
  onDelete: (uid: string) => void;
  emptyMessage?: string;
}

const SiloTable: React.FC<Props> = ({ data, onEdit, onDelete, emptyMessage }) => {
  return (
    <DataTable minWidthClassName="min-w-[780px]">
      <TableHeader>
        <tr>
          <TableCell header>Identificación del Silo</TableCell>
          <TableCell header>Descripción / Ubicación</TableCell>
          <TableCell header className="text-right">Acciones</TableCell>
        </tr>
      </TableHeader>
      <TableBody>
        {data.map((silo) => (
          <TableRow key={silo.uid}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900">{silo.nombre}</span>
                <span className="text-[10px] font-mono text-slate-500">{silo.uid}</span>
              </div>
            </TableCell>
            <TableCell className="text-slate-500">{silo.descripcion || 'Sin descripción'}</TableCell>
            <TableCell className="text-right">
              <TableActions>
                <TableActionButton label="Editar" onClick={() => onEdit(silo)} />
                <TableActionButton label="Desactivar" tone="danger" onClick={() => onDelete(silo.uid)} />
              </TableActions>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 ? <EmptyState colSpan={3} message={emptyMessage || "No hay silos registrados en el sistema."} /> : null}
      </TableBody>
    </DataTable>
  );
};

export default SiloTable;
