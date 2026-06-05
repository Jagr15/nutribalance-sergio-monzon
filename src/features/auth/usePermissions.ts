import { getSessionUser } from './session';
import type { AppAction, AppModule } from './permissions';
import { can } from './permissions';

export const usePermissions = () => {
  const user = getSessionUser();

  const canAccess = (module: AppModule, action: AppAction = 'view') => can(user.role, module, action);

  return {
    user,
    canAccess,
  };
};
