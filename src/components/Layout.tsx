import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChangePasswordModal } from './ChangePasswordModal';
import { UnauthorizedAlert } from './access/UnauthorizedAlert';
import { BackButton } from './BackButton';
import { useAuth } from '../context/AuthContext';
import { IdleLogout } from './IdleLogout';
import { loadCurrencyDisplay, useCurrencyDisplay } from '../utils/money';

export function Layout() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Subscribed so every page re-renders its amounts when the currency display loads.
  useCurrencyDisplay();

  useEffect(() => {
    if (isAuthenticated) void loadCurrencyDisplay();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen w-full bg-[#f5f7fa] overflow-hidden font-body">
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <div className="max-w-7xl mx-auto">
            <BackButton />
            <UnauthorizedAlert />
            <Outlet />
          </div>
        </main>
      </div>

      {mustChangePassword && <ChangePasswordModal />}
      <IdleLogout />
    </div>
  );
}
