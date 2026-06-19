import type { ChequeTesoreriaFormValues } from '../services/tesoreriaService';
import type { EstadoChequeTesoreria, TipoChequeTesoreria } from '../../finanzas/types';

const tipoOptions: Array<{ value: TipoChequeTesoreria; label: string }> = [
  { value: 'EMITIDO', label: 'Emitido' },
  { value: 'RECIBIDO', label: 'Recibido' },
];

const estadoOptions: Array<{ value: EstadoChequeTesoreria; label: string }> = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'DEPOSITADO', label: 'Depositado' },
  { value: 'COBRADO', label: 'Cobrado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'VENCIDO', label: 'Vencido' },
];

export const ChequeForm = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  value: ChequeTesoreriaFormValues;
  onChange: (next: ChequeTesoreriaFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}) => (
  <form
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cheque</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">Registrar o editar cheque</h3>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        Limpiar
      </button>
    </div>

    {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Número</span>
        <input className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.numero} onChange={(event) => onChange({ ...value, numero: event.target.value })} />
      </label>
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo</span>
        <select className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.tipo} onChange={(event) => onChange({ ...value, tipo: event.target.value as TipoChequeTesoreria | '' })}>
          <option value="">Seleccionar</option>
          {tipoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="block md:col-span-2">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tercero</span>
        <input className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.tercero} onChange={(event) => onChange({ ...value, tercero: event.target.value })} />
      </label>
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Importe</span>
        <input type="number" min="0" step="0.01" className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.importe} onChange={(event) => onChange({ ...value, importe: Number(event.target.value) })} />
      </label>
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Estado</span>
        <select className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.estado} onChange={(event) => onChange({ ...value, estado: event.target.value as EstadoChequeTesoreria })}>
          {estadoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha emisión</span>
        <input type="date" className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.fecha_emision} onChange={(event) => onChange({ ...value, fecha_emision: event.target.value })} />
      </label>
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha vencimiento</span>
        <input type="date" className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" value={value.fecha_vencimiento} onChange={(event) => onChange({ ...value, fecha_vencimiento: event.target.value })} />
      </label>
      <label className="block">
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha acreditación</span>
        <input
          type="date"
          className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm"
          value={value.fecha_acreditacion ?? ''}
          onChange={(event) => onChange({ ...value, fecha_acreditacion: event.target.value })}
          placeholder="Opcional"
        />
      </label>
    </div>

    <div className="mt-4 flex justify-end">
      <button type="submit" disabled={submitting} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-60">
        {submitting ? 'Guardando...' : 'Guardar cheque'}
      </button>
    </div>
  </form>
);
