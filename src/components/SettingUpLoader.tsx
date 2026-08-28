import { motion } from 'framer-motion';
import { Logo } from './Logo';

/**
 * Full-screen loader shown between a successful OTP verification and
 * actually landing the staff member on their designated route — covers the
 * post-login prefetch (states/departments/branches) so that first screen
 * never renders against half-loaded lookups.
 */
export function SettingUpLoader({ label = 'Setting things up…' }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-primary font-body">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6"
      >
        <Logo width={160} height={54} />

        <div className="relative w-12 h-12">
          <motion.span
            className="absolute inset-0 rounded-full border-4 border-white/20"
          />
          <motion.span
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 0.9 }}
          />
        </div>

        <p className="text-white/80 text-sm font-body tracking-wide">{label}</p>
      </motion.div>
    </div>
  );
}
