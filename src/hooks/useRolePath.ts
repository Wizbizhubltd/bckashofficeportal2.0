import { useAuth } from '../context/AuthContext';
import { isOfficeRole } from '../config/roles';

/**
 * Every page lives under the signed-in user's role (/manager/clients, /director/staff/4, …). Pages
 * build their links with this so the same screen works in every role's routes.
 */
export function useRolePath(): (path?: string) => string {
  const { userType } = useAuth();
  const base = isOfficeRole(userType) ? `/${userType}` : '';
  return (path = '') => `${base}${path}` || '/';
}
