import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlertIcon, XIcon } from 'lucide-react';

/** Router state set by the guards when they turn someone away from a page, read by the alert below. */
export interface UnauthorizedState {
  unauthorized: string;
}

/** The banner shown at the top of the page someone lands on after being turned away from one they can't open. */
export function UnauthorizedAlert() {
  const location = useLocation();
  const navigate = useNavigate();
  const message = (location.state as Partial<UnauthorizedState> | null)?.unauthorized;

  if (!message) {
    return null;
  }

  return (
    <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <ShieldAlertIcon size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-heading font-bold">Unauthorised</p>
        <p className="mt-0.5">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => navigate(location.pathname + location.search, { replace: true, state: null })}
        className="rounded p-1 text-red-500 hover:bg-red-100"
        aria-label="Dismiss"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}
