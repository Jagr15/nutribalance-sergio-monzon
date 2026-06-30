import React from 'react';
import type { Silo } from '../types/silo';
import { DataTable, EmptyState, TableActions, TableActionButton, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';

interface Props {
  data: Silo[];
  onEdit: (silo: Silo) => void;
  onToggleActive: (silo: Silo) => void;
  emptyMessage?: string;
}

const SiloTable: React.FC<Props> = ({ data, onEdit, onToggleActive, emptyMessage }) => {
  return (
    <DataTable minWidthClassName="min-w-[780px]">
      <TableHeader>
        <tr>
          <TableCell header>Identificación del Silo</TableCell>
          <TableCell header>Tipo</TableCell>
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
            <TableCell>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                silo.tipo_uso === 'PRODUCTO_TERMINADO'
                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}>
                {silo.tipo_uso === 'PRODUCTO_TERMINADO' ? 'Producto Terminado' : 'Materia Prima'}
              </span>
            </TableCell>
            <TableCell className="text-slate-500">{silo.descripcion || 'Sin descripción'}</TableCell>
            <TableCell className="text-right">
              <TableActions>
                <TableActionButton label="Editar" onClick={() => onEdit(silo)} />
                <TableActionButton label={silo.esta_activo === false ? 'Activar' : 'Desactivar'} tone={silo.esta_activo === false ? 'primary' : 'danger'} onClick={() => onToggleActive(silo)} />
              </TableActions>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 ? <EmptyState colSpan={4} message={emptyMessage || "No hay silos registrados en el sistema."} /> : null}
      </TableBody>
    </DataTable>
  );
};

export default SiloTable;
