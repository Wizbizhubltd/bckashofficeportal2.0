import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, ArrowRightIcon, CheckCircle2Icon, LoaderIcon, MailIcon, MonitorSmartphoneIcon } from 'lucide-react';
import { AuthLayout, authInputClass, authPrimaryButtonClass } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { SIGNED_OUT_REASON_KEY } from '../config/storageKeys';

// Read once and cleared, so the notice shows on the redirect to this page but not on later visits.
function takeSignedOutReason(): string | null {
  const reason = sessionStorage.getItem(SIGNED_OUT_REASON_KEY);
  sessionStorage.removeItem(SIGNED_OUT_REASON_KEY);
  return reason;
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signedOutReason] = useState(takeSignedOutReason);
  // Set by the forgot-password page after a successful reset.
  const passwordReset = (location.state as { passwordReset?: boolean } | null)?.passwordReset === true;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { requiresTotp } = await login(email.trim(), password);
      navigate(requiresTotp ? '/2fa' : '/verify-otp', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h2>
      <p className="mt-1.5 mb-8 text-sm text-slate-500">Sign in to the BCKash Office Portal to continue.</p>

      {signedOutReason && !error && (
        <div role="status" className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <MonitorSmartphoneIcon size={16} className="mt-0.5 flex-shrink-0" />
          {signedOutReason}
        </div>
      )}

      {passwordReset && !error && (
        <div role="status" className="mb-5 flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2Icon size={16} className="mt-0.5 flex-shrink-0" />
          Your password has been reset. Sign in with your new password.
        </div>
      )}

      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <div className="relative">
            <MailIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@bckash.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`${authInputClass} pl-10 pr-4`}
              required
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-accent transition-colors">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading || !email.trim() || !password} className={`${authPrimaryButtonClass} mt-2`}>
          {loading ? (
            <>
              <LoaderIcon size={18} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRightIcon size={16} />
            </>
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-400">
        Your account can be signed in on one device at a time. Signing in here will sign out any other device.
      </p>
    </AuthLayout>
  );
}
