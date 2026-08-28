import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MailIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
  LoaderIcon,
  SendIcon } from
'lucide-react';
import { useFormik } from 'formik';
import { Logo } from '../components/Logo';
import { env } from '../config/env';
import { authService } from '../services/auth/auth.service';
import { forgotPasswordSchema } from '../validators/authSchemas';
export function ForgotPassword() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const validEmails = [
  'admin@bckash.com',
  'admin.staff@bckash.com',
  'manager.ikeja@bckash.com',
  'approver@bckash.com',
  'marketer@bckash.com'];

  const formik = useFormik({
    initialValues: {
      email: ''
    },
    validationSchema: forgotPasswordSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      setError('');
      setLoading(true);

      const normalizedEmail = values.email.toLowerCase();

      try {
        if (env.enableMockAuth) {
          await new Promise((resolve) => setTimeout(resolve, 1200));

          if (!validEmails.includes(normalizedEmail)) {
            setError('No account found with this email address.');
            return;
          }

          console.log('[Auth] Password reset OTP sent to:', values.email);
        } else {
          await authService.forgotPassword({
            email: normalizedEmail
          });
        }

        navigate('/reset-password', {
          state: {
            email: normalizedEmail
          }
        });
      } catch (submitError) {
        setError(
          submitError instanceof Error ?
          submitError.message :
          'Unable to send reset code. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <div className="min-h-screen flex w-full font-body">
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
              Account <br />
              <span className="text-accent">Recovery</span>
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Don't worry — we'll send you a one-time code to reset your
              password and get you back in.
            </p>
          </motion.div>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-white/60">Powered by WizBizHub Limited</p>
        </div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-accent/20 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side - Form */}
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
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 text-sm font-body text-gray-500 hover:text-primary transition-colors mb-6">
            
            <ArrowLeftIcon size={14} />
            Back to Login
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <MailIcon size={24} className="text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold text-primary">
                Forgot Password
              </h2>
              <p className="text-sm text-gray-500">
                Enter your email to receive a reset code
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

          <form onSubmit={formik.handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formik.values.email}
                onChange={(e) => {
                  formik.handleChange(e);
                  setError('');
                }}
                onBlur={formik.handleBlur}
                placeholder="Enter your registered email"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required />

              {formik.touched.email && formik.errors.email &&
              <p className="text-xs text-red-600 mt-1">{formik.errors.email}</p>
              }

              <p className="text-xs text-gray-400 mt-1.5">
                We'll send a 6-digit verification code to this email
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !formik.isValid}
              className="w-full bg-accent hover:bg-[#e64a19] text-white font-heading font-bold py-3 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              
              {loading ?
              <>
                  <LoaderIcon size={18} className="animate-spin" />
                  Sending Code...
                </> :

              <>
                  <SendIcon size={18} />
                  Send Reset Code
                </>
              }
            </button>

            {env.enableMockAuth &&
            <p className="text-center text-xs text-gray-400 mt-4">
                Demo emails: admin@bckash.com · admin.staff@bckash.com ·
                manager.ikeja@bckash.com · approver@bckash.com ·
                marketer@bckash.com
              </p>
            }
          </form>
        </motion.div>
      </div>
    </div>);

}