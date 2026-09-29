import { useNavigate } from 'react-router-dom';
import { ShieldAlertIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Shown instead of the app when the signed-in account doesn't belong on the office portal — a super
 * admin (control portal only) or an account with no staff role. The API refuses these at sign-in; this
 * covers a session that predates that rule.
 */
export function UnauthorizedScreen({ message }: { message?: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] p-4 font-body">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlertIcon size={24} />
        </span>
        <h1 className="mt-4 font-heading text-xl font-bold text-slate-900">Unauthorised</h1>
        <p className="mt-2 text-sm text-slate-500">
          {message ?? 'Your account is not authorised to access the Office Portal. Super admins sign in to the Control Portal.'}
        </p>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          className="mt-6 rounded-lg bg-primary px-5 py-2 text-sm font-heading font-bold text-white hover:bg-primary/90"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
