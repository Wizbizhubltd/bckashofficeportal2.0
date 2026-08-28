import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
  LoaderIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon } from
'lucide-react';
import { useFormik } from 'formik';
import { Logo } from '../components/Logo';
import { env } from '../config/env';
import { authService } from '../services/auth/auth.service';
import { resetPasswordSchema } from '../validators/authSchemas';
export function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as any)?.email || '';
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Redirect if no email in state
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const formik = useFormik({
    initialValues: {
      otp: '',
      newPassword: '',
      confirmPassword: ''
    },
    validationSchema: resetPasswordSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      setError('');
      setLoading(true);

      try {
        if (env.enableMockAuth) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          console.log('[Auth] Password reset:', {
            email,
            otp: values.otp
          });
        } else {
          await authService.resetPassword({
            email,
            code: values.otp,
            newPassword: values.newPassword
          });
        }

        setToast(true);
        setTimeout(() => {
          navigate('/login');
        }, 2500);
      } catch (submitError) {
        setError(
          submitError instanceof Error ?
          submitError.message :
          'Unable to reset password. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    }
  });

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    formik.setFieldValue('otp', newOtp.join(''));
    formik.setFieldTouched('otp', true, false);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }
  function handleOtpKeyDown(
  index: number,
  e: React.KeyboardEvent<HTMLInputElement>)
  {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }
  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.
    getData('text').
    replace(/\D/g, '').
    slice(0, 6);
    if (!pasted.length) return;
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    formik.setFieldValue('otp', newOtp.join(''));
    formik.setFieldTouched('otp', true, false);
    const nextEmpty = newOtp.findIndex((d) => d === '');
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  }

  const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '';
  return (
    <div className="min-h-screen flex w-full font-body">
      {/* Toast */}
      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: '-50%'
          }}
          exit={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-6 py-3.5 rounded-lg shadow-lg flex items-center gap-2.5 text-sm font-body">
          
            <CheckCircleIcon size={18} />
            Password changed successfully! Redirecting to login...
          </motion.div>
        }
      </AnimatePresence>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <Logo width={180} height={60} className="mb-8" />
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              delay: 0.2
            }}>
            
            <h1 className="text-4xl lg:text-5xl font-heading font-bold leading-tight mb-4">
              Reset Your <br />
              <span className="text-accent">Password</span>
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Enter the verification code and set a new secure password for your
              account.
            </p>
          </motion.div>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-white/60">Powered by WizBizHub Limited</p>
        </div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-accent/20 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side - Reset Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.95
          }}
          animate={{
            opacity: 1,
            scale: 1
          }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo width={140} height={46} />
          </div>

          <button
            onClick={() => navigate('/forgot-password')}
            className="flex items-center gap-1.5 text-sm font-body text-gray-500 hover:text-primary transition-colors mb-6">
            
            <ArrowLeftIcon size={14} />
            Back
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LockIcon size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold text-primary">
                Reset Password
              </h2>
              <p className="text-sm text-gray-500">
                Code sent to {maskedEmail}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {error &&
            <motion.div
              initial={{
                opacity: 0,
                y: -8
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              exit={{
                opacity: 0,
                y: -8
              }}
              className="flex items-center gap-2 p-3 mt-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-body">
              
                <AlertCircleIcon size={16} className="flex-shrink-0" />
                {error}
              </motion.div>
            }
          </AnimatePresence>

          <form onSubmit={formik.handleSubmit} className="mt-6 space-y-5" noValidate>
            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <div
                className="flex justify-center gap-2.5"
                onPaste={handleOtpPaste}>
                
                {otp.map((digit, index) =>
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onFocus={(e) => e.target.select()}
                  className={`w-11 h-13 text-center text-lg font-heading font-bold rounded-lg border-2 outline-none transition-all ${digit ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-gray-50 text-gray-800'} focus:border-primary focus:ring-2 focus:ring-primary/20`}
                  disabled={loading || toast} />

                )}
              </div>

              {formik.touched.otp && formik.errors.otp &&
              <p className="text-xs text-red-600 mt-2 text-center">{formik.errors.otp}</p>
              }
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.newPassword}
                  onChange={(e) => {
                    formik.handleChange(e);
                    setError('');
                  }}
                  onBlur={formik.handleBlur}
                  placeholder="10+ characters, upper/lowercase, a number & a symbol"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                  disabled={loading || toast} />
                
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  
                  {showPassword ?
                  <EyeOffIcon size={18} /> :

                  <EyeIcon size={18} />
                  }
                </button>
              </div>
              {formik.touched.newPassword && formik.errors.newPassword ?
              <p className="text-xs text-red-600 mt-1">{formik.errors.newPassword}</p> :
              formik.values.newPassword && formik.values.newPassword.length < 10 &&
              <p className="text-xs text-amber-600 mt-1">
                  Password must be at least 10 characters, with upper/lowercase, a number, and a symbol
                </p>
              }
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={formik.values.confirmPassword}
                  onChange={(e) => {
                    formik.handleChange(e);
                    setError('');
                  }}
                  onBlur={formik.handleBlur}
                  placeholder="Re-enter your new password"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                  disabled={loading || toast} />
                
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  
                  {showConfirm ?
                  <EyeOffIcon size={18} /> :

                  <EyeIcon size={18} />
                  }
                </button>
              </div>
              {formik.touched.confirmPassword && formik.errors.confirmPassword &&
              <p className="text-xs text-red-600 mt-1">
                  {formik.errors.confirmPassword}
                </p>
              }
            </div>

            <button
              type="submit"
              disabled={
              loading ||
              toast ||
              otp.some((d) => d === '') ||
              !formik.isValid
              }
              className="w-full bg-accent hover:bg-[#e64a19] text-white font-heading font-bold py-3 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              
              {loading ?
              <>
                  <LoaderIcon size={18} className="animate-spin" />
                  Resetting Password...
                </> :
              toast ?
              <>
                  <CheckCircleIcon size={18} />
                  Password Changed!
                </> :

              <>
                  <LockIcon size={18} />
                  Reset Password
                </>
              }
            </button>

            {env.enableMockAuth &&
            <p className="text-center text-xs text-gray-400 mt-4">
                Demo: Enter any 6 digits for the code
              </p>
            }
          </form>
        </motion.div>
      </div>
    </div>);

}