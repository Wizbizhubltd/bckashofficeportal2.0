import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { RoleRoute } from './components/RoleRoute';
import { roleHomeRoute } from './services/auth/role.util';
import { Login } from './pages/Login';
import { VerifyOtp } from './pages/VerifyOtp';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { BranchManagement } from './pages/BranchManagement';
import { BranchDetail } from './pages/branches/BranchDetail';
import { BranchProposalDetail } from './pages/branches/BranchProposalDetail';
import { MyBranch } from './pages/branches/MyBranch';
import { Customers } from './pages/Customers';
import { CustomerDetail } from './pages/customers/CustomerDetail';
import { GroupDetail } from './pages/customers/GroupDetail';
import { GroupProposalDetail } from './pages/customers/GroupProposalDetail';
import { CustomerPrintPage } from './pages/customers/CustomerPrintPage';
import { StaffOnboarding } from './pages/onboarding/StaffOnboarding';
import { CustomerOnboarding } from './pages/onboarding/CustomerOnboarding';
import { GroupLoans } from './pages/loan-manager/GroupLoans';
import { LoanApplications } from './pages/loan-manager/LoanApplications';
import { LoanDisbursement } from './pages/loan-manager/LoanDisbursement';
import { LoanRepayment } from './pages/loan-manager/LoanRepayment';
import { LoanReports } from './pages/loan-manager/LoanReports';
import { LoanApprovals } from './pages/loan-manager/LoanApprovals';
import { LoanDetail } from './pages/loan-manager/LoanDetail';
import { HrManager } from './pages/HrManager';
import { Profile } from './pages/profile/Profile';
import { StaffDetail } from './pages/staff/StaffDetail';
import { NotificationCenter } from './pages/notifications/NotificationCenter';
import { FinCon } from './pages/FinCon';
import { Settings } from './pages/Settings';
import { RootAdminLogin } from './pages/root-admin/RootAdminLogin';
import { RootAdminHome } from './pages/root-admin/RootAdminHome';
import { RootAdminLayout } from './pages/root-admin/RootAdminLayout';
import { RootAdminOrganisations } from './pages/root-admin/RootAdminOrganisations';
import { RootAdminSettings } from './pages/root-admin/RootAdminSettings';
import { Toaster } from 'react-hot-toast';

// Every staff role — a route with no <RoleRoute> guard above it is reachable
// by all five once authenticated (Layout itself already requires a session).
const ORG_MANAGERS = ['super_admin', 'admin'] as const;
// Wider than ORG_MANAGERS on purpose: Approver holds approveCapability for
// every workflow entity type, including LOAN_PRODUCT/FEE_DEFINITION config
// proposals — they need to reach Settings to review/act on those, even
// though the rest of Settings' tabs (Organisation, Departments, ...) still
// only mean anything to Admin/SuperAdmin. Settings.tsx itself further
// restricts which *tabs* an Approver actually sees.
const SETTINGS_ROLES = ['super_admin', 'admin', 'approver'] as const;
const APPROVAL_ROLES = ['super_admin', 'admin', 'approver'] as const;
const STAFF_ONBOARDERS = ['super_admin', 'admin', 'manager'] as const;
const BRANCH_MANAGERS = ['manager'] as const;
// The Notification Center's full paginated/mark-all-read view — every other
// role reaches their own inbox via the Header's bell dropdown instead (see
// Header.tsx), which needs no dedicated route/guard of its own.
const SUPER_ADMIN_ONLY = ['super_admin'] as const;

function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={roleHomeRoute(user?.role)} replace />;
}

export function App() {
  return (
    <AuthProvider>
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
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/customers/:id/print" element={<CustomerPrintPage />} />

          <Route path="/root-admin/login" element={<RootAdminLogin />} />
          <Route path="/root-admin" element={<RootAdminLayout />}>
            <Route index element={<Navigate to="/root-admin/dashboard" replace />} />
            <Route path="dashboard" element={<RootAdminHome />} />
            <Route path="organisations" element={<RootAdminOrganisations />} />
            <Route path="settings" element={<RootAdminSettings />} />
          </Route>

          {/*
            One shared route tree for every staff role — no more per-role URL
            prefixes. Each section is wrapped in a <RoleRoute allow={[...]}>
            guard; visiting a route your role isn't in redirects you to your
            own designated home instead of rendering the page.
          */}
          <Route path="/" element={<Layout />}>
            <Route index element={<RoleHomeRedirect />} />

            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            {/* Declared before the dynamic :groupId route below — a literal "requests" segment must precede a dynamic single-segment one, same convention used elsewhere in this codebase. */}
            <Route path="customers/groups/requests/:workflowRequestId" element={<GroupProposalDetail />} />
            <Route path="customers/groups/:groupId" element={<GroupDetail />} />
            <Route path="onboarding/customer" element={<CustomerOnboarding />} />
            {/* Every role — Profile.tsx dispatches to the role-specific page internally. */}
            <Route path="profile" element={<Profile />} />

            <Route path="loan-manager">
              <Route path="group-loans" element={<GroupLoans />} />
              <Route path="applications" element={<LoanApplications />} />
              <Route path="disbursement" element={<LoanDisbursement />} />
              <Route path="repayment" element={<LoanRepayment />} />
              <Route path="reports" element={<LoanReports />} />
              <Route path="loans/:id" element={<LoanDetail />} />

              <Route element={<RoleRoute allow={APPROVAL_ROLES} />}>
                <Route path="approvals" element={<LoanApprovals />} />
              </Route>
            </Route>

            {/* Wider than ORG_MANAGERS below: Approver holds approve:BRANCH
                (and initiate:BRANCH) server-side — can view branches and
                hard-delete a not-yet-approved/inactive one, same as
                Admin/SuperAdmin. Approver still lacks org:manage, so
                BranchManagement/BranchDetail themselves hide the
                create/edit affordances for that role. */}
            <Route element={<RoleRoute allow={APPROVAL_ROLES} />}>
              <Route path="branches" element={<BranchManagement />} />
              {/* Declared before the dynamic :id route below — a literal "requests" segment must precede a dynamic single-segment one, same convention used elsewhere in this codebase. */}
              <Route path="branches/requests/:workflowRequestId" element={<BranchProposalDetail />} />
              <Route path="branches/:id" element={<BranchDetail />} />
            </Route>

            {/* A Manager's own branch — see Sidebar.tsx/MyBranch.tsx's own comments. */}
            <Route element={<RoleRoute allow={BRANCH_MANAGERS} />}>
              <Route path="my-branch" element={<MyBranch />} />
            </Route>

            <Route element={<RoleRoute allow={ORG_MANAGERS} />}>
              <Route path="fincon" element={<FinCon />} />
              {/* GET/PATCH /staff/:id (and the list) are org:manage-gated
                  server-side (ADMIN/SUPERADMIN only) — a Manager guarded in
                  here would just 403 on load, so this matches the backend
                  exactly rather than STAFF_ONBOARDERS' wider set below. */}
              <Route path="staff-management" element={<HrManager />} />
              <Route path="staff-management/:id" element={<StaffDetail />} />
            </Route>

            <Route element={<RoleRoute allow={SETTINGS_ROLES} />}>
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route element={<RoleRoute allow={STAFF_ONBOARDERS} />}>
              <Route path="onboarding/staff" element={<StaffOnboarding />} />
            </Route>

            <Route element={<RoleRoute allow={SUPER_ADMIN_ONLY} />}>
              <Route path="notifications" element={<NotificationCenter />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
