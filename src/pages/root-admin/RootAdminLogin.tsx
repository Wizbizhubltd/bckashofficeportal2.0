import { FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, LoaderIcon } from 'lucide-react';
import { ROOT_ADMIN_TOKEN_KEY, getRootAdminToken, rootAdminService } from '../../services/root-admin/root-admin.service';

export function RootAdminLogin() {
  const navigate = useNavigate();
  const existingToken = useMemo(() => getRootAdminToken(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (existingToken) {
    return <Navigate to="/root-admin/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const response = await rootAdminService.login({
        email: email.trim().toLowerCase(),
        password,
      });

      localStorage.setItem(ROOT_ADMIN_TOKEN_KEY, response.token);
      navigate('/root-admin/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Root Admin</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Control Center Login</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to onboard organizations and super admins.</p>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircleIcon size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="root-admin-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="root-admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="rootadmin@bckash.com"
              required
            />
          </div>

          <div>
            <label htmlFor="root-admin-password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="root-admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary text-white py-2.5 font-semibold hover:bg-primary/90 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoaderIcon size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-4">
          Back to staff portal? <Link to="/login" className="text-primary font-semibold">Go to login</Link>
        </p>
      </div>
    </div>
  );
}
