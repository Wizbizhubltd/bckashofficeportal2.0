import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, LoaderIcon } from 'lucide-react';
import { useFormik } from 'formik';
import { Logo } from '../components/Logo';
import { env } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../validators/authSchemas';
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: '',
      password: ''
    },
    validationSchema: loginSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      setError('');
      setLoading(true);

      try {
        // Every login goes through an OTP challenge — see POST /auth/login
        // on the backend, which never returns tokens directly.
        await login(values.email, values.password);
        navigate('/verify-otp');
      } catch (submitError) {
        setError(
          submitError instanceof Error ?
          submitError.message :
          'An error occurred. Please try again.'
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
              Empowering Communities <br />
              <span className="text-accent">Through Group Lending</span>
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              BCKash Cooperative provides seamless financial access to market groups and
              cooperatives across Lagos.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-white/60">Powered by WizBizHub Limited</p>
        </div>

        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-accent/20 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side - Login Form */}
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

          <h2 className="text-2xl font-heading font-bold text-primary mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-500 mb-8">
            Sign in to access the BCKash Portal
          </p>

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
            className="flex items-center gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-body">
            
              <AlertCircleIcon size={16} className="flex-shrink-0" />
              {error}
            </motion.div>
          }

          <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required />

              {formik.touched.email && formik.errors.email &&
              <p className="text-xs text-red-600 mt-1">{formik.errors.email}</p>
              }
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>

                  {showPassword ?
                  <EyeOffIcon size={18} /> :

                  <EyeIcon size={18} />
                  }
                </button>
              </div>

              {formik.touched.password && formik.errors.password &&
              <p className="text-xs text-red-600 mt-1">{formik.errors.password}</p>
              }
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-2 rounded text-primary focus:ring-primary" />
                
                Remember me
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-primary hover:text-primary/80 font-medium">
                
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !formik.isValid}
              className="w-full bg-accent hover:bg-[#e64a19] text-white font-heading font-bold py-3 rounded-lg transition-colors shadow-md mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              
              {loading ?
              <>
                  <LoaderIcon size={18} className="animate-spin" />
                  Signing In...
                </> :

              'Sign In'
              }
            </button>

            {env.enableMockAuth &&
            <p className="text-center text-xs text-gray-400 mt-4">
                Demo accounts: admin@bckash.com · admin.staff@bckash.com ·
                manager.ikeja@bckash.com · approver@bckash.com ·
                marketer@bckash.com
                <br />
                Password: password123 · OTP: 123456
              </p>
            }
          </form>
        </motion.div>
      </div>
    </div>);

}