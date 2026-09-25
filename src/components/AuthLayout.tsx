import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LockKeyholeIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { Logo } from './Logo';

const HIGHLIGHTS = [
  { icon: UsersIcon, text: 'Group lending built for market associations and cooperatives' },
  { icon: ShieldCheckIcon, text: 'Two-step verification on every sign-in' },
  { icon: LockKeyholeIcon, text: 'One active device per account, so every session is yours' },
];

/** Split-screen frame for the sign-in pages: office photo with brand overlay on the left, form card on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full font-body bg-slate-50">
      <aside className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden text-white">
        <img src="/login-office.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-[#0b2a21]/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          <div className="inline-flex self-start rounded-xl bg-white px-4 py-2 shadow-lg">
            <Logo width={150} height={44} />
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
            <span className="inline-block mb-5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/90 backdrop-blur-sm">
              Office Portal
            </span>
            <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-tight mb-5">
              Empowering communities
              <br />
              <span className="text-accent">through group lending</span>
            </h1>
            <p className="text-lg text-white/80 max-w-lg mb-10">
              Manage clients, groups, loans and savings for BCKash MFB branches across Lagos, all in one place.
            </p>

            <ul className="space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                    <Icon size={18} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="flex items-center justify-between text-xs text-white/60">
            <span>© {new Date().getFullYear()} BCKash Microfinance Bank</span>
            <span>Powered by WizBizHub Limited</span>
          </div>
        </div>
      </aside>

      <main className="flex w-full lg:w-1/2 xl:w-[45%] flex-col items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo width={150} height={48} />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)]">
            {children}
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <LockKeyholeIcon size={12} />
            Secured connection · Authorized staff only
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export const authInputClass =
  'w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10';

export const authPrimaryButtonClass =
  'w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-heading text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-[#144536] disabled:cursor-not-allowed disabled:opacity-60';
