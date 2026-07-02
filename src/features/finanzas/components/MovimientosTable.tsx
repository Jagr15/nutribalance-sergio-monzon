import { useEffect, useState } from 'react';
import type { MovimientoFinanciero, RubroFinancieroCatalogo } from '../types';
import { DataTable, EmptyState, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { finanzasService } from '../services/finanzasService';
import { parseNumericInput } from '../../../shared/utils/formatters';
import { FiX, FiEdit } from 'react-icons/fi';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);

const getDiasVencimientoLabel = (fechaVencimiento: string | null | undefined) => {
  if (!fechaVencimiento) return '-';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento);
  venc.setHours(0, 0, 0, 0);
  const diffTime = venc.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return <span className="text-red-600 font-semibold">Vencido hace {Math.abs(diffDays)} días</span>;
  } else if (diffDays === 0) {
    return <span className="text-amber-600 font-semibold">Vence hoy</span>;
  } else {
    return <span className="text-slate-600 font-medium">En {diffDays} días</span>;
  }
};

export const MovimientosTable = ({
  movimientos,
  showOrigenAndCentroCosto = false,
  limit = 20,
  onRefresh,
  showDiasVencimiento = false,
  title,
  subtitle,
}: {
  movimientos: MovimientoFinanciero[];
  showOrigenAndCentroCosto?: boolean;
  limit?: number;
  onRefresh?: () => void | Promise<void>;
  showDiasVencimiento?: boolean;
  title?: string;
  subtitle?: string;
}) => {
  const visibleMovimientos = movimientos.slice(0, limit);
  const colSpan = showDiasVencimiento ? 10 : (showOrigenAndCentroCosto ? 11 : 9);

  const [rubros, setRubros] = useState<RubroFinancieroCatalogo[]>([]);
  const [editingMov, setEditingMov] = useState<MovimientoFinanciero | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form states for Edit Modal
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [fechaOperacion, setFechaOperacion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [estadoFinanciero, setEstadoFinanciero] = useState('');

  useEffect(() => {
    let active = true;
    void finanzasService.getRubrosFinancieros().then((data) => {
      if (active) setRubros(data.filter((r) => r.activo));
    }).catch((err) => console.error('Error fetching rubros in table:', err));
    return () => {
      active = false;
    };
  }, []);

  const openEditModal = (m: MovimientoFinanciero) => {
    setEditingMov(m);
    setDescripcion(m.descripcion);
    setMonto(m.monto.toString());
    const foundRubro = rubros.find((r) => r.nombre === m.categoria);
    setCategoriaId(foundRubro?.id || '');
    setFechaOperacion(m.fecha_operacion || m.fecha.split('T')[0]);
    setFechaVencimiento(m.fecha_vencimiento || m.fecha.split('T')[0]);
    setEstadoFinanciero(m.estado_financiero || '');
    setEditError(null);
  };

  const handleConfirmar = async (uid: string) => {
    try {
      await finanzasService.confirmarMovimiento(uid);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Error al confirmar movimiento:', err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMov) return;
    setIsSubmitting(true);
    setEditError(null);

    const parsedMonto = parseNumericInput(monto);
    if (parsedMonto === null || parsedMonto <= 0) {
      setEditError('El monto debe ser mayor a 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      await finanzasService.updateMovimiento(editingMov.uid, {
        descripcion: descripcion.trim(),
        monto: parsedMonto,
        fecha_operacion: fechaOperacion,
        fecha_vencimiento: fechaVencimiento,
        estado_financiero: estadoFinanciero,
        categoria_id: categoriaId || null,
      });
      setEditingMov(null);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setEditError(err?.message || 'Error al actualizar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Total {movimientos.length}
          </span>
        </div>
      ) : null}
      
      <DataTable className="rounded-none border-0 shadow-none" minWidthClassName="min-w-full">
        <TableHeader>
          <tr className="bg-slate-50/80">
            <TableCell header className="text-slate-600">Fecha</TableCell>
            <TableCell header className="text-slate-600">Fecha Venc.</TableCell>
            <TableCell header className="text-slate-600">Tipo</TableCell>
            <TableCell header className="text-slate-600">Descripción</TableCell>
            <TableCell header className="text-slate-600">Categoría</TableCell>
            <TableCell header className="text-right text-slate-600">Monto</TableCell>
            <TableCell header className="text-slate-600">Estado</TableCell>
            <TableCell header className="text-slate-600">Est. Fin.</TableCell>
            {showDiasVencimiento ? <TableCell header className="text-slate-600">Vencimiento</TableCell> : null}
            {showOrigenAndCentroCosto && !showDiasVencimiento ? <TableCell header className="text-slate-600">Origen</TableCell> : null}
            {showOrigenAndCentroCosto && !showDiasVencimiento ? <TableCell header className="text-slate-600">Centro costo</TableCell> : null}
            <TableCell header className="text-slate-600">Acciones</TableCell>
          </tr>
        </TableHeader>
        <TableBody>
          {visibleMovimientos.map((m, index) => {
            const isPending = m.estado === 'PENDIENTE';
            const isVencido = m.fecha_vencimiento && new Date(m.fecha_vencimiento).getTime() < new Date().setHours(0,0,0,0);
            return (
              <TableRow key={m.uid || `${m.fecha}-${m.descripcion}-${index}`}>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {formatDateDDMMYYYY(m.fecha_operacion || m.fecha)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-600">
                  {m.fecha_vencimiento ? formatDateDDMMYYYY(m.fecha_vencimiento) : '-'}
                </TableCell>
                <TableCell><StatusBadge value={m.tipo} /></TableCell>
                <TableCell className="max-w-[320px] whitespace-normal break-words text-slate-900">{m.descripcion}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal break-words text-slate-500">{m.categoria || '-'}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">{formatCurrency(m.monto)}</TableCell>
                <TableCell><StatusBadge value={m.estado} /></TableCell>
                <TableCell>
                  {m.estado_financiero ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      (isVencido && isPending)
                        ? 'bg-red-100 text-red-800'
                        : ['COBRADO', 'PAGADO'].includes(m.estado_financiero)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {(isVencido && isPending) ? 'VENCIDO' : m.estado_financiero.replace('_', ' ')}
                    </span>
                  ) : '-'}
                </TableCell>
                {showDiasVencimiento ? (
                  <TableCell>
                    {getDiasVencimientoLabel(m.fecha_vencimiento)}
                  </TableCell>
                ) : null}
                {showOrigenAndCentroCosto && !showDiasVencimiento ? <TableCell className="max-w-[200px] whitespace-normal break-words text-slate-500">{m.origen_operativo || '-'}</TableCell> : null}
                {showOrigenAndCentroCosto && !showDiasVencimiento ? <TableCell className="max-w-[200px] whitespace-normal break-words text-slate-500">{m.centro_costo || '-'}</TableCell> : null}
                <TableCell>
                  <div className="flex gap-2">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirmar(m.uid)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1 px-2.5 rounded-lg transition"
                        >
                          {m.tipo === 'INGRESO' ? 'Cobrar' : 'Pagar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1 px-2.5 rounded-lg transition inline-flex items-center gap-1"
                        >
                          <FiEdit size={12} />
                          Editar
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold">-</span>
                    )}
                  </div>
                </TableCell>
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
      </DataTable>

      {/* Edit Movement Modal */}
      {editingMov ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" onClick={() => setEditingMov(null)} role="presentation">
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Editar Movimiento Pendiente</h3>
              <button type="button" onClick={() => setEditingMov(null)} className="text-slate-500 hover:text-slate-700">
                <FiX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              {editError ? (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {editError}
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</label>
                <input
                  type="text"
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Operación</label>
                  <input
                    type="date"
                    required
                    value={fechaOperacion}
                    onChange={(e) => setFechaOperacion(e.target.value)}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Vencimiento</label>
                  <input
                    type="date"
                    required
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado Financiero</label>
                  <select
                    value={estadoFinanciero}
                    onChange={(e) => setEstadoFinanciero(e.target.value)}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  >
                    {editingMov.tipo === 'INGRESO' ? (
                      <>
                        <option value="PENDIENTE_COBRO">Pendiente de Cobro</option>
                        <option value="COBRADO">Cobrado</option>
                        <option value="VENCIDO">Vencido</option>
                        <option value="CANCELADO">Cancelado</option>
                      </>
                    ) : (
                      <>
                        <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
                        <option value="PAGADO">Pagado</option>
                        <option value="VENCIDO">Vencido</option>
                        <option value="CANCELADO">Cancelado</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Rubro / Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
                  >
                    <option value="">Sin Categoría</option>
                    {rubros.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingMov(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-sm font-semibold shadow transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
