import { Navigate, Outlet } from 'react-router-dom';
import { LoaderIcon } from 'lucide-react';
import { useMe } from '../../context/MeContext';
import { useRolePath } from '../../hooks/useRolePath';
import { MODULES, type ModuleKey } from '../../config/roles';
import type { UnauthorizedState } from './UnauthorizedAlert';

/**
 * Guards a module's pages. Which modules a role may open is ticked by a super admin in the control
 * portal; anyone whose role doesn't have this one is sent to their dashboard with an unauthorised alert.
 */
export function ModuleGate({ module }: { module: ModuleKey }) {
  const { me, loading, hasModule } = useMe();
  const rolePath = useRolePath();

  if (loading && !me) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderIcon size={20} className="animate-spin" />
      </div>
    );
  }

  // If the profile couldn't load (or isn't loaded while a temporary password is being replaced), let
  // the page try — the API still enforces access on every call.
  if (!me) {
    return <Outlet />;
  }

  if (!hasModule(module)) {
    const state: UnauthorizedState = {
      unauthorized: `Your role doesn't have access to ${MODULES[module].label}. Ask a super admin if you need it.`,
    };
    return <Navigate to={rolePath()} state={state} replace />;
  }

  return <Outlet />;
}
