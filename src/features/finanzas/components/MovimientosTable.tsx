import type { MovimientoFinanciero } from '../types';
import { DataTable, EmptyState, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';

export const MovimientosTable = ({ movimientos }: { movimientos: MovimientoFinanciero[] }) => (
  <DataTable minWidthClassName="min-w-[900px]">
    <TableHeader>
      <tr>
        <TableCell header>Fecha</TableCell><TableCell header>Tipo</TableCell><TableCell header>Descripción</TableCell><TableCell header>Origen</TableCell><TableCell header>Categoría</TableCell><TableCell header>Centro costo</TableCell><TableCell header>Monto</TableCell><TableCell header>Estado</TableCell>
      </tr>
    </TableHeader>
    <TableBody>
      {movimientos.slice(0, 25).map((m) => (
        <TableRow key={m.uid}>
          <TableCell>{new Date(m.fecha).toLocaleDateString('es-AR')}</TableCell>
          <TableCell><StatusBadge value={m.tipo} /></TableCell>
          <TableCell>{m.descripcion}</TableCell>
          <TableCell className="text-slate-500">{m.origen_operativo || '-'}</TableCell>
          <TableCell className="text-slate-500">{m.categoria || '-'}</TableCell>
          <TableCell className="text-slate-500">{m.centro_costo || '-'}</TableCell>
          <TableCell>{m.monto.toLocaleString('es-AR')}</TableCell>
          <TableCell><StatusBadge value={m.estado} /></TableCell>
        </TableRow>
      ))}
      {movimientos.length === 0 ? <EmptyState colSpan={8} message="No hay movimientos cargados todavía." /> : null}
    </TableBody>
  </DataTable>
);
