import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import toast from 'react-hot-toast';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth/auth.service';
import { changePasswordSchema } from '../../validators/authSchemas';

/**
 * Voluntary password change from the profile page — same
 * POST /auth/change-password as the forced ChangePasswordDialog, but opened
 * by choice rather than blocking the app. The backend revokes every
 * outstanding refresh token on success either way, so this also ends in a
 * logout — there's no session left worth keeping once the password moves.
 */
export function ProfileChangePasswordCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formik = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validationSchema: changePasswordSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      setError('');
      setLoading(true);
      try {
        await authService.changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        });
        toast.success('Password changed. Please log in again with your new password.');
        logout();
        navigate('/login', { replace: true });
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Unable to change password. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <KeyRoundIcon size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-primary">Change Password</h3>
          <p className="text-xs text-gray-500">You'll be signed out afterwards and asked to log in again.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircleIcon size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        {(
          [
            { name: 'currentPassword', label: 'Current Password', show: showCurrent, setShow: setShowCurrent },
            { name: 'newPassword', label: 'New Password', show: showNew, setShow: setShowNew },
            { name: 'confirmPassword', label: 'Confirm New Password', show: showConfirm, setShow: setShowConfirm },
          ] as const
        ).map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <div className="relative">
              <input
                name={field.name}
                type={field.show ? 'text' : 'password'}
                value={formik.values[field.name]}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="off"
                disabled={loading}
                className="w-full px-4 py-2 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-500"
              />
              <button
                type="button"
                onClick={() => field.setShow((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={field.show ? 'Hide password' : 'Show password'}
              >
                {field.show ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
            {formik.touched[field.name] && formik.errors[field.name] && (
              <p className="text-xs text-red-600 mt-1">{formik.errors[field.name]}</p>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white font-heading font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {loading && <LoaderIcon size={16} className="animate-spin" />}
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
