import React, { useEffect, useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingIcon,
  BanknoteIcon,
  GitBranchIcon,
  ShieldCheckIcon,
  BellIcon,
  SaveIcon,
  PencilIcon,
  SettingsIcon,
  UsersIcon,
  PackageIcon,
  ReceiptIcon,
  ShieldIcon,
  XIcon } from
'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { organisationService, type Organisation } from '../services/organisation/organisation.service';
import { DepartmentsRoles } from './settings/DepartmentsRoles';
import { LoanProductsCrud } from './settings/LoanProductsCrud';
import { FeeConfiguration } from './settings/FeeConfiguration';
import { LoanConfigurationPanel } from './settings/LoanConfigurationPanel';
import { RepaymentPenaltyPanel } from './settings/RepaymentPenaltyPanel';
import { BranchRulesPanel } from './settings/BranchRulesPanel';
import { RbacManagement } from './settings/RbacManagement';
// ─── Shared Helpers ─────────────────────────────────────────────
function Toggle({
  enabled,
  onToggle



}: {enabled: boolean;onToggle: () => void;}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 ${enabled ? 'bg-primary' : 'bg-gray-300'}`}>
      
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      
    </button>);

}
function InputField({
  label,
  value,
  onChange,
  type = 'text',
  prefix,
  suffix







}: {label: string;value: string | number;onChange: (val: string) => void;type?: string;prefix?: string;suffix?: string;}) {
  return (
    <div>
      <label className="block text-sm font-body font-medium text-gray-600 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {prefix &&
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-body">
            {prefix}
          </span>
        }
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`} />
        
        {suffix &&
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-body">
            {suffix}
          </span>
        }
      </div>
    </div>);

}
// ─── Tab Definitions ────────────────────────────────────────────
type TabKey =
'organisation' |
'departments' |
'rbac' |
'loan-products' |
'fees' |
'loan-rules' |
'branch-rules' |
'kyc' |
'notifications';
const settingsTabs: {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}[] = [
{
  key: 'organisation',
  label: 'Organisation',
  icon: <BuildingIcon size={18} />
},
{
  key: 'departments',
  label: 'Departments & Roles',
  icon: <UsersIcon size={18} />
},
{
  key: 'rbac',
  label: 'RBAC',
  icon: <ShieldIcon size={18} />
},
{
  key: 'loan-products',
  label: 'Loan Products',
  icon: <PackageIcon size={18} />
},
{
  key: 'fees',
  label: 'Fee Configuration',
  icon: <ReceiptIcon size={18} />
},
{
  key: 'loan-rules',
  label: 'Loan Rules',
  icon: <BanknoteIcon size={18} />
},
{
  key: 'branch-rules',
  label: 'Branch Rules',
  icon: <GitBranchIcon size={18} />
},
{
  key: 'kyc',
  label: 'KYC & Verification',
  icon: <ShieldCheckIcon size={18} />
},
{
  key: 'notifications',
  label: 'Notifications',
  icon: <BellIcon size={18} />
}];

type OrgFormValues = {
  nameOfOrg: string;
  address: string;
  phoneNumbers: string[];
  organisationAccountDetails: { bankName: string; accountNumber: string; accountName: string }[];
  briefHistory: string;
  businessRegNumber: string;
  cbnLicenseNumber: string;
  contactEmail: string;
};

const EMPTY_ORG_FORM: OrgFormValues = {
  nameOfOrg: '',
  address: '',
  phoneNumbers: [''],
  organisationAccountDetails: [{ bankName: '', accountNumber: '', accountName: '' }],
  briefHistory: '',
  businessRegNumber: '',
  cbnLicenseNumber: '',
  contactEmail: '',
};

function toOrgFormValues(org: Organisation): OrgFormValues {
  return {
    nameOfOrg: org.nameOfOrg,
    address: org.address,
    phoneNumbers: org.phoneNumbers.length > 0 ? [...org.phoneNumbers] : [''],
    organisationAccountDetails:
      org.organisationAccountDetails.length > 0
        ? org.organisationAccountDetails.map((detail) => ({ ...detail }))
        : [{ bankName: '', accountNumber: '', accountName: '' }],
    briefHistory: org.briefHistory,
    businessRegNumber: org.businessRegNumber,
    cbnLicenseNumber: org.cbnLicenseNumber ?? '',
    contactEmail: org.contactEmail ?? '',
  };
}

// ─── Main Component ─────────────────────────────────────────────
export function Settings() {
  const { user } = useAuth();
  // Approver only holds approveCapability — they can't manage Organisation/
  // Departments/KYC/Notifications, but they DO need to reach every tab
  // backed by a workflow-mediated entity they can approve: LOAN_PRODUCT,
  // FEE_DEFINITION, and (as of platform-config) LOAN_CONFIG/
  // REPAYMENT_PENALTY_CONFIG/BRANCH_RULES_CONFIG — see App.tsx's
  // SETTINGS_ROLES, which is why an Approver reaches this page at all.
  const isApproverOnly = user?.role === 'approver';
  const APPROVER_VISIBLE_TABS: readonly TabKey[] = ['loan-products', 'fees', 'loan-rules', 'branch-rules'];
  // RBAC tab: every route under it requires the `rbac:manage` capability,
  // which only SUPERADMIN holds in the default seed (see
  // default-role-capabilities.ts) — hidden from everyone else rather than
  // shown and then 403ing on every action.
  const isSuperAdmin = user?.role === 'super_admin';
  const visibleSettingsTabs = (isApproverOnly
    ? settingsTabs.filter((tab) => APPROVER_VISIBLE_TABS.includes(tab.key))
    : settingsTabs
  ).filter((tab) => tab.key !== 'rbac' || isSuperAdmin);

  const [activeTab, setActiveTab] = useState<TabKey>(isApproverOnly ? 'loan-products' : 'organisation');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [isSavingOrgProfile, setIsSavingOrgProfile] = useState(false);
  const [orgProfileBanner, setOrgProfileBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  // Organisation Profile — a real platform-level singleton (see
  // services/organisation), not a mock. 404 ("missing") is an expected,
  // routine state before anyone has set it up, not an error.
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [orgStatus, setOrgStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);
  const [deleteOrgConfirmOpen, setDeleteOrgConfirmOpen] = useState(false);
  const [orgForm, setOrgForm] = useState<OrgFormValues>(EMPTY_ORG_FORM);
  // Loan Configuration / Repayment & Penalties / Branch Rules are real,
  // workflow-mediated, versioned records now (see modules/platform-config on
  // the backend) — LoanConfigurationPanel/RepaymentPenaltyPanel/
  // BranchRulesPanel below own their own state entirely, no local mock state
  // left here for them.
  // KYC & Verification
  const [kyc, setKyc] = useState({
    bvnRequired: true,
    biometricRequired: true,
    requiredDocs: {
      nin: true,
      utilityBill: true,
      passportPhoto: true,
      bankStatement: false
    },
    minimumAge: '18'
  });
  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: true,
    loanApprovalAlerts: true,
    repaymentReminderDays: '3'
  });
  useEffect(() => {
    let isMounted = true;

    const loadOrganisation = async () => {
      setOrgStatus('loading');
      try {
        const org = await organisationService.get();
        if (!isMounted) {
          return;
        }
        setOrganisation(org);
        setOrgStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        // A 404 here means "nobody has set this up yet" — an expected,
        // routine state (see organisationService.get's own doc comment),
        // not a load failure worth an error banner.
        if ((error as { status?: number })?.status === 404) {
          setOrganisation(null);
          setOrgStatus('missing');
          return;
        }
        setOrgStatus('error');
        setOrgProfileBanner({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unable to load the organisation profile.',
        });
      }
    };

    void loadOrganisation();

    return () => {
      isMounted = false;
    };
  }, []);


  useEffect(() => {
    if (!orgProfileBanner || orgProfileBanner.type !== 'success') {
      return;
    }

    const timeoutId = setTimeout(() => {
      setOrgProfileBanner((current) => (current?.type === 'success' ? null : current));
    }, 3500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [orgProfileBanner]);

  /**
   * Shared by create and update — validates + normalizes the form, returns
   * `null` (and sets an error banner) if it's incomplete rather than
   * letting the backend's 400 be the first the operator hears of it.
   */
  const buildOrganisationPayload = () => {
    const nameOfOrg = orgForm.nameOfOrg.trim();
    const address = orgForm.address.trim();
    const businessRegNumber = orgForm.businessRegNumber.trim();
    const briefHistory = orgForm.briefHistory.trim();
    const phoneNumbers = orgForm.phoneNumbers.map((phone) => phone.trim()).filter(Boolean);
    const organisationAccountDetails = orgForm.organisationAccountDetails
      .map((detail) => ({
        bankName: detail.bankName.trim(),
        accountNumber: detail.accountNumber.trim(),
        accountName: detail.accountName.trim(),
      }))
      .filter((detail) => detail.bankName || detail.accountNumber || detail.accountName);

    if (!nameOfOrg || !address || !businessRegNumber || !briefHistory) {
      setOrgProfileBanner({
        type: 'error',
        message: 'Organisation name, address, RC number and brief history are required.',
      });
      return null;
    }
    if (phoneNumbers.length === 0) {
      setOrgProfileBanner({ type: 'error', message: 'At least one phone number is required.' });
      return null;
    }
    if (
      organisationAccountDetails.length === 0 ||
      organisationAccountDetails.some((detail) => !detail.bankName || !detail.accountNumber || !detail.accountName)
    ) {
      setOrgProfileBanner({
        type: 'error',
        message: 'At least one complete bank account (bank name, account number, account name) is required.',
      });
      return null;
    }

    return {
      nameOfOrg,
      address,
      phoneNumbers,
      organisationAccountDetails,
      briefHistory,
      businessRegNumber,
      cbnLicenseNumber: orgForm.cbnLicenseNumber.trim() || undefined,
      contactEmail: orgForm.contactEmail.trim() || undefined,
    };
  };

  const startOrganisationSetup = () => {
    setOrgForm(EMPTY_ORG_FORM);
    setOrgProfileBanner(null);
    setIsCreatingOrg(true);
  };

  const startEditingOrganisation = () => {
    if (!organisation) return;
    setOrgForm(toOrgFormValues(organisation));
    setOrgProfileBanner(null);
    setEditingProfile(true);
  };

  const handleCreateOrganisation = async () => {
    const payload = buildOrganisationPayload();
    if (!payload) return;

    try {
      setIsSavingOrgProfile(true);
      setOrgProfileBanner(null);
      const created = await organisationService.create(payload);
      setOrganisation(created);
      setOrgStatus('ready');
      setIsCreatingOrg(false);
      setOrgProfileBanner({ type: 'success', message: 'Organisation profile created successfully.' });
    } catch (error) {
      setOrgProfileBanner({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create organisation profile',
      });
    } finally {
      setIsSavingOrgProfile(false);
    }
  };

  const handleSaveOrganisationProfile = async () => {
    const payload = buildOrganisationPayload();
    if (!payload) return;

    try {
      setIsSavingOrgProfile(true);
      setOrgProfileBanner(null);
      const updated = await organisationService.update(payload);
      setOrganisation(updated);
      setEditingProfile(false);
      setOrgProfileBanner({ type: 'success', message: 'Organisation profile updated successfully.' });
    } catch (error) {
      setOrgProfileBanner({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update organisation profile',
      });
    } finally {
      setIsSavingOrgProfile(false);
    }
  };

  const handleDeleteOrganisation = async () => {
    try {
      setIsDeletingOrg(true);
      await organisationService.remove();
      setOrganisation(null);
      setOrgStatus('missing');
      setEditingProfile(false);
      setDeleteOrgConfirmOpen(false);
      toast.success("Organisation profile deleted. Use \"Setup Organisation Details\" whenever you're ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete organisation profile');
    } finally {
      setIsDeletingOrg(false);
    }
  };

  const updateOrgFormPhone = (index: number, value: string) =>
    setOrgForm((form) => ({
      ...form,
      phoneNumbers: form.phoneNumbers.map((phone, i) => (i === index ? value : phone)),
    }));
  const addOrgFormPhone = () => setOrgForm((form) => ({ ...form, phoneNumbers: [...form.phoneNumbers, ''] }));
  const removeOrgFormPhone = (index: number) =>
    setOrgForm((form) => ({ ...form, phoneNumbers: form.phoneNumbers.filter((_, i) => i !== index) }));

  const updateOrgFormAccount = (
    index: number,
    field: 'bankName' | 'accountNumber' | 'accountName',
    value: string,
  ) =>
    setOrgForm((form) => ({
      ...form,
      organisationAccountDetails: form.organisationAccountDetails.map((detail, i) =>
        i === index ? { ...detail, [field]: value } : detail,
      ),
    }));
  const addOrgFormAccount = () =>
    setOrgForm((form) => ({
      ...form,
      organisationAccountDetails: [...form.organisationAccountDetails, { bankName: '', accountNumber: '', accountName: '' }],
    }));
  const removeOrgFormAccount = (index: number) =>
    setOrgForm((form) => ({
      ...form,
      organisationAccountDetails: form.organisationAccountDetails.filter((_, i) => i !== index),
    }));

  function handleTabChange(key: TabKey) {
    setActiveTab(key);
    setMobileNavOpen(false);
  }
  // ─── Tab Content Renderers ──────────────────────────────────
  function renderOrgFormFields() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Organisation Name" value={orgForm.nameOfOrg} onChange={(v) => setOrgForm({ ...orgForm, nameOfOrg: v })} />
          <InputField label="RC Number" value={orgForm.businessRegNumber} onChange={(v) => setOrgForm({ ...orgForm, businessRegNumber: v })} />
          <InputField label="CBN License Number" value={orgForm.cbnLicenseNumber} onChange={(v) => setOrgForm({ ...orgForm, cbnLicenseNumber: v })} />
          <InputField label="Contact Email" value={orgForm.contactEmail} onChange={(v) => setOrgForm({ ...orgForm, contactEmail: v })} type="email" />
          <div className="md:col-span-2">
            <InputField label="Address" value={orgForm.address} onChange={(v) => setOrgForm({ ...orgForm, address: v })} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-body font-medium text-gray-600 mb-1.5">Brief History</label>
          <textarea
            value={orgForm.briefHistory}
            onChange={(e) => setOrgForm({ ...orgForm, briefHistory: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-body font-medium text-gray-600">Phone Numbers</label>
            <button type="button" onClick={addOrgFormPhone} className="text-xs font-body text-primary hover:text-primary/80">
              + Add phone number
            </button>
          </div>
          <div className="space-y-2">
            {orgForm.phoneNumbers.map((phone, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => updateOrgFormPhone(index, e.target.value)}
                  placeholder="08000000000"
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {orgForm.phoneNumbers.length > 1 && (
                  <button type="button" onClick={() => removeOrgFormPhone(index)} className="text-gray-400 hover:text-red-500 p-1">
                    <XIcon size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-body font-medium text-gray-600">Bank Accounts</label>
            <button type="button" onClick={addOrgFormAccount} className="text-xs font-body text-primary hover:text-primary/80">
              + Add bank account
            </button>
          </div>
          <div className="space-y-3">
            {orgForm.organisationAccountDetails.map((detail, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50">
                <input
                  value={detail.bankName}
                  onChange={(e) => updateOrgFormAccount(index, 'bankName', e.target.value)}
                  placeholder="Bank name"
                  className="flex-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <input
                  value={detail.accountNumber}
                  onChange={(e) => updateOrgFormAccount(index, 'accountNumber', e.target.value)}
                  placeholder="Account number"
                  className="flex-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <input
                  value={detail.accountName}
                  onChange={(e) => updateOrgFormAccount(index, 'accountName', e.target.value)}
                  placeholder="Account name"
                  className="flex-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {orgForm.organisationAccountDetails.length > 1 && (
                  <button type="button" onClick={() => removeOrgFormAccount(index)} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
                    <XIcon size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderOrganisation() {
    const banner = orgProfileBanner && (
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${orgProfileBanner.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
      >
        {orgProfileBanner.message}
      </div>
    );

    if (orgStatus === 'loading') {
      return (
        <div className="space-y-6">
          {banner}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-500">
            Loading organisation profile...
          </div>
        </div>
      );
    }

    if (orgStatus === 'error') {
      return (
        <div className="space-y-6">
          {banner}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
            <p className="text-sm text-gray-500 mb-3">Could not load the organisation profile.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-sm font-heading font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (orgStatus === 'missing' && !isCreatingOrg) {
      return (
        <div className="space-y-6">
          {banner}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <BuildingIcon size={26} className="text-primary" />
            </div>
            <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">No organisation profile yet</h3>
            <p className="text-sm font-body text-gray-500 mb-5 max-w-md">
              Set up the organisation's details — name, registration, contact info and bank accounts — before anything else on this page.
            </p>
            <button
              onClick={startOrganisationSetup}
              className="px-5 py-2.5 rounded-lg text-sm font-heading font-bold text-white bg-accent hover:bg-accent/90 transition-colors"
            >
              Setup Organisation Details
            </button>
          </div>
        </div>
      );
    }

    if (orgStatus === 'missing' && isCreatingOrg) {
      return (
        <div className="space-y-6">
          {banner}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <BuildingIcon size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-heading font-bold text-gray-900">Setup Organisation Details</h3>
                <p className="text-sm font-body text-gray-500 mt-0.5">This can only be done once — you can update or delete it afterward.</p>
              </div>
            </div>
            <div className="px-6 py-5">
              {renderOrgFormFields()}
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsCreatingOrg(false)}
                  disabled={isSavingOrgProfile}
                  className="px-4 py-2 rounded-lg text-sm font-heading font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreateOrganisation()}
                  disabled={isSavingOrgProfile}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading font-bold text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingOrgProfile ? (
                    'Creating...'
                  ) : (
                    <>
                      <SaveIcon size={16} />
                      Create Organisation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!organisation) {
      return null;
    }

    return (
      <div className="space-y-6">
        {banner}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <BuildingIcon size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-heading font-bold text-gray-900">Organisation Profile</h3>
              <p className="text-sm font-body text-gray-500 mt-0.5">Basic information about {organisation.nameOfOrg}</p>
            </div>
            <div className="flex items-center gap-4">
              {!editingProfile && (
                <button
                  onClick={() => setDeleteOrgConfirmOpen(true)}
                  className="text-sm font-body text-red-500 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => (editingProfile ? setEditingProfile(false) : startEditingOrganisation())}
                className="flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/80 transition-colors"
              >
                <PencilIcon size={14} />
                {editingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>
          <div className="px-6 py-5">
            {editingProfile ? (
              renderOrgFormFields()
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Organisation Name', value: organisation.nameOfOrg },
                    { label: 'RC Number', value: organisation.businessRegNumber },
                    { label: 'CBN License', value: organisation.cbnLicenseNumber || '—' },
                    { label: 'Contact Email', value: organisation.contactEmail || '—' },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-gray-400 font-body mb-0.5">{item.label}</p>
                      <p className="text-sm font-body font-medium text-gray-800">{item.value}</p>
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 font-body mb-0.5">Address</p>
                    <p className="text-sm font-body font-medium text-gray-800">{organisation.address}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 font-body mb-0.5">Brief History</p>
                  <p className="text-sm font-body text-gray-700 whitespace-pre-wrap">{organisation.briefHistory}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 font-body mb-1.5">Phone Numbers</p>
                  <div className="flex flex-wrap gap-2">
                    {organisation.phoneNumbers.map((phone) => (
                      <span key={phone} className="px-2.5 py-1 rounded-full text-xs font-body bg-gray-100 text-gray-700">
                        {phone}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 font-body mb-1.5">Bank Accounts</p>
                  <div className="space-y-2">
                    {organisation.organisationAccountDetails.map((detail, index) => (
                      <div key={index} className="text-sm font-body text-gray-700 p-2.5 rounded-lg bg-gray-50">
                        {detail.bankName} · {detail.accountNumber} · {detail.accountName}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {editingProfile && (
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setEditingProfile(false)}
                  disabled={isSavingOrgProfile}
                  className="px-4 py-2 rounded-lg text-sm font-heading font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSaveOrganisationProfile()}
                  disabled={isSavingOrgProfile}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading font-bold text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingOrgProfile ? (
                    'Saving...'
                  ) : (
                    <>
                      <SaveIcon size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={deleteOrgConfirmOpen}
          onClose={() => setDeleteOrgConfirmOpen(false)}
          onConfirm={() => void handleDeleteOrganisation()}
          title="Delete the organisation profile?"
          description="This is the only way to start over on the singleton profile — you'll need to set it up again from scratch, including bank accounts and phone numbers."
          confirmLabel={isDeletingOrg ? 'Deleting...' : 'Delete'}
          confirmVariant="danger"
        />
      </div>
    );
  }
  function renderLoanRules() {
    return (
      <div className="space-y-6">
        <LoanConfigurationPanel />
        <RepaymentPenaltyPanel />
      </div>
    );
  }
  function renderBranchRules() {
    return <BranchRulesPanel />;
  }
  function renderKyc() {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheckIcon size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">
              KYC & Verification
            </h3>
            <p className="text-sm font-body text-gray-500 mt-0.5">
              Manage identity verification and document requirements
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-body font-medium text-gray-800">
                  BVN Verification Required
                </p>
                <p className="text-xs text-gray-400 font-body">
                  Customers must verify their Bank Verification Number
                </p>
              </div>
              <Toggle
                enabled={kyc.bvnRequired}
                onToggle={() =>
                setKyc({
                  ...kyc,
                  bvnRequired: !kyc.bvnRequired
                })
                } />
              
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-body font-medium text-gray-800">
                  Biometric Capture Required
                </p>
                <p className="text-xs text-gray-400 font-body">
                  Facial capture during customer onboarding
                </p>
              </div>
              <Toggle
                enabled={kyc.biometricRequired}
                onToggle={() =>
                setKyc({
                  ...kyc,
                  biometricRequired: !kyc.biometricRequired
                })
                } />
              
            </div>
          </div>
          <div className="border-t border-gray-100 pt-5">
            <label className="block text-sm font-body font-medium text-gray-600 mb-3">
              Required Documents
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
              {
                key: 'nin' as const,
                label: 'National Identification Number (NIN)'
              },
              {
                key: 'utilityBill' as const,
                label: 'Utility Bill'
              },
              {
                key: 'passportPhoto' as const,
                label: 'Passport Photograph'
              },
              {
                key: 'bankStatement' as const,
                label: 'Bank Statement (6 months)'
              }].
              map((doc) =>
              <label
                key={doc.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary/20 transition-colors cursor-pointer">
                
                  <input
                  type="checkbox"
                  checked={kyc.requiredDocs[doc.key]}
                  onChange={() =>
                  setKyc({
                    ...kyc,
                    requiredDocs: {
                      ...kyc.requiredDocs,
                      [doc.key]: !kyc.requiredDocs[doc.key]
                    }
                  })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30" />
                
                  <span className="text-sm font-body text-gray-700">
                    {doc.label}
                  </span>
                </label>
              )}
            </div>
            <div className="mt-4 w-48">
              <InputField
                label="Minimum Age Requirement"
                value={kyc.minimumAge}
                onChange={(v) =>
                setKyc({
                  ...kyc,
                  minimumAge: v
                })
                }
                type="number"
                suffix="years" />
              
            </div>
          </div>
        </div>
      </div>);

  }
  function renderNotifications() {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <BellIcon size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">
              Notification Settings
            </h3>
            <p className="text-sm font-body text-gray-500 mt-0.5">
              Configure alerts and communication preferences
            </p>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-4 mb-6">
            {[
            {
              key: 'emailNotifications' as const,
              label: 'Email Notifications',
              desc: 'Send email alerts for key events'
            },
            {
              key: 'smsNotifications' as const,
              label: 'SMS Notifications',
              desc: 'Send SMS alerts to customers and staff'
            },
            {
              key: 'loanApprovalAlerts' as const,
              label: 'Loan Approval Alerts',
              desc: 'Notify authorizers when loans are pending approval'
            }].
            map((item) =>
            <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body font-medium text-gray-800">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-400 font-body">{item.desc}</p>
                </div>
                <Toggle
                enabled={notifications[item.key]}
                onToggle={() =>
                setNotifications({
                  ...notifications,
                  [item.key]: !notifications[item.key]
                })
                } />
              
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 pt-5 w-64">
            <InputField
              label="Repayment Reminder"
              value={notifications.repaymentReminderDays}
              onChange={(v) =>
              setNotifications({
                ...notifications,
                repaymentReminderDays: v
              })
              }
              type="number"
              suffix="days before due" />
            
          </div>
        </div>
      </div>);

  }
  const tabContent: Record<TabKey, React.ReactNode> = {
    organisation: renderOrganisation(),
    departments: <DepartmentsRoles />,
    rbac: <RbacManagement />,
    'loan-products': <LoanProductsCrud />,
    fees: <FeeConfiguration />,
    'loan-rules': renderLoanRules(),
    'branch-rules': renderBranchRules(),
    kyc: renderKyc(),
    notifications: renderNotifications()
  };
  return (
    <div className="min-h-screen bg-gray-50 font-body">
      {/* Page Header */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900">
              Organisation Settings
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure rules and policies for BCKash Cooperative
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-8 pb-8">
        <div className="flex gap-6">
          {/* Desktop Sidebar Nav */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <nav className="sticky top-4 space-y-1">
              {visibleSettingsTabs.map((tab) =>
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-colors text-left ${activeTab === tab.key ? 'bg-primary/10 text-primary font-bold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}>
                
                  <span
                  className={
                  activeTab === tab.key ? 'text-primary' : 'text-gray-400'
                  }>
                  
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              )}
            </nav>
          </aside>

          {/* Mobile Tab Selector */}
          <div className="lg:hidden fixed bottom-4 right-4 z-30">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors">
              
              {mobileNavOpen ? <XIcon size={20} /> : <SettingsIcon size={20} />}
            </button>
          </div>

          <AnimatePresence>
            {mobileNavOpen &&
            <motion.div
              initial={{
                opacity: 0
              }}
              animate={{
                opacity: 1
              }}
              exit={{
                opacity: 0
              }}
              className="lg:hidden fixed inset-0 z-20 bg-black/40"
              onClick={() => setMobileNavOpen(false)}>
              
                <motion.div
                initial={{
                  y: '100%'
                }}
                animate={{
                  y: 0
                }}
                exit={{
                  y: '100%'
                }}
                transition={{
                  type: 'spring',
                  damping: 25,
                  stiffness: 300
                }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-20 max-h-[60vh] overflow-y-auto">
                
                  <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                  <p className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                    Settings Sections
                  </p>
                  <nav className="space-y-1">
                    {visibleSettingsTabs.map((tab) =>
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-body transition-colors text-left ${activeTab === tab.key ? 'bg-primary/10 text-primary font-bold' : 'text-gray-600 hover:bg-gray-100'}`}>
                    
                        <span
                      className={
                      activeTab === tab.key ?
                      'text-primary' :
                      'text-gray-400'
                      }>
                      
                          {tab.icon}
                        </span>
                        {tab.label}
                      </button>
                  )}
                  </nav>
                </motion.div>
              </motion.div>
            }
          </AnimatePresence>

          {/* Content Area */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{
                  opacity: 0,
                  y: 8
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                exit={{
                  opacity: 0,
                  y: -8
                }}
                transition={{
                  duration: 0.2
                }}>
                
                {tabContent[activeTab]}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>);

}