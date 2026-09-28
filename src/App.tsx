import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { MeProvider } from './context/MeContext';
import { Layout } from './components/Layout';
import { HomeRedirect, RoleGate } from './components/access/RoleGate';
import { ModuleGate } from './components/access/ModuleGate';
import { OFFICE_ROLES, type OfficeRole } from './config/roles';
import { Login } from './pages/Login';
import { TwoFactor } from './pages/TwoFactor';
import { VerifyOtp } from './pages/VerifyOtp';
import { ForgotPassword } from './pages/ForgotPassword';
import { MarketerDashboard } from './pages/dashboard/MarketerDashboard';
import { ManagerDashboard } from './pages/dashboard/ManagerDashboard';
import { ControllerDashboard } from './pages/dashboard/ControllerDashboard';
import { DirectorDashboard } from './pages/dashboard/DirectorDashboard';
import { ProfilePage } from './pages/profile/ProfilePage';
import { MyOfficesPage } from './pages/offices/MyOfficesPage';
import { OfficeOverviewPage } from './pages/offices/OfficeOverviewPage';
import { StaffListPage } from './pages/staff/StaffListPage';
import { StaffFormPage } from './pages/staff/StaffFormPage';
import { StaffDetailPage } from './pages/staff/StaffDetailPage';
import { ClientsListPage } from './pages/admin/clients/ClientsListPage';
import { ClientFormPage } from './pages/admin/clients/ClientFormPage';
import { ClientDetailPage } from './pages/admin/clients/ClientDetailPage';
import { GroupsListPage } from './pages/admin/groups/GroupsListPage';
import { GroupFormPage } from './pages/admin/groups/GroupFormPage';
import { GroupDetailPage } from './pages/admin/groups/GroupDetailPage';
import { LoanApplicationsListPage } from './pages/admin/loan-applications/LoanApplicationsListPage';
import { LoanApplicationFormPage } from './pages/admin/loan-applications/LoanApplicationFormPage';
import { LoanApplicationDetailPage } from './pages/admin/loan-applications/LoanApplicationDetailPage';
import { LoanDetailPage } from './pages/admin/loans/LoanDetailPage';

const DASHBOARDS: Record<OfficeRole, ReactElement> = {
  director: <DirectorDashboard />,
  controller: <ControllerDashboard />,
  manager: <ManagerDashboard />,
  marketer: <MarketerDashboard />,
};

/**
 * One route tree per role — /director, /controller, /manager, /marketer — each with its own
 * dashboard and profile. The modules inside are the same screens for every role, opened only when a
 * super admin has ticked that module for the role (ModuleGate); the API limits what each one shows to
 * the user's own office(s) and what it lets them do to their permissions.
 */
function roleRoutes(role: OfficeRole) {
  return (
    <Route key={role} path={role} element={<RoleGate role={role} />}>
      <Route element={<Layout />}>
        <Route index element={DASHBOARDS[role]} />
        <Route path="profile" element={<ProfilePage />} />

        <Route element={<ModuleGate module="offices" />}>
          <Route path="offices" element={<MyOfficesPage />} />
          <Route path="offices/:id" element={<OfficeOverviewPage />} />
        </Route>

        <Route element={<ModuleGate module="staff" />}>
          <Route path="staff" element={<StaffListPage />} />
          <Route path="staff/new" element={<StaffFormPage />} />
          <Route path="staff/:id" element={<StaffDetailPage />} />
        </Route>

        <Route element={<ModuleGate module="clients" />}>
          <Route path="clients" element={<ClientsListPage />} />
          <Route path="clients/new" element={<ClientFormPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="clients/:id/edit" element={<ClientFormPage />} />
          <Route path="groups" element={<GroupsListPage />} />
          <Route path="groups/new" element={<GroupFormPage />} />
          <Route path="groups/:id" element={<GroupDetailPage />} />
          <Route path="groups/:id/edit" element={<GroupFormPage />} />
        </Route>

        <Route element={<ModuleGate module="loans" />}>
          <Route path="loan-applications" element={<LoanApplicationsListPage />} />
          <Route path="loan-applications/new" element={<LoanApplicationFormPage />} />
          <Route path="loan-applications/:id" element={<LoanApplicationDetailPage />} />
          <Route path="loan-applications/:id/edit" element={<LoanApplicationFormPage />} />
          <Route path="loans/:id" element={<LoanDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to={`/${role}`} replace />} />
      </Route>
    </Route>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '8px',
              background: '#1F2937',
              color: '#fff',
              fontSize: '13px',
            },
          }}
        />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/2fa" element={<TwoFactor />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {OFFICE_ROLES.map(roleRoutes)}

            {/* "/", and any other address (including the retired /admin/... ones), goes to the user's own dashboard. */}
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </MeProvider>
    </AuthProvider>
  );
}
