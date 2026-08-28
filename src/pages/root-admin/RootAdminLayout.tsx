import { useMemo } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Building2Icon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
} from 'lucide-react';
import { clearRootAdminSession, getRootAdminToken } from '../../services/root-admin/root-admin.service';

export function RootAdminLayout() {
  const navigate = useNavigate();
  const token = useMemo(() => getRootAdminToken(), []);

  if (!token) {
    return <Navigate to="/root-admin/login" replace />;
  }

  const logout = () => {
    clearRootAdminSession();
    navigate('/root-admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-[1500px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="bg-slate-900 text-slate-100 rounded-xl p-4 h-fit lg:sticky lg:top-6">
            <p className="text-xs uppercase tracking-widest text-slate-400">Root Admin</p>
            <h2 className="text-xl font-bold mt-2">Control Panel</h2>

            <nav className="mt-6 space-y-2">
              <NavLink
                to="/root-admin/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                <LayoutDashboardIcon size={16} />
                Dashboard
              </NavLink>

              <NavLink
                to="/root-admin/organisations"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                <Building2Icon size={16} />
                Organisations
              </NavLink>

              <NavLink
                to="/root-admin/settings"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                <SettingsIcon size={16} />
                Settings
              </NavLink>
            </nav>

            <button
              type="button"
              onClick={logout}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-800"
            >
              <LogOutIcon size={16} />
              Logout
            </button>
          </aside>

          <main className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Root Admin Dashboard</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Organizations Control Center</h1>
            </div>

            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
