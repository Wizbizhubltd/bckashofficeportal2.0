import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircleIcon, CheckIcon, KeyRoundIcon, LoaderIcon, LogOutIcon } from 'lucide-react';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { authPrimaryButtonClass } from './AuthLayout';
import { PasswordInput } from './PasswordInput';

const MIN_LENGTH = 8;

/**
 * Shown over the whole app while the user is still on the temporary password they were emailed.
 * It can't be dismissed — the API rejects every other request until the password is changed —
 * but the user can sign out instead. A successful change signs the user out so they sign back
 * in with the new password.
 */
export function ChangePasswordModal() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const rules = [
    { met: newPassword.length >= MIN_LENGTH, label: `At least ${MIN_LENGTH} characters` },
    { met: newPassword.length > 0 && newPassword !== currentPassword, label: 'Different from your temporary password' },
    { met: confirmPassword.length > 0 && newPassword === confirmPassword, label: 'Both new passwords match' },
  ];
  const canSubmit = !!currentPassword && rules.every((rule) => rule.met);

  const signOutTo = (notice?: string) => {
    logout();
    navigate('/login', { replace: true, state: notice ? { notice } : undefined });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSaving(true);

    try {
      // Called directly rather than through the auth context: the fresh tokens it returns are
      // discarded, since the user signs in again with the new password.
      await authApi.changePassword(currentPassword, newPassword);
      signOutTo('Your password has been changed. Sign in with your new password.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not change your password. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-primary via-primary to-accent" />
        <div className="p-6 sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#0f3a2d] text-white shadow-lg shadow-primary/25">
            <KeyRoundIcon size={22} />
          </div>
          <h2 id="change-password-title" className="font-heading text-xl font-bold text-slate-900">
            Set your own password
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-slate-500">
            {user?.fullName ? `Welcome, ${user.fullName}. ` : ''}You signed in with a temporary password. Choose a new
            one to continue. You'll be signed out afterwards so you can sign in with it.
          </p>

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Temporary password
              </label>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                placeholder="From your welcome email"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                New password
              </label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder={`At least ${MIN_LENGTH} characters`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <ul className="space-y-1.5 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200/70">
              {rules.map((rule) => (
                <li key={rule.label} className={`flex items-center gap-2 text-xs ${rule.met ? 'text-green-700' : 'text-slate-500'}`}>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      rule.met ? 'bg-green-600 text-white' : 'border border-slate-300 bg-white'
                    }`}
                  >
                    {rule.met && <CheckIcon size={11} strokeWidth={3} />}
                  </span>
                  {rule.label}
                </li>
              ))}
            </ul>

            <button type="submit" disabled={saving || !canSubmit} className={`${authPrimaryButtonClass} mt-2`}>
              {saving ? (
                <>
                  <LoaderIcon size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Change password'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => signOutTo()}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <LogOutIcon size={14} />
            Sign out instead
          </button>
        </div>
      </motion.div>
    </div>
  );
}
