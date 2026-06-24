import type { Usuario } from '../types/usuario';
import {
  type UsuarioDomainContext,
  type UsuarioDomainErrors,
  type UsuarioFormInput,
  normalizeUsuarioInput,
  validateUsuarioInput,
  hasUsuarioDomainErrors,
} from './usuarioRules';

export type { UsuarioFormInput as UsuarioFormValues };
export type UsuarioFormErrors = UsuarioDomainErrors;

export const USER_STATE_OPTIONS = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
] as const;

export type UsuarioEstadoForm = (typeof USER_STATE_OPTIONS)[number]['value'];

export const createEmptyUsuarioFormValues = (usuario?: Usuario): UsuarioFormInput => ({
  nombre_completo: usuario?.nombre_completo ?? '',
  username: usuario?.username ?? '',
  email: usuario?.email ?? '',
  role: usuario?.role ?? '',
  estado: usuario ? (usuario.esta_activo ? 'activo' : 'inactivo') : 'activo',
  password: '',
  confirmPassword: '',
});

export const normalizeUsuarioFormValues = normalizeUsuarioInput;

export const validateUsuarioFormValues = (
  values: UsuarioFormInput,
  context: UsuarioDomainContext
) => validateUsuarioInput(values, context);

export const hasUsuarioFormErrors = hasUsuarioDomainErrors;
