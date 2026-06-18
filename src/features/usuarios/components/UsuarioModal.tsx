import { useState, type FormEvent } from 'react';
import { FiX } from 'react-icons/fi';
import type { SessionUser } from '../../auth/session';
import type { Usuario } from '../types/usuario';
import {
  createEmptyUsuarioFormValues,
  USER_STATE_OPTIONS,
  normalizeUsuarioFormValues,
  hasUsuarioFormErrors,
  validateUsuarioFormValues,
  type UsuarioFormValues,
} from '../utils/usuarioForm';
import {
  getRoleOptionsForCurrentUser,
  type UsuarioDomainContext,
  type UsuarioDomainErrors,
} from '../utils/usuarioRules';

interface UsuarioModalProps {
  usuario?: Usuario | null;
  currentUser: SessionUser;
  existingUsers: Usuario[];
  onClose: () => void;
  onSave: (values: UsuarioFormValues) => Promise<void> | void;
}

const UsuarioModal = ({ usuario, currentUser, existingUsers, onClose, onSave }: UsuarioModalProps) => {
  const [form, setForm] = useState<UsuarioFormValues>(() => createEmptyUsuarioFormValues(usuario ?? undefined));
  const [errors, setErrors] = useState<UsuarioDomainErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleOptions = getRoleOptionsForCurrentUser(currentUser.role);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const normalized = normalizeUsuarioFormValues(form);
    const nextErrors = validateUsuarioFormValues(normalized, {
      existingUsers,
      currentUser,
      editingUid: usuario?.uid ?? null,
    } satisfies UsuarioDomainContext);
    setErrors(nextErrors);
    setSubmitError(nextErrors.general ?? null);
    if (hasUsuarioFormErrors(nextErrors)) return;

    setIsSubmitting(true);
    try {
      await onSave(normalized);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo guardar el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof UsuarioFormValues>(field: K, value: UsuarioFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-blue-500">
              Administración de usuarios
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {usuario ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar modal"
          >
            <FiX size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {submitError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Nombre completo
              </span>
              <input
                className="ui-input w-full rounded-2xl px-4 py-3 text-sm"
                value={form.nombre_completo}
                onChange={(event) => updateField('nombre_completo', event.target.value)}
                placeholder="Ej: Sergio Ramos"
              />
              {errors.nombre_completo ? <p className="text-xs text-red-600">{errors.nombre_completo}</p> : null}
            </label>

            <label className="space-y-1.5">
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Usuario
              </span>
              <input
                className="ui-input w-full rounded-2xl px-4 py-3 text-sm"
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                placeholder="Ej: sergio_admin"
              />
              {errors.username ? <p className="text-xs text-red-600">{errors.username}</p> : null}
            </label>

            <label className="space-y-1.5">
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Email
              </span>
              <input
                className="ui-input w-full rounded-2xl px-4 py-3 text-sm"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="correo@dominio.com"
                type="email"
              />
              {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
            </label>

            <label className="space-y-1.5">
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Rol
              </span>
              <select
                className="ui-input w-full rounded-2xl px-4 py-3 text-sm"
                value={form.role}
                onChange={(event) => updateField('role', event.target.value as UsuarioFormValues['role'])}
              >
                <option value="">Seleccionar rol</option>
                {roleOptions.map((option: (typeof roleOptions)[number]) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.role ? <p className="text-xs text-red-600">{errors.role}</p> : null}
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Estado
              </span>
              <select
                className="ui-input w-full rounded-2xl px-4 py-3 text-sm"
                value={form.estado}
                onChange={(event) => updateField('estado', event.target.value as UsuarioFormValues['estado'])}
              >
                {USER_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.estado ? <p className="text-xs text-red-600">{errors.estado}</p> : null}
            </label>
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando...' : usuario ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default UsuarioModal;
