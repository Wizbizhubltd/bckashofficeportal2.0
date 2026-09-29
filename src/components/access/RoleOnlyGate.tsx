import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRolePath } from '../../hooks/useRolePath';
import type { OfficeRole } from '../../config/roles';
import type { UnauthorizedState } from './UnauthorizedAlert';

/** Guards pages only some roles may open (e.g. adding a client), sending anyone else back with an unauthorised alert. */
export function RoleOnlyGate({ roles, message, fallback }: { roles: OfficeRole[]; message: string; fallback: string }) {
  const { userType } = useAuth();
  const rolePath = useRolePath();

  if (!roles.includes(userType as OfficeRole)) {
    const state: UnauthorizedState = { unauthorized: message };
    return <Navigate to={rolePath(fallback)} state={state} replace />;
  }

  return <Outlet />;
}
