import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircleIcon,
  BanIcon,
  EyeIcon,
  LoaderIcon,
  MailIcon,
  RefreshCwIcon,
} from 'lucide-react';
import {
  CreateOrganizationPayload,
  OrganizationRecord,
  ROOT_ADMIN_OPERATION_KEY_STORAGE,
  getRootAdminToken,
  rootAdminService,
} from '../../services/root-admin/root-admin.service';

const initialForm: CreateOrganizationPayload = {
  name: '',
  address: '',
  companyRegistrationNumber: '',
  email: '',
  phone: '',
  website: '',
  industry: '',
  taxId: '',
  temporaryPassword: '',
  superAdmin: {
    firstName: '',
    lastName: '',
    email: '',
  },
};

const withOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function RootAdminOrganisations() {
  const navigate = useNavigate();
  const token = useMemo(() => getRootAdminToken(), []);

  const [operationKey, setOperationKey] = useState(
    () => localStorage.getItem(ROOT_ADMIN_OPERATION_KEY_STORAGE) ?? '',
  );
  const [form, setForm] = useState<CreateOrganizationPayload>(initialForm);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<{
    organization: OrganizationRecord;
    superAdmins: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
      createdAt: string;
    }>;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [disablingOrganizationId, setDisablingOrganizationId] = useState<string | null>(null);
  const [notifyingOrganizationId, setNotifyingOrganizationId] = useState<string | null>(null);
  const [notificationSubject, setNotificationSubject] = useState('Important update from BCKash Root Admin');
  const [notificationMessage, setNotificationMessage] = useState('');

  const fetchOrganizations = async () => {
    if (!token) {
      return;
    }

    setLoadingList(true);
    setError('');

    try {
      const response = await rootAdminService.getOrganizations(token);
      setOrganizations(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load organizations');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void fetchOrganizations();
  }, [token]);

  const onOperationKeyChange = (value: string) => {
    setOperationKey(value);
    localStorage.setItem(ROOT_ADMIN_OPERATION_KEY_STORAGE, value);
  };

  const openOrganizationDetails = async (organizationId: string) => {
    if (!token) {
      return;
    }

    setLoadingDetails(true);
    setError('');

    try {
      const response = await rootAdminService.getOrganizationById(token, organizationId);
      setSelectedOrganization(response.payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to fetch organization details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const disableOrganization = async (organizationId: string) => {
    if (!token) {
      return;
    }

    if (!operationKey.trim()) {
      setError('Set ROOT_ADMIN_OPERATION_KEY to disable organizations.');
      navigate('/root-admin/settings');
      return;
    }

    const proceed = window.confirm('Disable this organization and all its staff accounts?');
    if (!proceed) {
      return;
    }

    setDisablingOrganizationId(organizationId);
    setError('');
    setSuccess('');

    try {
      const response = await rootAdminService.disableOrganization(token, operationKey.trim(), organizationId);
      setSuccess(response.message);
      await fetchOrganizations();

      if (selectedOrganization?.organization.id === organizationId) {
        await openOrganizationDetails(organizationId);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to disable organization');
    } finally {
      setDisablingOrganizationId(null);
    }
  };

  const notifyOrganization = async (organizationId: string) => {
    if (!token) {
      return;
    }

    if (!operationKey.trim()) {
      setError('Set ROOT_ADMIN_OPERATION_KEY to send notifications.');
      navigate('/root-admin/settings');
      return;
    }

    if (!notificationSubject.trim() || !notificationMessage.trim()) {
      setError('Provide both a notification subject and message.');
      return;
    }

    setNotifyingOrganizationId(organizationId);
    setError('');
    setSuccess('');

    try {
      const response = await rootAdminService.notifyOrganization(token, operationKey.trim(), organizationId, {
        subject: notificationSubject.trim(),
        message: notificationMessage.trim(),
      });
      setSuccess(
        `${response.message} (${response.recipients.length} recipient${
          response.recipients.length === 1 ? '' : 's'
        })`,
      );
      setNotificationMessage('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to send notification');
    } finally {
      setNotifyingOrganizationId(null);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!operationKey.trim()) {
      setError('Set ROOT_ADMIN_OPERATION_KEY to create an organization.');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const payload: CreateOrganizationPayload = {
        name: form.name.trim(),
        address: form.address.trim(),
        companyRegistrationNumber: form.companyRegistrationNumber.trim(),
        email: withOptional(form.email ?? ''),
        phone: withOptional(form.phone ?? ''),
        website: withOptional(form.website ?? ''),
        industry: withOptional(form.industry ?? ''),
        taxId: withOptional(form.taxId ?? ''),
        temporaryPassword: withOptional(form.temporaryPassword ?? ''),
        superAdmin: {
          firstName: form.superAdmin.firstName.trim(),
          lastName: form.superAdmin.lastName.trim(),
          email: form.superAdmin.email.trim().toLowerCase(),
        },
      };

      await rootAdminService.createOrganization(token ?? '', operationKey.trim(), payload);
      setSuccess('Organization created successfully.');
      setForm(initialForm);
      await fetchOrganizations();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon size={16} />
            <span>{error || success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-slate-900">Create Organization + Super Admin</h2>
          <p className="text-sm text-slate-500 mt-1">This creates organization records and initial admin credentials.</p>

          <form onSubmit={onSubmit} className="space-y-3 mt-5">
            <input
              value={operationKey}
              onChange={(event) => onOperationKeyChange(event.target.value)}
              placeholder="Root admin operation key"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />

            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Organization name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />

            <input
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Address"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />

            <input
              value={form.companyRegistrationNumber}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, companyRegistrationNumber: event.target.value }))
              }
              placeholder="Company registration number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Organization email (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    phone: event.target.value.replace(/\D/g, '').slice(0, 11),
                  }))
                }
                placeholder="Organization phone (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.website}
                onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                placeholder="Website (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                value={form.industry}
                onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}
                placeholder="Industry (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.taxId}
                onChange={(event) => setForm((prev) => ({ ...prev, taxId: event.target.value }))}
                placeholder="Tax ID (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                value={form.temporaryPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
                placeholder="Temporary password (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <h3 className="pt-2 font-semibold text-slate-900">Super Admin details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.superAdmin.firstName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    superAdmin: { ...prev.superAdmin, firstName: event.target.value },
                  }))
                }
                placeholder="First name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
              <input
                value={form.superAdmin.lastName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    superAdmin: { ...prev.superAdmin, lastName: event.target.value },
                  }))
                }
                placeholder="Last name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            <input
              value={form.superAdmin.email}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  superAdmin: { ...prev.superAdmin, email: event.target.value },
                }))
              }
              placeholder="Super admin email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary text-white py-2.5 font-semibold hover:bg-primary/90 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <LoaderIcon size={16} className="animate-spin" />
                  Creating organization...
                </>
              ) : (
                'Create Organization'
              )}
            </button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Created Organizations</h2>
              <p className="text-sm text-slate-500">Total: {organizations.length}</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchOrganizations()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCwIcon size={16} />
              Refresh
            </button>
          </div>

          {loadingList ? (
            <div className="py-12 flex items-center justify-center text-slate-500">
              <LoaderIcon className="animate-spin mr-2" size={18} />
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-slate-500 mt-6">No organizations created yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Reg No.</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-0">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((organization) => (
                    <tr key={organization.id} className="border-b border-slate-100 text-slate-700">
                      <td className="py-2 pr-4 font-medium">{organization.name}</td>
                      <td className="py-2 pr-4">{organization.companyRegistrationNumber}</td>
                      <td className="py-2 pr-4">
                        {organization.isActive ? (
                          <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs font-medium">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{new Date(organization.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-0">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void openOrganizationDetails(organization.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            <EyeIcon size={14} />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => void disableOrganization(organization.id)}
                            disabled={!organization.isActive || disablingOrganizationId === organization.id}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                          >
                            {disablingOrganizationId === organization.id ? (
                              <LoaderIcon size={14} className="animate-spin" />
                            ) : (
                              <BanIcon size={14} />
                            )}
                            Disable
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">Organization Drill-down</h2>
        <p className="text-sm text-slate-500 mt-1">View organization details and send notifications.</p>

        {loadingDetails ? (
          <div className="py-8 flex items-center text-slate-500">
            <LoaderIcon className="animate-spin mr-2" size={18} />
            Loading details...
          </div>
        ) : !selectedOrganization ? (
          <p className="text-sm text-slate-500 mt-4">Select an organization using the View action above.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Name:</span> {selectedOrganization.organization.name}
              </p>
              <p>
                <span className="font-semibold">Registration No:</span>{' '}
                {selectedOrganization.organization.companyRegistrationNumber}
              </p>
              <p>
                <span className="font-semibold">Email:</span> {selectedOrganization.organization.email ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Phone:</span> {selectedOrganization.organization.phone ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Address:</span> {selectedOrganization.organization.address}
              </p>
              <p>
                <span className="font-semibold">Super Admins:</span> {selectedOrganization.superAdmins.length}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">Send Notification</h3>
              <input
                value={notificationSubject}
                onChange={(event) => setNotificationSubject(event.target.value)}
                placeholder="Notification subject"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <textarea
                value={notificationMessage}
                onChange={(event) => setNotificationMessage(event.target.value)}
                placeholder="Write your message to this organization..."
                className="w-full min-h-[110px] rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="button"
                disabled={notifyingOrganizationId === selectedOrganization.organization.id}
                onClick={() => void notifyOrganization(selectedOrganization.organization.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {notifyingOrganizationId === selectedOrganization.organization.id ? (
                  <LoaderIcon size={16} className="animate-spin" />
                ) : (
                  <MailIcon size={16} />
                )}
                Send Notification
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
