import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboardIcon,
  Building2Icon,
  BanknoteIcon,
  GlobeIcon,
  WalletIcon,
  CreditCardIcon,
  ReceiptIcon,
  ListChecksIcon,
  SlidersIcon,
  ChevronDownIcon,
  XIcon,
  LogOutIcon,
  UserIcon,
  UsersIcon,
  HeartHandshakeIcon,
  IdCardIcon,
  BriefcaseIcon,
  Users2Icon,
  LandmarkIcon,
  FileTextIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  ArrowRightLeftIcon,
  LockIcon,
  BarChart3Icon,
  PiggyBankIcon,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';

const ADMIN_LINKS = [
  { to: '/admin/offices', label: 'Offices', icon: Building2Icon },
  { to: '/admin/currencies', label: 'Currencies', icon: BanknoteIcon },
  { to: '/admin/countries', label: 'Countries', icon: GlobeIcon },
  { to: '/admin/funds', label: 'Funds', icon: WalletIcon },
  { to: '/admin/payment-types', label: 'Payment Types', icon: CreditCardIcon },
  { to: '/admin/charges', label: 'Charges', icon: ReceiptIcon },
  { to: '/admin/custom-fields', label: 'Custom Fields', icon: ListChecksIcon },
  { to: '/admin/settings', label: 'Settings', icon: SlidersIcon },
];

const CLIENT_LINKS = [
  { to: '/admin/clients', label: 'Clients', icon: UsersIcon },
  { to: '/admin/client-relationships', label: 'Relationship Types', icon: HeartHandshakeIcon },
  { to: '/admin/client-identification-types', label: 'Identification Types', icon: IdCardIcon },
  { to: '/admin/client-professions', label: 'Professions', icon: BriefcaseIcon },
];

const LOAN_LINKS = [
  { to: '/admin/loan-applications', label: 'Loan Applications', icon: FileTextIcon },
  { to: '/admin/loan-products', label: 'Loan Products', icon: LandmarkIcon },
  { to: '/admin/loan-purposes', label: 'Loan Purposes', icon: ListChecksIcon },
  { to: '/admin/collateral-types', label: 'Collateral Types', icon: ShieldCheckIcon },
];

const SAVINGS_LINKS = [
  { to: '/admin/savings', label: 'Savings Accounts', icon: PiggyBankIcon },
  { to: '/admin/savings-products', label: 'Savings Products', icon: WalletIcon },
];

const GL_LINKS = [
  { to: '/admin/gl/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpenIcon },
  { to: '/admin/gl/journal-entries', label: 'Journal Entries', icon: FileTextIcon },
  { to: '/admin/gl/closures', label: 'Closures', icon: LockIcon },
  { to: '/admin/gl/office-transfers', label: 'Office Transfers', icon: ArrowRightLeftIcon },
  { to: '/admin/gl/reports', label: 'Reports', icon: BarChart3Icon },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const { userId, logout } = useAuth();
  const [adminExpanded, setAdminExpanded] = useState(true);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [loansExpanded, setLoansExpanded] = useState(true);
  const [glExpanded, setGlExpanded] = useState(true);
  const [savingsExpanded, setSavingsExpanded] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${isActive ? 'bg-white/10 text-white font-heading font-bold border-l-4 border-accent' : 'text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent'}`;
  const subNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center pl-11 pr-4 py-2 my-1 rounded-lg transition-colors duration-200 text-sm ${isActive ? 'text-white font-heading font-bold' : 'text-accent-400 hover:bg-white/5 hover:text-white font-body'}`;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-primary text-white w-64 shadow-xl">
      <div className="flex items-center justify-between h-20 px-6 border-b border-white/10">
        <Logo width={140} height={46} />
        <button className="lg:hidden text-gray-300 hover:text-white" onClick={onMobileClose}>
          <XIcon size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <NavLink to="/" end className={navLinkClasses}>
          <LayoutDashboardIcon size={20} className="mr-3" />
          <span>Home</span>
        </NavLink>

        <NavLink to="/admin/groups" className={navLinkClasses}>
          <Users2Icon size={20} className="mr-3" />
          <span>Groups</span>
        </NavLink>

        <div>
          <button
            onClick={() => setClientsExpanded((expanded) => !expanded)}
            className="w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent"
          >
            <div className="flex items-center">
              <UsersIcon size={20} className="mr-3" />
              <span>Client Management</span>
            </div>
            <motion.div animate={{ rotate: clientsExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon size={16} />
            </motion.div>
          </button>

          <AnimatePresence>
            {clientsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {CLIENT_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} className={subNavLinkClasses}>
                    <div className="flex items-center">
                      <link.icon size={14} className="mr-2" />
                      {link.label}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <button
            onClick={() => setLoansExpanded((expanded) => !expanded)}
            className="w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent"
          >
            <div className="flex items-center">
              <LandmarkIcon size={20} className="mr-3" />
              <span>Loans</span>
            </div>
            <motion.div animate={{ rotate: loansExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon size={16} />
            </motion.div>
          </button>

          <AnimatePresence>
            {loansExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {LOAN_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} className={subNavLinkClasses}>
                    <div className="flex items-center">
                      <link.icon size={14} className="mr-2" />
                      {link.label}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <button
            onClick={() => setSavingsExpanded((expanded) => !expanded)}
            className="w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent"
          >
            <div className="flex items-center">
              <PiggyBankIcon size={20} className="mr-3" />
              <span>Savings</span>
            </div>
            <motion.div animate={{ rotate: savingsExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon size={16} />
            </motion.div>
          </button>

          <AnimatePresence>
            {savingsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {SAVINGS_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} className={subNavLinkClasses}>
                    <div className="flex items-center">
                      <link.icon size={14} className="mr-2" />
                      {link.label}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <button
            onClick={() => setGlExpanded((expanded) => !expanded)}
            className="w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent"
          >
            <div className="flex items-center">
              <BookOpenIcon size={20} className="mr-3" />
              <span>General Ledger</span>
            </div>
            <motion.div animate={{ rotate: glExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon size={16} />
            </motion.div>
          </button>

          <AnimatePresence>
            {glExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {GL_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} className={subNavLinkClasses}>
                    <div className="flex items-center">
                      <link.icon size={14} className="mr-2" />
                      {link.label}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <button
            onClick={() => setAdminExpanded((expanded) => !expanded)}
            className="w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent"
          >
            <div className="flex items-center">
              <SlidersIcon size={20} className="mr-3" />
              <span>Organization & Reference Data</span>
            </div>
            <motion.div animate={{ rotate: adminExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon size={16} />
            </motion.div>
          </button>

          <AnimatePresence>
            {adminExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {ADMIN_LINKS.map((link) => (
                  <NavLink key={link.to} to={link.to} className={subNavLinkClasses}>
                    <div className="flex items-center">
                      <link.icon size={14} className="mr-2" />
                      {link.label}
                    </div>
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 border-t border-white/10">
        <div
          onClick={handleLogout}
          className="group flex items-center px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full border-2 border-white/20 bg-white/10 text-gray-300 flex items-center justify-center">
            <UserIcon size={18} />
          </div>

          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-heading font-bold text-white truncate">{userId ?? 'Signed in'}</p>
          </div>
          <span className="w-8 h-8 rounded-full bg-white/10 text-gray-300 flex items-center justify-center group-hover:bg-white/15 group-hover:text-accent transition-colors">
            <LogOutIcon size={16} />
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div
        className={`fixed inset-y-0 left-0 z-50 transform lg:translate-x-0 lg:static lg:flex-shrink-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:transition-none`}
      >
        {sidebarContent}
      </motion.div>
    </>
  );
}
