import type { MovimientoFinanciero } from '../types';
import { DataTable, EmptyState, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);

export const MovimientosTable = ({
  movimientos,
  showOrigenAndCentroCosto = false,
  limit = 20,
}: {
  movimientos: MovimientoFinanciero[];
  showOrigenAndCentroCosto?: boolean;
  limit?: number;
}) => {
  const visibleMovimientos = movimientos.slice(0, limit);
  const colSpan = showOrigenAndCentroCosto ? 8 : 6;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Movimientos financieros</h3>
          <p className="mt-1 text-sm text-slate-500">Últimos registros de ingresos, egresos y transferencias.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          Últimos {limit}
        </span>
      </div>
      <DataTable className="rounded-none border-0 shadow-none" minWidthClassName="min-w-full">
        <table className="w-full border-collapse text-left">
          <TableHeader>
            <tr className="bg-slate-50/80">
              <TableCell header className="text-slate-600">Fecha</TableCell>
              <TableCell header className="text-slate-600">Tipo</TableCell>
              <TableCell header className="text-slate-600">Descripción</TableCell>
              <TableCell header className="text-slate-600">Categoría</TableCell>
              <TableCell header className="text-right text-slate-600">Monto</TableCell>
              <TableCell header className="text-slate-600">Estado</TableCell>
              {showOrigenAndCentroCosto ? <TableCell header className="text-slate-600">Origen</TableCell> : null}
              {showOrigenAndCentroCosto ? <TableCell header className="text-slate-600">Centro costo</TableCell> : null}
            </tr>
          </TableHeader>
          <TableBody>
            {visibleMovimientos.map((m) => {
              const key = `${m.uid}-${m.fecha}-${m.descripcion}`;
              return (
                <TableRow key={key}>
                  <TableCell className="whitespace-nowrap text-slate-600">{formatDateDDMMYYYY(m.fecha)}</TableCell>
                  <TableCell><StatusBadge value={m.tipo} /></TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal break-words text-slate-900">{m.descripcion}</TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal break-words text-slate-500">{m.categoria || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">{formatCurrency(m.monto)}</TableCell>
                  <TableCell><StatusBadge value={m.estado} /></TableCell>
                  {showOrigenAndCentroCosto ? <TableCell className="max-w-[200px] whitespace-normal break-words text-slate-500">{m.origen_operativo || '-'}</TableCell> : null}
                  {showOrigenAndCentroCosto ? <TableCell className="max-w-[200px] whitespace-normal break-words text-slate-500">{m.centro_costo || '-'}</TableCell> : null}
                </TableRow>
              );
            })}
            {movimientos.length === 0 ? (
              <EmptyState
                colSpan={colSpan}
                title="Aún no hay movimientos registrados."
                message="Cuando registres ingresos, egresos o transferencias aparecerán aquí."
              />
            ) : null}
          </TableBody>
        </table>
      </DataTable>
    </div>
  );
};
