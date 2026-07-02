import { useMemo, useState } from 'react';
import type { RubroFinancieroCatalogo } from '../types';
import { parseNumericInput } from '../../../shared/utils/formatters';

export const RegistrarMovimientoForm = ({
  onSubmit,
  onSuccess,
  rubros,
}: {
  onSubmit: (payload: {
    tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
    descripcion: string;
    monto: number;
    origen_operativo: string;
    categoria_id?: string;
    fecha_operacion?: string;
    fecha_vencimiento?: string;
    estado_financiero?: string;
  }) => Promise<void>;
  onSuccess?: () => void;
  rubros: RubroFinancieroCatalogo[];
}) => {
  const isTipo = (value: string): value is 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' =>
    value === 'INGRESO' || value === 'EGRESO' || value === 'TRANSFERENCIA';
  const [tipo, setTipo] = useState<'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [fechaOperacion, setFechaOperacion] = useState(new Date().toISOString().split('T')[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState(new Date().toISOString().split('T')[0]);
  const [estadoFinanciero, setEstadoFinanciero] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    tipo?: string;
    descripcion?: string;
    monto?: string;
    categoriaId?: string;
    fechaOperacion?: string;
    fechaVencimiento?: string;
    estadoFinanciero?: string;
  }>({});

  const rubrosActivos = useMemo(() => rubros.filter((rubro) => rubro.activo), [rubros]);

  const handleTipoChange = (value: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' | '') => {
    setTipo(value);
    setFieldErrors((current) => ({ ...current, tipo: undefined }));
    if (value === 'INGRESO') {
      setEstadoFinanciero('COBRADO');
    } else if (value === 'EGRESO') {
      setEstadoFinanciero('PAGADO');
    } else {
      setEstadoFinanciero('');
    }
  };

  const resetForm = () => {
    setTipo('');
    setDescripcion('');
    setMonto('');
    setCategoriaId('');
    setFechaOperacion(new Date().toISOString().split('T')[0]);
    setFechaVencimiento(new Date().toISOString().split('T')[0]);
    setEstadoFinanciero('');
    setFieldErrors({});
    setSubmitError(null);
  };

  const montoNum = parseNumericInput(monto);
  const hasMontoValue = monto.trim() !== '';
  const isFormValid =
    tipo !== '' &&
    descripcion.trim() !== '' &&
    hasMontoValue &&
    Number.isFinite(montoNum) &&
    (montoNum ?? 0) > 0 &&
    categoriaId !== '' &&
    rubrosActivos.length > 0;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setSubmitError(null);
        const nextFieldErrors: typeof fieldErrors = {};
        const descripcionLimpia = descripcion.trim();
        const montoLimpio = monto.trim();
        const montoValor = parseNumericInput(montoLimpio);
        const tipoValido = tipo !== '' ? tipo : null;

        if (!tipoValido) nextFieldErrors.tipo = 'Selecciona un tipo de movimiento.';
        if (!descripcionLimpia) nextFieldErrors.descripcion = 'La descripción es obligatoria.';
        if (!montoLimpio) nextFieldErrors.monto = 'El monto es obligatorio.';
        else if (montoValor === null || montoValor <= 0) nextFieldErrors.monto = 'El monto debe ser mayor a 0.';
        if (categoriaId === '') nextFieldErrors.categoriaId = 'Selecciona un rubro financiero.';
        if (rubrosActivos.length === 0) nextFieldErrors.categoriaId = 'No hay rubros activos disponibles.';
        if (!fechaOperacion) nextFieldErrors.fechaOperacion = 'La fecha de operación es obligatoria.';
        if (!fechaVencimiento) nextFieldErrors.fechaVencimiento = 'La fecha de vencimiento es obligatoria.';
        if (!estadoFinanciero) nextFieldErrors.estadoFinanciero = 'El estado financiero es obligatorio.';

        setFieldErrors(nextFieldErrors);
        if (Object.keys(nextFieldErrors).length > 0) return;

        try {
          setIsSubmitting(true);
          if (!tipoValido) return;
          await onSubmit({
            tipo: tipoValido,
            descripcion: descripcionLimpia,
            monto: montoValor ?? 0,
            origen_operativo: 'Manual',
            categoria_id: categoriaId || undefined,
            fecha_operacion: fechaOperacion,
            fecha_vencimiento: fechaVencimiento,
            estado_financiero: estadoFinanciero,
          });
          resetForm();
          onSuccess?.();
        } catch (error: unknown) {
          setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.');
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo de movimiento</span>
          <select
            value={tipo}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || isTipo(value)) {
                handleTipoChange(value === '' ? '' : value);
              }
            }}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.tipo)}
          >
            <option value="">Seleccionar tipo</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
          <p className="mt-1.5 text-xs text-slate-500">Define si este registro suma o resta al flujo.</p>
          {fieldErrors.tipo ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.tipo}</p> : null}
        </label>

        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cantidad / Importe</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => {
              const next = e.target.value === '' ? '' : e.target.value.replace(/^0+(?=\d)/, '');
              setMonto(next);
              setFieldErrors((current) => ({ ...current, monto: undefined }));
            }}
            placeholder="Ej: 85000"
            onFocus={(e) => { if (e.currentTarget.value === '0') setMonto(''); }}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.monto)}
          />
          {fieldErrors.monto ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.monto}</p> : null}
        </label>

        <label className="block md:col-span-2">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Descripción</span>
          <input
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value);
              setFieldErrors((current) => ({ ...current, descripcion: undefined }));
            }}
            placeholder="Describe brevemente el movimiento"
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.descripcion)}
          />
          {fieldErrors.descripcion ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.descripcion}</p> : null}
        </label>

        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha de Operación</span>
          <input
            type="date"
            value={fechaOperacion}
            onChange={(e) => {
              setFechaOperacion(e.target.value);
              setFieldErrors((current) => ({ ...current, fechaOperacion: undefined }));
            }}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.fechaOperacion)}
          />
          {fieldErrors.fechaOperacion ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.fechaOperacion}</p> : null}
        </label>

        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha de Vencimiento</span>
          <input
            type="date"
            value={fechaVencimiento}
            onChange={(e) => {
              setFechaVencimiento(e.target.value);
              setFieldErrors((current) => ({ ...current, fechaVencimiento: undefined }));
            }}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.fechaVencimiento)}
          />
          {fieldErrors.fechaVencimiento ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.fechaVencimiento}</p> : null}
        </label>

        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Estado Financiero</span>
          <select
            value={estadoFinanciero}
            onChange={(e) => {
              setEstadoFinanciero(e.target.value);
              setFieldErrors((current) => ({ ...current, estadoFinanciero: undefined }));
            }}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.estadoFinanciero)}
          >
            <option value="">Seleccionar estado</option>
            {tipo === 'INGRESO' && (
              <>
                <option value="PENDIENTE_COBRO">Pendiente de Cobro</option>
                <option value="COBRADO">Cobrado</option>
                <option value="VENCIDO">Vencido</option>
                <option value="CANCELADO">Cancelado</option>
              </>
            )}
            {tipo === 'EGRESO' && (
              <>
                <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
                <option value="PAGADO">Pagado</option>
                <option value="VENCIDO">Vencido</option>
                <option value="CANCELADO">Cancelado</option>
              </>
            )}
            {tipo === 'TRANSFERENCIA' && (
              <>
                <option value="COBRADO">Cobrado</option>
                <option value="PAGADO">Pagado</option>
              </>
            )}
          </select>
          {fieldErrors.estadoFinanciero ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.estadoFinanciero}</p> : null}
        </label>

        <label className="block">
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Rubro financiero</span>
          <select
            value={categoriaId}
            onChange={(e) => {
              setCategoriaId(e.target.value);
              setFieldErrors((current) => ({ ...current, categoriaId: undefined }));
            }}
            className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
            aria-invalid={Boolean(fieldErrors.categoriaId)}
          >
            <option value="">{rubrosActivos.length > 0 ? 'Selecciona rubro' : 'Sin rubros activos'}</option>
            {rubrosActivos.map((rubro) => (
              <option key={rubro.id} value={rubro.id}>{rubro.nombre}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">Clasifica el movimiento para presupuesto vs real.</p>
          {fieldErrors.categoriaId ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.categoriaId}</p> : null}
        </label>
      </div>

      <p className="text-xs text-slate-500">Origen asignado automáticamente: Manual.</p>
      {rubrosActivos.length === 0 ? <p className="text-xs text-amber-700">No hay rubros activos. El movimiento quedará sin categoría.</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            resetForm();
            onSuccess?.();
          }}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting || !isFormValid} className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60">
          {isSubmitting ? 'Registrando...' : 'Registrar movimiento'}
        </button>
      </div>
    </form>
  );
};
