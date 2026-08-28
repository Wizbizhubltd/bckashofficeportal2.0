import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHomeRoute, type Role } from '../services/auth/role.util';

/**
 * Route protector: gates a subtree of <Route> children to a fixed set of
 * roles, guarding every staff role from reaching another role's area of the
 * platform. Unauthenticated visitors go to /login; authenticated visitors
 * whose role isn't in `allow` are bounced to their own designated home
 * route instead of the page they tried to reach — never shown a blank/403
 * page, and never left able to see a nav item leads somewhere real.
 *
 * Usage: wrap a block of routes with `<Route element={<RoleRoute allow={['super_admin', 'admin']} />}>`.
 */
export function RoleRoute({ allow }: { allow: readonly Role[] }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={roleHomeRoute(user.role)} replace />;
  }

  return <Outlet />;
}
