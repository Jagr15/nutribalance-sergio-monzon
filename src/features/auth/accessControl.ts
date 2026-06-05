import type { AppAction, AppModule } from './permissions';
import { can } from './permissions';
import { getSessionUser, isAuthenticated } from './session';

export const assertPermission = (module: AppModule, action: AppAction) => {
  if (!isAuthenticated()) {
    throw new Error('Sesión no válida o expirada');
  }
  const user = getSessionUser();
  if (!can(user.role, module, action)) {
    throw new Error(`No tiene permisos para ${action} en módulo ${module}.`);
  }
};
