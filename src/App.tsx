import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { TwoFactor } from './pages/TwoFactor';
import { VerifyOtp } from './pages/VerifyOtp';
import { ForgotPassword } from './pages/ForgotPassword';
import { Home } from './pages/Home';
import { OfficesAdmin } from './pages/admin/OfficesAdmin';
import { CurrenciesAdmin } from './pages/admin/CurrenciesAdmin';
import { CountriesAdmin } from './pages/admin/CountriesAdmin';
import { FundsAdmin } from './pages/admin/FundsAdmin';
import { PaymentTypesAdmin } from './pages/admin/PaymentTypesAdmin';
import { ChargesAdmin } from './pages/admin/ChargesAdmin';
import { CustomFieldsAdmin } from './pages/admin/CustomFieldsAdmin';
import { SettingsAdmin } from './pages/admin/SettingsAdmin';
import { ClientsListPage } from './pages/admin/clients/ClientsListPage';
import { ClientFormPage } from './pages/admin/clients/ClientFormPage';
import { ClientDetailPage } from './pages/admin/clients/ClientDetailPage';
import { ClientRelationshipsAdmin } from './pages/admin/ClientRelationshipsAdmin';
import { ClientIdentificationTypesAdmin } from './pages/admin/ClientIdentificationTypesAdmin';
import { ClientProfessionsAdmin } from './pages/admin/ClientProfessionsAdmin';
import { GroupsListPage } from './pages/admin/groups/GroupsListPage';
import { GroupFormPage } from './pages/admin/groups/GroupFormPage';
import { GroupDetailPage } from './pages/admin/groups/GroupDetailPage';
import { LoanProductsListPage } from './pages/admin/loan-products/LoanProductsListPage';
import { LoanProductFormPage } from './pages/admin/loan-products/LoanProductFormPage';
import { LoanPurposesAdmin } from './pages/admin/LoanPurposesAdmin';
import { CollateralTypesAdmin } from './pages/admin/CollateralTypesAdmin';
import { LoanApplicationsListPage } from './pages/admin/loan-applications/LoanApplicationsListPage';
import { LoanApplicationFormPage } from './pages/admin/loan-applications/LoanApplicationFormPage';
import { LoanApplicationDetailPage } from './pages/admin/loan-applications/LoanApplicationDetailPage';
import { LoanDetailPage } from './pages/admin/loans/LoanDetailPage';
import { ChartOfAccountsPage } from './pages/admin/gl/ChartOfAccountsPage';
import { JournalEntriesPage } from './pages/admin/gl/JournalEntriesPage';
import { ClosuresPage } from './pages/admin/gl/ClosuresPage';
import { OfficeTransfersPage } from './pages/admin/gl/OfficeTransfersPage';
import { ReportsPage } from './pages/admin/gl/ReportsPage';
import { SavingsProductsListPage } from './pages/admin/savings-products/SavingsProductsListPage';
import { SavingsProductFormPage } from './pages/admin/savings-products/SavingsProductFormPage';
import { SavingsAccountsListPage } from './pages/admin/savings/SavingsAccountsListPage';
import { SavingsAccountDetailPage } from './pages/admin/savings/SavingsAccountDetailPage';

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
          <Route path="/2fa" element={<TwoFactor />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />

              <Route path="admin">
                <Route index element={<Navigate to="/admin/offices" replace />} />
                <Route path="offices" element={<OfficesAdmin />} />
                <Route path="currencies" element={<CurrenciesAdmin />} />
                <Route path="countries" element={<CountriesAdmin />} />
                <Route path="funds" element={<FundsAdmin />} />
                <Route path="payment-types" element={<PaymentTypesAdmin />} />
                <Route path="charges" element={<ChargesAdmin />} />
                <Route path="custom-fields" element={<CustomFieldsAdmin />} />
                <Route path="settings" element={<SettingsAdmin />} />
                <Route path="clients">
                  <Route index element={<ClientsListPage />} />
                  <Route path="new" element={<ClientFormPage />} />
                  <Route path=":id" element={<ClientDetailPage />} />
                  <Route path=":id/edit" element={<ClientFormPage />} />
                </Route>
                <Route path="client-relationships" element={<ClientRelationshipsAdmin />} />
                <Route path="client-identification-types" element={<ClientIdentificationTypesAdmin />} />
                <Route path="client-professions" element={<ClientProfessionsAdmin />} />
                <Route path="groups">
                  <Route index element={<GroupsListPage />} />
                  <Route path="new" element={<GroupFormPage />} />
                  <Route path=":id" element={<GroupDetailPage />} />
                  <Route path=":id/edit" element={<GroupFormPage />} />
                </Route>
                <Route path="loan-products">
                  <Route index element={<LoanProductsListPage />} />
                  <Route path="new" element={<LoanProductFormPage />} />
                  <Route path=":id/edit" element={<LoanProductFormPage />} />
                </Route>
                <Route path="loan-purposes" element={<LoanPurposesAdmin />} />
                <Route path="collateral-types" element={<CollateralTypesAdmin />} />
                <Route path="loan-applications">
                  <Route index element={<LoanApplicationsListPage />} />
                  <Route path="new" element={<LoanApplicationFormPage />} />
                  <Route path=":id" element={<LoanApplicationDetailPage />} />
                  <Route path=":id/edit" element={<LoanApplicationFormPage />} />
                </Route>
                <Route path="loans/:id" element={<LoanDetailPage />} />
                <Route path="gl">
                  <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
                  <Route path="journal-entries" element={<JournalEntriesPage />} />
                  <Route path="closures" element={<ClosuresPage />} />
                  <Route path="office-transfers" element={<OfficeTransfersPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                </Route>
                <Route path="savings-products">
                  <Route index element={<SavingsProductsListPage />} />
                  <Route path="new" element={<SavingsProductFormPage />} />
                  <Route path=":id/edit" element={<SavingsProductFormPage />} />
                </Route>
                <Route path="savings">
                  <Route index element={<SavingsAccountsListPage />} />
                  <Route path=":id" element={<SavingsAccountDetailPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
