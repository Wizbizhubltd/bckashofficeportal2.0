import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboardIcon,
  BanknoteIcon,
  UsersIcon,
  BarChart3Icon,
  ChevronDownIcon,
  XIcon,
  LogOutIcon,
  BuildingIcon,
  UserCogIcon,
  UserPlusIcon,
  UserIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  SettingsIcon,
  BellIcon,
  LucideIcon,
} from 'lucide-react';
import { Logo } from './Logo';
import { ProfileAvatar } from './ProfileAvatar';
import { useAuth } from '../context/AuthContext';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMobileSidebarOpen } from '../store/slices/uiSlice';

/**
 * Sidebar nav is grouped by the same three business modules the backend
 * knows about (`ModuleName` — LOANS/ACCOUNTING/HR, see
 * common/enums/identity.enums.ts on the backend) rather than one flat list.
 * Dashboard, "My Profile" and Settings sit outside every module — they're
 * per-userType concerns, not module concerns (see each section's own
 * comment below). Every route guard here must stay in lockstep with
 * App.tsx's `<RoleRoute allow={...}>` wrapping — a link that renders but
 * 403s/redirects on click is worse than no link at all.
 */

type NavChild = {
  to: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
};

type NavModule = {
  key: string;
  label: string;
  icon: LucideIcon;
  children: NavChild[];
};

export function Sidebar() {
  const dispatch = useAppDispatch();
  const mobileOpen = useAppSelector((state) => state.ui.mobileSidebarOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isAdminLike = isSuperAdmin || isAdmin;
  const isManager = user?.role === 'manager';
  const isApprover = user?.role === 'approver';
  const isMarketer = user?.role === 'marketer';

  // Mirrors App.tsx's ORG_MANAGERS/APPROVAL_ROLES/STAFF_MANAGERS/STAFF_ONBOARDERS.
  const canManageOrg = isAdminLike;
  const canApprove = isSuperAdmin || isAdmin || isApprover;
  // Mirrors App.tsx's branches routes, which are APPROVAL_ROLES-gated (wider
  // than canManageOrg) — Approver can view/approve/delete a branch too.
  const canViewBranches = isAdminLike || isApprover;
  // GET/PATCH /staff/:id are org:manage-gated server-side (ADMIN/SUPERADMIN
  // only) — matches App.tsx's route guard for staff-management exactly.
  const canManageStaff = isAdminLike;
  const canOnboardStaff = isSuperAdmin || isAdmin || isManager;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${isActive ? 'bg-white/10 text-white font-heading font-bold border-l-4 border-accent' : 'text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent'}`;
  const subNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center pl-11 pr-4 py-2 my-1 rounded-lg transition-colors duration-200 text-sm ${isActive ? 'text-white font-heading font-bold' : 'text-accent-400 hover:bg-white/5 hover:text-white font-body'}`;

  // ---------------------------------------------------------------------
  // LOANS module — customer lifecycle + the whole Loan Manager sub-area.
  // ---------------------------------------------------------------------
  const loansModule: NavModule = {
    key: 'loans',
    label: 'Loans',
    icon: BanknoteIcon,
    children: [
      { to: '/customers', label: 'Customers', icon: UsersIcon, visible: true },
      // Managers hold the same initiateCapability(CUSTOMER) as Marketers
      // (see backashbackend's default-role-capabilities.ts MAKER_ENTITY_TYPES
      // comment: "MANAGER: initiates the same as MARKETER").
      { to: '/onboarding/customer', label: 'Customer Onboarding', icon: UserPlusIcon, visible: isMarketer || isManager },
      // { to: '/loan-manager/group-loans', label: 'Group Loans', icon: BanknoteIcon, visible: true },
      { to: '/loan-manager/applications', label: 'Loan Applications', icon: BanknoteIcon, visible: true },
      { to: '/loan-manager/disbursement', label: 'Loan Disbursement', icon: BanknoteIcon, visible: true },
      { to: '/loan-manager/repayment', label: 'Loan Repayment', icon: BanknoteIcon, visible: true },
      { to: '/loan-manager/reports', label: 'Loan Reports', icon: BanknoteIcon, visible: true },
      { to: '/loan-manager/approvals', label: 'Loan Approvals', icon: ShieldCheckIcon, visible: canApprove },
    ],
  };

  // ---------------------------------------------------------------------
  // ACCOUNTING module — branch-level financial operations + FinCon.
  // ---------------------------------------------------------------------
  const accountingModule: NavModule = {
    key: 'accounting',
    label: 'Accounting',
    icon: BarChart3Icon,
    children: [
      { to: '/branches', label: 'Branch Management', icon: BuildingIcon, visible: canViewBranches },
      // A Manager's own branch — funding history/confirmation, disputes, a
      // request to head office, and branch metrics. Never the /branches
      // list above (that's every branch, Admin/SuperAdmin/Approver only).
      { to: '/my-branch', label: 'Branch Management', icon: BuildingIcon, visible: isManager },
      { to: '/fincon', label: 'FinCon', icon: TrendingUpIcon, visible: canManageOrg },
    ],
  };

  // ---------------------------------------------------------------------
  // HR module — staff lifecycle.
  // ---------------------------------------------------------------------
  const hrModule: NavModule = {
    key: 'hr',
    label: 'HR',
    icon: UserCogIcon,
    children: [
      { to: '/onboarding/staff', label: 'Staff Onboarding', icon: UserPlusIcon, visible: canOnboardStaff },
      { to: '/staff-management', label: 'Staff Management', icon: UserCogIcon, visible: canManageStaff },
    ],
  };

  const modules = [loansModule, accountingModule, hrModule]
    .map((module) => ({ ...module, children: module.children.filter((child) => child.visible) }))
    .filter((module) => module.children.length > 0);

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((module) => [module.key, module.children.some((child) => location.pathname.startsWith(child.to))])),
  );

  useEffect(() => {
    modules.forEach((module) => {
      if (module.children.some((child) => location.pathname.startsWith(child.to))) {
        setExpandedModules((prev) => (prev[module.key] ? prev : { ...prev, [module.key]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleModule = (key: string) =>
    setExpandedModules((prev) => ({ ...prev, [key]: !prev[key] }));

  const sidebarContent = (
    <div className="flex flex-col h-full bg-primary text-white w-64 shadow-xl">
      {/* Logo Area */}
      <div className="flex items-center justify-between h-20 px-6 border-b border-white/10">
        <Logo width={140} height={46} />
        <button className="lg:hidden text-gray-300 hover:text-white" onClick={() => dispatch(setMobileSidebarOpen(false))}>
          <XIcon size={24} />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Per-userType, not a module — every role lands here after login (see role.util.ts). */}
        <NavLink to="/dashboard" className={navLinkClasses}>
          <LayoutDashboardIcon size={20} className="mr-3" />
          <span>Dashboard</span>
        </NavLink>

        {modules.map((module) => {
          const isModuleActive = module.children.some((child) => location.pathname.startsWith(child.to));
          const isExpanded = expandedModules[module.key] ?? false;
          const ModuleIcon = module.icon;

          return (
            <div key={module.key}>
              <button
                onClick={() => toggleModule(module.key)}
                className={`w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${isModuleActive ? 'bg-white/5 text-white font-heading font-bold border-l-4 border-accent' : 'text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent'}`}
              >
                <div className="flex items-center">
                  <ModuleIcon size={20} className="mr-3" />
                  <span>{module.label}</span>
                </div>
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDownIcon size={16} />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {module.children.map((child) => (
                      <NavLink key={child.to} to={child.to} className={subNavLinkClasses}>
                        <div className="flex items-center">
                          <child.icon size={14} className="mr-2" />
                          {child.label}
                        </div>
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* General nav, not a module — every role manages their own profile,
            just with different operations available once there (see
            pages/profile/Profile.tsx, which renders the role-specific page). */}
        <NavLink to="/profile" className={navLinkClasses}>
          <UserIcon size={20} className="mr-3" />
          <span>My Profile</span>
        </NavLink>

        {/* SuperAdmin-only full paginated/mark-all-read inbox — every other
            role reaches their own inbox via the Header's bell dropdown
            instead (see App.tsx's SUPER_ADMIN_ONLY route guard). */}
        {isSuperAdmin && (
          <NavLink to="/notifications" className={navLinkClasses}>
            <BellIcon size={20} className="mr-3" />
            <span>Notification Center</span>
          </NavLink>
        )}

        {/* Approver included too — they can't manage most of Settings, but
            they hold approve capability for LOAN_PRODUCT/FEE_DEFINITION
            config proposals and need to reach the Loan Products tab to act
            on them (Settings.tsx itself hides every other tab from them). */}
        {(isAdminLike || isApprover) && (
          <NavLink to="/settings" className={navLinkClasses}>
            <SettingsIcon size={20} className="mr-3" />
            <span>Settings</span>
          </NavLink>
        )}
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-t border-white/10">
        <div
          onClick={handleLogout}
          className="group flex items-center px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <ProfileAvatar
            src={user?.avatar}
            name={user?.name}
            alt="User Avatar"
            className="w-10 h-10 rounded-full border-2 border-white/20"
            iconSize={18}
          />

          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-heading font-bold text-white truncate">{user?.name}</p>
            <p className="text-xs font-body text-gray-400 truncate">{user?.branch}</p>
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
            onClick={() => dispatch(setMobileSidebarOpen(false))}
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
