import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiPlus, FiPower, FiUsers } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { ApiService } from '../../../infrastructure/api';
import { usePermissions } from '../../auth/usePermissions';
import { getSessionUser } from '../../auth/session';
import { usuarioService, type UsuarioWritePayload } from '../services/usuarioService';
import UsuarioModal from '../components/UsuarioModal';
import type { Usuario } from '../types/usuario';
import type { UsuarioFormValues } from '../utils/usuarioForm';
import { isSensitiveUsuarioRole } from '../utils/usuarioRules';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return formatDateDDMMYYYY(date);
};

const roleLabel: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ENCARGADO: 'Encargado',
  OPERARIO: 'Operario',
  ADMIN: 'Admin',
  FINANZAS: 'Finanzas',
};

const UsuariosPage = () => {
  const { canAccess, user } = usePermissions();
  const currentUser = getSessionUser();
  const canManageUsers = canAccess('usuarios', 'create');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [resettingSystem, setResettingSystem] = useState(false);

  const refreshUsuarios = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await usuarioService.findAll();
      setUsuarios(data);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshUsuarios();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshUsuarios]);

  const stats = useMemo(() => {
    const total = usuarios.length;
    const activos = usuarios.filter((item) => item.esta_activo).length;
    const inactivos = total - activos;
    const administradores = usuarios.filter((item) => item.role === 'SUPERADMIN' || item.role === 'ADMIN').length;
    return { total, activos, inactivos, administradores };
  }, [usuarios]);

  const openCreateModal = () => {
    setSelectedUsuario(null);
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setActionError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (savingUser) return;
    setIsModalOpen(false);
    setSelectedUsuario(null);
    setActionError(null);
  };

  const handleSaveUsuario = async (values: UsuarioFormValues) => {
    if (!canManageUsers) {
      throw new Error('No tienes permisos para administrar usuarios.');
    }

    setSavingUser(true);
    setActionError(null);
    try {
      const payload = {
        nombre_completo: values.nombre_completo,
        username: values.username,
        email: values.email,
        role: values.role as Usuario['role'],
        esta_activo: values.estado === 'activo',
        fecha_creacion: selectedUsuario?.fecha_creacion ?? new Date().toISOString(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      } satisfies UsuarioWritePayload;

      if (selectedUsuario) {
        await usuarioService.update(selectedUsuario.uid, payload);
      } else {
        await usuarioService.create(payload);
      }
      await refreshUsuarios();
      setIsModalOpen(false);
      setSelectedUsuario(null);
    } finally {
      setSavingUser(false);
    }
  };

  const toggleEstado = async (usuario: Usuario) => {
    if (!canManageUsers) return;
    const confirmMessage = usuario.esta_activo
      ? '¿Seguro que deseas desactivar este usuario?'
      : '¿Seguro que deseas activar este usuario?';
    if (!window.confirm(confirmMessage)) return;
    setActionError(null);
    setActionUid(usuario.uid);
    try {
      await usuarioService.update(usuario.uid, {
        esta_activo: !usuario.esta_activo,
      });
      await refreshUsuarios();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'No se pudo actualizar el estado del usuario.');
    } finally {
      setActionUid(null);
    }
  };

  const currentRoleLabel = user.roleLabel;
  const canResetSystem = canManageUsers && (currentUser.role === 'superadmin' || currentUser.role === 'admin');

  const handleResetSystem = async () => {
    if (!canResetSystem || resettingSystem) return;

    const confirmation = await Swal.fire({
      title: 'Reset del sistema',
      html: `
        <div style="text-align:left; color:#0f172a;">
          <p style="margin:0 0 10px; color:#7f1d1d; font-weight:700;">Esta acción eliminará todos los datos operativos, maestros y de configuración.</p>
          <p style="margin:0 0 12px; color:#334155;">Se conservarán únicamente <strong>auth.users</strong> y <strong>public.usuarios</strong>.</p>
          <p style="margin:0 0 14px; color:#334155;">Escribe exactamente <strong>BORRAR TODO</strong> para habilitar la ejecución.</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'BORRAR TODO',
      inputAttributes: {
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
      },
      showCancelButton: true,
      confirmButtonText: 'Borrar definitivamente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#334155',
      background: '#fff1f2',
      color: '#0f172a',
      focusCancel: true,
      showLoaderOnConfirm: true,
      preConfirm: (value: string | null) => {
        if (String(value ?? '').trim() !== 'BORRAR TODO') {
          Swal.showValidationMessage('Debes escribir exactamente BORRAR TODO.');
          return false;
        }
        return true;
      },
    });

    if (!confirmation.isConfirmed) return;

    setResettingSystem(true);
    try {
      const result = await ApiService.systemAdmin.resetTotalSoloUsuarios();
      await Swal.fire({
        title: 'Reset completado',
        html: `
          <div style="text-align:left; color:#0f172a;">
            <p style="margin:0 0 8px;">Tablas limpiadas: <strong>${result.tablas_totales}</strong></p>
            <p style="margin:0 0 8px;">${result.tablas_limpiadas.join(', ') || 'Sin tablas para limpiar.'}</p>
            <p style="margin:12px 0 0; color:#b91c1c; font-weight:700;">La app se recargará para reflejar el estado limpio.</p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Recargar app',
        confirmButtonColor: '#2563eb',
        background: '#ffffff',
        color: '#0f172a',
      });
      window.location.reload();
    } catch (error: unknown) {
      await Swal.fire({
        title: 'No se pudo ejecutar el reset',
        text: error instanceof Error ? error.message : 'Error inesperado al ejecutar la acción.',
        icon: 'error',
        confirmButtonColor: '#2563eb',
        background: '#ffffff',
        color: '#0f172a',
      });
    } finally {
      setResettingSystem(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200">Administración</p>
          <h1 className="text-3xl font-semibold">Usuarios</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Gestiona cuentas operativas de la plataforma, asigna roles y controla el estado de acceso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-300">Sesión actual</p>
            <p className="mt-1 font-medium">{currentRoleLabel}</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canManageUsers}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiPlus />
            Nuevo usuario
          </button>
          <button
            type="button"
            onClick={() => window.alert('TODO: el panel de permisos personalizados se implementará en una fase posterior.')}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Configurar permisos
          </button>
          {canResetSystem ? (
            <button
              type="button"
              onClick={() => void handleResetSystem()}
              disabled={resettingSystem}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resettingSystem ? 'Ejecutando...' : 'Reset del sistema'}
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total usuarios', value: stats.total },
          { label: 'Usuarios activos', value: stats.activos },
          { label: 'Usuarios inactivos', value: stats.inactivos },
          { label: 'Administradores', value: stats.administradores },
        ].map((item) => (
          <Card key={item.label} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <FiUsers size={18} />
            </div>
          </Card>
        ))}
      </div>

      {loadError ? (
        <Card className="border-red-200 bg-red-50 text-red-700">{loadError}</Card>
      ) : null}

      {actionError ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-800">{actionError}</Card>
      ) : null}

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando usuarios...</p>
        </Card>
      ) : null}

      {!isLoading && usuarios.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No hay usuarios registrados.</p>
        </Card>
      ) : null}

      {!isLoading && usuarios.length > 0 ? (
        <Card className="p-0">
          <div className="overflow-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Alta</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => {
                  const isBusy = actionUid === usuario.uid || savingUser;
                  // Control UI de desarrollo: la seguridad real debe reforzarse en backend/policies.
                  const isProtectedSuperadmin = isSensitiveUsuarioRole(usuario.role) && currentUser.role !== 'superadmin';
                  const isSelfManagedUser = currentUser.managedUserUid === usuario.uid;
                  const canEditRow = canManageUsers && !isProtectedSuperadmin;
                  const canToggleRow = canManageUsers && !isProtectedSuperadmin && !isSelfManagedUser;
                  return (
                    <tr key={usuario.uid} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{usuario.nombre_completo || 'Sin dato'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{usuario.username || 'Sin dato'}</td>
                      <td className="px-6 py-4 text-slate-600">{usuario.email || 'Sin dato'}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {roleLabel[usuario.role] ?? usuario.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            usuario.esta_activo
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {usuario.esta_activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(usuario.fecha_creacion)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!canEditRow || isBusy}
                            onClick={() => openEditModal(usuario)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FiEdit2 size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={!canToggleRow || isBusy}
                            onClick={() => toggleEstado(usuario)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              usuario.esta_activo
                                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <FiPower size={14} />
                            {usuario.esta_activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {isModalOpen ? (
        <UsuarioModal
          key={selectedUsuario?.uid ?? 'nuevo-usuario'}
          usuario={selectedUsuario}
          currentUser={currentUser}
          existingUsers={usuarios}
          onClose={closeModal}
          onSave={handleSaveUsuario}
        />
      ) : null}
    </div>
  );
};

export default UsuariosPage;
