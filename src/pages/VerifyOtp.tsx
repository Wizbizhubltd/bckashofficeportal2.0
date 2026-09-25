import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

// Matches the server's resend cooldown; the server enforces it regardless of this timer.
const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyOtp() {
  const { verifyOtp, resendOtp, pendingChallengeToken } = useAuth();
  const navigate = useNavigate();
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

  if (!pendingChallengeToken) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await verifyOtp(code);
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'An error occurred. Please try again.');
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

  return (
    <div className="min-h-screen flex w-full font-body items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="mb-8 flex justify-center">
          <Logo width={140} height={46} />
        </div>

        <h2 className="text-2xl font-heading font-bold text-primary mb-2 text-center">Verify Your Identity</h2>
        <p className="text-gray-500 mb-8 text-center">Enter the 6-digit code sent to your email and phone on file</p>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircleIcon size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="flex items-center gap-2 p-3 mb-5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle2Icon size={16} className="flex-shrink-0" />
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all tracking-[0.5em] text-center text-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-accent hover:bg-[#e64a19] text-white font-heading font-bold py-3 rounded-lg transition-colors shadow-md mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoaderIcon size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Didn't get the code?{' '}
          {resendCooldown > 0 ? (
            <span className="text-gray-400">Resend in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-medium text-primary hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
        <p className="text-xs text-gray-400 text-center mt-2">The code expires in 5 minutes.</p>
      </div>
    </div>
  );
}
