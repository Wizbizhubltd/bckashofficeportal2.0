import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClockIcon,
  LoaderIcon,
  MailIcon,
  MessageSquareIcon,
  RotateCwIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { AuthLayout, authPrimaryButtonClass } from '../components/AuthLayout';
import { OtpInput } from '../components/OtpInput';
import { useAuth } from '../context/AuthContext';

// Matches the server's resend cooldown; the server enforces it regardless of this timer.
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

/** "j***n@bckash.com" — enough to recognise the address without showing it in full. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const visible = name.length <= 2 ? name[0] : `${name[0]}${'*'.repeat(Math.min(name.length - 2, 5))}${name[name.length - 1]}`;
  return `${visible}@${domain}`;
}

export function VerifyOtp() {
  const { verifyOtp, resendOtp, pendingChallengeToken, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Passed by the login page; lost on a refresh, in which case the copy stays generic.
  const email = (location.state as { email?: string } | null)?.email;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // A successful verify clears the challenge and signs in within the same update, so this re-renders
  // before handleSubmit's navigate runs — send a signed-in user on to the app, not back to login.
  if (!pendingChallengeToken) {
    return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
  }

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (code.length !== CODE_LENGTH || loading) return;
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await verifyOtp(code);
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'An error occurred. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setResending(true);

    try {
      await resendOtp();
      setCode('');
      setNotice('A new code has been sent. Codes sent earlier will no longer work.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const cooldownLabel = `0:${String(resendCooldown).padStart(2, '0')}`;

  return (
    <AuthLayout>
      <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#0f3a2d] text-white shadow-lg shadow-primary/25">
        <ShieldCheckIcon size={26} />
        <span className="absolute -right-1 -top-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-accent" />
        </span>
      </div>

      <h2 className="font-heading text-2xl font-bold text-slate-900">Verify it's you</h2>
      <p className="mt-1.5 text-sm text-slate-500">
        We've sent a {CODE_LENGTH}-digit verification code to
        {email ? (
          <>
            {' '}
            the email <span className="font-medium text-slate-700">{maskEmail(email)}</span> and the phone number on your
            account.
          </>
        ) : (
          ' the email and phone number on your account.'
        )}
      </p>

      <div className="mt-5 mb-7 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600 ring-1 ring-slate-200/70">
          <MailIcon size={14} className="text-primary" />
          Check your inbox
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600 ring-1 ring-slate-200/70">
          <MessageSquareIcon size={14} className="text-primary" />
          Or your SMS messages
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="mb-5 flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2Icon size={16} className="mt-0.5 flex-shrink-0" />
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Verification code</span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <ClockIcon size={12} />
              Expires in 5 minutes
            </span>
          </div>
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error) setError('');
            }}
            length={CODE_LENGTH}
            disabled={loading}
            hasError={!!error}
            autoFocus
          />
        </div>

        <button type="submit" disabled={loading || code.length !== CODE_LENGTH} className={authPrimaryButtonClass}>
          {loading ? (
            <>
              <LoaderIcon size={18} className="animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheckIcon size={17} />
              Verify and continue
            </>
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500">
        Didn't receive a code?
        {resendCooldown > 0 ? (
          <span className="font-medium tabular-nums text-slate-400">Resend in {cooldownLabel}</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1 font-medium text-primary hover:text-accent transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCwIcon size={13} className={resending ? 'animate-spin' : ''} />
            {resending ? 'Sending...' : 'Resend code'}
          </button>
        )}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-5 text-center">
        <button
          type="button"
          onClick={handleBackToLogin}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary"
        >
          <ArrowLeftIcon size={15} />
          Back to sign in
        </button>
      </div>
    </AuthLayout>
  );
}
