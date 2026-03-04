import { useAuthContext } from './AuthContext';
import { SystemRoles } from 'librechat-data-provider';

/**
 * Hook для проверки, является ли пользователь администратором.
 * Используется для role-based visibility и access control в Settings.
 * @returns {boolean} true если пользователь имеет роль ADMIN, иначе false
 */
export const useIsAdmin = (): boolean => {
  const { user } = useAuthContext();
  return user?.role === SystemRoles.ADMIN;
};

export default useIsAdmin;
