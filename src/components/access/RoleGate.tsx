import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isOfficeRole, roleHome, ROLE_LABELS, type OfficeRole } from '../../config/roles';
import { UnauthorizedScreen } from './UnauthorizedScreen';
import type { UnauthorizedState } from './UnauthorizedAlert';

/**
 * Guards one role's route tree (/director, /controller, /manager, /marketer). Anyone signed in with a
 * different role is sent to their own dashboard with an unauthorised alert; an account that doesn't
 * belong on this portal at all gets the full-page unauthorised screen.
 */
export function RoleGate({ role }: { role: OfficeRole }) {
  const { isAuthenticated, userType } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isOfficeRole(userType)) {
    return <UnauthorizedScreen />;
  }

  if (userType !== role) {
    const state: UnauthorizedState = {
      unauthorized: `You are not authorised to access the ${ROLE_LABELS[role]} pages. You've been taken to your own dashboard.`,
    };
    return <Navigate to={roleHome(userType)} state={state} replace />;
  }

  return <Outlet />;
}

/** Sends a signed-in user to their own role's dashboard — used for "/" and any unknown or retired URL. */
export function HomeRedirect() {
  const { isAuthenticated, userType } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return isOfficeRole(userType) ? <Navigate to={roleHome(userType)} replace /> : <UnauthorizedScreen />;
}
