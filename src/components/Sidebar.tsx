import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboardIcon, ChevronDownIcon, XIcon, LogOutIcon, UserIcon, UserCircleIcon } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { useMe } from '../context/MeContext';
import { useRolePath } from '../hooks/useRolePath';
import { MODULES, ROLE_LABELS, type ModuleKey } from '../config/roles';
import { initials } from '../utils/format';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/** Navigation for the signed-in role: its dashboard, the modules a super admin ticked for it, and the profile. */
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const { user, userType, logout } = useAuth();
  const { me } = useMe();
  const rolePath = useRolePath();
  const [collapsed, setCollapsed] = useState<Partial<Record<ModuleKey, boolean>>>({});

  const displayName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || user?.fullName || me?.email || user?.email || 'Signed in';
  const scopeLabel = me?.zones.length ? me.zones.map((z) => z.name).join(', ') : me?.officeName;

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
        <NavLink to={rolePath()} end className={navLinkClasses} onClick={onMobileClose}>
          <LayoutDashboardIcon size={20} className="mr-3" />
          <span>Dashboard</span>
        </NavLink>

        {(me?.modules ?? []).map((key) => {
          const module = MODULES[key];
          if (!module) return null;
          const expanded = !collapsed[key];

          if (module.links.length === 1) {
            return (
              <NavLink key={key} to={rolePath(module.links[0].path)} className={navLinkClasses} onClick={onMobileClose}>
                <module.icon size={20} className="mr-3" />
                <span>{module.label}</span>
              </NavLink>
            );
          }

          return (
            <div key={key}>
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [key]: expanded }))}
                className="w-full flex items-center justify-between px-4 py-3 my-1 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/5 hover:text-white font-body border-l-4 border-transparent"
              >
                <div className="flex items-center">
                  <module.icon size={20} className="mr-3" />
                  <span>{module.label}</span>
                </div>
                <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDownIcon size={16} />
                </motion.div>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {module.links.map((link) => (
                      <NavLink key={link.path} to={rolePath(link.path)} end className={subNavLinkClasses} onClick={onMobileClose}>
                        {link.label}
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        <NavLink to={rolePath('/profile')} className={navLinkClasses} onClick={onMobileClose}>
          <UserCircleIcon size={20} className="mr-3" />
          <span className="flex-1">My Profile</span>
          {me && !me.profileComplete && <span className="h-2 w-2 rounded-full bg-accent" title="Onboarding details incomplete" />}
        </NavLink>
      </div>

      <div className="p-4 border-t border-white/10">
        <div onClick={handleLogout} className="group flex items-center px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
          <div className="w-10 h-10 flex-shrink-0 rounded-full border-2 border-white/20 bg-white/10 text-white text-sm font-heading font-semibold flex items-center justify-center">
            {initials(displayName) || <UserIcon size={18} />}
          </div>

          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-heading font-bold text-white truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-xs text-white/60 truncate" title={scopeLabel ?? undefined}>
              {[ROLE_LABELS[userType ?? ''], scopeLabel].filter(Boolean).join(' · ')}
            </p>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onMobileClose} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />
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
