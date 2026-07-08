import { getSessionUser } from './session';
import type { AppAction, AppModule } from './permissions';
import { can } from './permissions';

export const usePermissions = () => {
  const user = getSessionUser();

  const canAccess = (module: AppModule, action: AppAction = 'view') => can(user.role, module, action);
  const canSeeFinancials = user.role !== 'operario' && user.role !== 'produccion' && user.role !== 'solo_lectura';

  return {
    user,
    canAccess,
    canSeeFinancials,
  };
};
