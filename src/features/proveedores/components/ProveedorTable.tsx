// src/features/proveedores/components/ProveedorTable.tsx
import React from 'react';
import { FiUser, FiPhone } from "react-icons/fi";
import type { Proveedor } from '../types/proveedor';
import { DataTable, EmptyState, TableActions, TableActionButton, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';

interface Props {
  data: Proveedor[];
  onEdit: (p: Proveedor) => void;
  onDelete: (uid: string) => void;
  emptyMessage?: string;
}

const ProveedorTable: React.FC<Props> = ({ data, onEdit, onDelete, emptyMessage }) => {
  return (
    <DataTable minWidthClassName="min-w-[1100px]">
      <TableHeader>
        <tr>
          <TableCell header>Empresa / Documento</TableCell>
          <TableCell header>Producto que provee</TableCell>
          <TableCell header>Contacto Principal</TableCell>
          <TableCell header>Teléfono</TableCell>
          <TableCell header>Email</TableCell>
          <TableCell header className="text-right">Acciones</TableCell>
        </tr>
      </TableHeader>
      <TableBody>
          {data.map((p) => (
            <TableRow key={p.uid}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 uppercase">{p.nombre_empresa}</span>
                  <span className="text-xs font-mono text-slate-500">{p.documento || 'SIN DOC'}</span>
                </div>
              </TableCell>
              <TableCell className="text-slate-700 text-sm">
                {p.producto_que_provee?.trim() ? p.producto_que_provee : 'Sin producto asociado'}
              </TableCell>
              <TableCell className="text-slate-900">
                <div className="flex items-center gap-2">
                  <FiUser className="text-blue-500/50" size={12} />
                  {p.contacto_nombre}
                </div>
              </TableCell>
              <TableCell className="text-slate-900">
                <div className="flex items-center gap-2">
                  <FiPhone className="text-green-500/50" size={12} />
                  {p.telefono}
                </div>
              </TableCell>
              <TableCell className="text-slate-700 text-xs">{p.email || 'SIN EMAIL'}</TableCell>
              <TableCell className="text-right">
                <TableActions>
                  <TableActionButton label="Editar" tone="secondary" onClick={() => onEdit(p)} />
                  <TableActionButton label="Desactivar" tone="danger" onClick={() => onDelete(p.uid)} />
                </TableActions>
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 ? <EmptyState colSpan={6} message={emptyMessage || "No hay proveedores registrados."} /> : null}
      </TableBody>
    </DataTable>
  );
};

export default ProveedorTable;
