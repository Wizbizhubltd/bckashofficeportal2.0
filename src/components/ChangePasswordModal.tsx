import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircleIcon, KeyRoundIcon, LoaderIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const MIN_LENGTH = 8;

const inputClass =
  'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all';

/**
 * Shown over the whole app while the user is still on the temporary password they were emailed.
 * It can't be dismissed — the API rejects every other request until the password is changed —
 * but the user can sign out instead.
 */
export function ChangePasswordModal() {
  const { changePassword, logout, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < MIN_LENGTH) {
      setError(`Your new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from your temporary one.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not change your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="w-full max-w-md max-h-full overflow-y-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <KeyRoundIcon size={22} />
        </div>
        <h2 id="change-password-title" className="text-xl font-heading font-bold text-primary mb-1">
          Change your password
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {user?.fullName ? `Welcome, ${user.fullName}. ` : ''}You're signed in with the temporary password that was emailed to you. Choose your own password to continue.
        </p>

        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircleIcon size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
              Temporary password
            </label>
            <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoFocus required />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} required />
            <p className="mt-1 text-xs text-gray-400">At least {MIN_LENGTH} characters.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required />
          </div>

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-accent hover:bg-[#e64a19] text-white font-heading font-bold py-3 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving && <LoaderIcon size={18} className="animate-spin" />}
            {saving ? 'Saving...' : 'Change password'}
          </button>
        </form>

        <button type="button" onClick={signOut} className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-800">
          Sign out instead
        </button>
      </div>
    </div>
  );
}
