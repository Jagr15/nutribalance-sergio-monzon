import { FiEdit2, FiPlus, FiPower, FiRotateCcw, FiX } from 'react-icons/fi';
import { RUBRO_AREA_OPTIONS, type RubroFinancieroAdmin, type RubroFinancieroFormValues, type RubroFinancieroTipo } from '../utils/finanzasDashboard';

type Props = {
  open: boolean;
  rubros: RubroFinancieroAdmin[];
  rubroForm: RubroFinancieroFormValues;
  editingRubroId: string | null;
  rubroError: string | null;
  rubrosSavedMessage: string | null;
  onClose: () => void;
  onNew: () => void;
  onEdit: (rubro: RubroFinancieroAdmin) => void;
  onToggle: (rubro: RubroFinancieroAdmin) => void;
  onChangeForm: (next: Partial<RubroFinancieroFormValues>) => void;
  onClearForm: () => void;
  onSubmit: () => void;
};

const rubroTipoLabels: Record<RubroFinancieroTipo, string> = {
  FIJO: 'Fijo',
  VARIABLE: 'Variable',
  MIXTO: 'Mixto',
};

export const RubroFinancieroAdminModal = ({
  open,
  rubros,
  rubroForm,
  editingRubroId,
  rubroError,
  rubrosSavedMessage,
  onClose,
  onNew,
  onEdit,
  onToggle,
  onChangeForm,
  onClearForm,
  onSubmit,
}: Props) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="administrar-rubros-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Costos</p>
            <h3 id="administrar-rubros-title" className="mt-1 text-xl font-semibold text-slate-900">
              Administrar rubros
            </h3>
            <p className="mt-1 text-sm text-slate-500">Catálogo separado para crear, editar y activar o desactivar rubros financieros.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar modal">
            <FiX size={16} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Listado de rubros</h4>
                <p className="text-sm text-slate-500">Activos e inactivos para administración.</p>
              </div>
              <button type="button" onClick={onNew} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                <FiPlus size={14} />
                Nuevo rubro
              </button>
            </div>

            <div className="space-y-3">
              {rubros.map((rubro) => (
                <div key={rubro.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{rubro.nombre}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{rubroTipoLabels[rubro.tipo]}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${rubro.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{rubro.activo ? 'Activo' : 'Inactivo'}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{rubro.origen === 'base' ? 'Rubro base del sistema' : 'Rubro personalizado'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onEdit(rubro)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        <FiEdit2 size={13} />
                        Editar
                      </button>
                      <button type="button" onClick={() => onToggle(rubro)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${rubro.activo ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        <FiPower size={13} />
                        {rubro.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{editingRubroId ? 'Editar rubro' : 'Crear rubro'}</p>
                <h4 className="mt-1 text-base font-semibold text-slate-900">{editingRubroId ? 'Modificar rubro financiero' : 'Nuevo rubro financiero'}</h4>
              </div>
              <button type="button" onClick={onClearForm} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                <FiRotateCcw size={13} />
                Limpiar
              </button>
            </div>

            {rubroError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{rubroError}</div> : null}
            {rubrosSavedMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{rubrosSavedMessage}</div> : null}

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nombre</span>
                <input value={rubroForm.nombre} onChange={(event) => onChangeForm({ nombre: event.target.value })} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" placeholder="Ej: Materia prima" />
              </label>
              <label className="block">
                <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo</span>
                <select value={rubroForm.tipo} onChange={(event) => onChangeForm({ tipo: event.target.value as 'INGRESO' | 'EGRESO' | '' })} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
                  <option value="">Seleccionar tipo</option>
                  <option value="INGRESO">Ingreso</option>
                  <option value="EGRESO">Egreso</option>
                </select>
              </label>
              <label className="block">
                <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Área</span>
                <select value={rubroForm.area} onChange={(event) => onChangeForm({ area: event.target.value })} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
                  {RUBRO_AREA_OPTIONS.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <input type="checkbox" checked={rubroForm.activo} onChange={(event) => onChangeForm({ activo: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-slate-700">Rubro activo</span>
              </label>
              <div className="flex justify-end gap-3">
                <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500">
                  {editingRubroId ? 'Guardar cambios' : 'Crear rubro'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
