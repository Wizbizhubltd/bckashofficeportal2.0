import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, KeyRoundIcon, LoaderIcon, MailIcon } from 'lucide-react';
import { AuthLayout, authInputClass, authPrimaryButtonClass } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { authApi } from '../api/authApi';

// Matches the server's reset cooldown; the server enforces it regardless of this timer.
const RESEND_COOLDOWN_SECONDS = 60;
// Matches the server's minimum password length.
const MIN_PASSWORD_LENGTH = 8;

type Step = 'request' | 'reset';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const sendCode = async () => {
    const { challengeToken: token } = await authApi.forgotPassword(email.trim());
    setChallengeToken(token);
    setCode('');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendCode();
      setStep('reset');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await sendCode();
      setNotice('A new code has been sent. Codes sent earlier will no longer work.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const passwordsDiffer = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canReset = code.length === 6 && newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword;

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await authApi.resetPassword(challengeToken, code, newPassword);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <KeyRoundIcon size={22} />
      </div>

      <StepIndicator step={step} />

      {step === 'request' ? (
        <>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Forgot your password?</h2>
          <p className="mt-1.5 mb-8 text-sm text-slate-500">
            Enter the email address on your account and we'll send a reset code to the phone number on file.
          </p>
        </>
      ) : (
        <>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Set a new password</h2>
          <p className="mt-1.5 mb-8 text-sm text-slate-500">
            If an account exists for <span className="font-medium text-slate-700">{email.trim()}</span>, a 6-digit code
            has been sent to its phone number. The code expires in 15 minutes.
          </p>
        </>
      )}

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

      {step === 'request' ? (
        <form onSubmit={handleRequest} className="space-y-5" noValidate>
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

          <button type="submit" disabled={loading || !email.trim()} className={authPrimaryButtonClass}>
            {loading ? (
              <>
                <LoaderIcon size={18} className="animate-spin" />
                Sending code...
              </>
            ) : (
              'Send reset code'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-5" noValidate>
          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
              Reset code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className={`${authInputClass} px-4 text-center text-lg tracking-[0.5em]`}
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
              New password
            </label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            {passwordTooShort && (
              <p className="mt-1.5 text-xs text-red-600">Password must be at least {MIN_PASSWORD_LENGTH} characters.</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter the new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {passwordsDiffer && <p className="mt-1.5 text-xs text-red-600">Passwords don't match.</p>}
          </div>

          <button type="submit" disabled={loading || !canReset} className={authPrimaryButtonClass}>
            {loading ? (
              <>
                <LoaderIcon size={18} className="animate-spin" />
                Please wait...
              </>
            ) : (
              'Reset password'
            )}
          </button>

          <p className="text-center text-sm text-slate-500">
            Didn't get the code?{' '}
            {resendCooldown > 0 ? (
              <span className="text-slate-400">Resend in {resendCooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resend code
              </button>
            )}
          </p>
        </form>
      )}

      <div className="mt-8 border-t border-slate-100 pt-5 text-center">
        {step === 'reset' ? (
          <button
            type="button"
            onClick={() => {
              setStep('request');
              setError('');
              setNotice('');
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary"
          >
            <ArrowLeftIcon size={15} />
            Use a different email
          </button>
        ) : (
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary">
            <ArrowLeftIcon size={15} />
            Back to sign in
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'request', label: 'Verify email' },
    { key: 'reset', label: 'New password' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <ol className="mb-6 flex items-center gap-3 text-xs font-medium">
      {steps.map((s, index) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
              index <= activeIndex ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {index + 1}
          </span>
          <span className={index <= activeIndex ? 'text-slate-700' : 'text-slate-400'}>{s.label}</span>
          {index < steps.length - 1 && <span className="ml-1 h-px w-8 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}
