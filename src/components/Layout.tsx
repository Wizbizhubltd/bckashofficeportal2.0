import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { useAuth } from '../context/AuthContext';
export function Layout() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location
        }}
        replace />);


  }
  return (
    <div className="flex h-screen w-full bg-[#f5f7fa] overflow-hidden font-body">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Blocking — a first-login/temporary password must be changed before
          the rest of the app is usable. See ChangePasswordDialog's own doc comment. */}
      {user?.mustChangePassword && <ChangePasswordDialog />}
    </div>);

}