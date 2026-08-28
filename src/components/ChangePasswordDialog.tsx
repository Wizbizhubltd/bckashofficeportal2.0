import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, LoaderIcon } from 'lucide-react';
import { useFormik } from 'formik';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth/auth.service';
import { changePasswordSchema } from '../validators/authSchemas';

/**
 * Forced, non-dismissable password-change prompt — shown by Layout whenever
 * `user.mustChangePassword` is true (every new staff member starts with a
 * system-generated temporary password; see AuthenticatedUserDetails on the
 * backend). Deliberately has no close/backdrop-dismiss: the only way out is
 * a successful POST /auth/change-password, after which the session is
 * revoked and the staff member is sent back to /login to sign in with the
 * password they just set — see AuthController.changePassword's own doc
 * comment ("revokes every outstanding refresh token on success").
 */
export function ChangePasswordDialog() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: changePasswordSchema,
    validateOnMount: true,
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
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'Unable to change password. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-body">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRoundIcon size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold text-primary">Set a New Password</h2>
            <p className="text-sm text-gray-500">
              You're using a temporary password — set your own to continue.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 p-3 mt-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-body"
            >
              <AlertCircleIcon size={16} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={formik.handleSubmit} className="mt-6 space-y-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={formik.values.currentPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {formik.touched.currentPassword && formik.errors.currentPassword && (
              <p className="text-xs text-red-600 mt-1">{formik.errors.currentPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                value={formik.values.newPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="10+ characters, upper/lowercase, a number & a symbol"
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {formik.touched.newPassword && formik.errors.newPassword && (
              <p className="text-xs text-red-600 mt-1">{formik.errors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {formik.touched.confirmPassword && formik.errors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">{formik.errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !formik.isValid}
            className="w-full bg-accent hover:bg-[#e64a19] text-white font-heading font-bold py-3 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoaderIcon size={18} className="animate-spin" />
                Updating Password...
              </>
            ) : (
              'Update Password & Log In Again'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
