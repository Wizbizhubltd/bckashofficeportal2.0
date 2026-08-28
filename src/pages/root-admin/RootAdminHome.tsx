import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderIcon } from 'lucide-react';
import { getRootAdminToken, OrganizationRecord, rootAdminService } from '../../services/root-admin/root-admin.service';

export function RootAdminHome() {
  const navigate = useNavigate();
  const token = useMemo(() => getRootAdminToken(), []);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await rootAdminService.getOrganizations(token);
        setOrganizations(response.data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [token]);

  const activeOrganizations = organizations.filter((organization) => organization.isActive).length;
  const inactiveOrganizations = organizations.length - activeOrganizations;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Organizations</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">{organizations.length}</h3>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm text-green-700">Active Organizations</p>
          <h3 className="text-3xl font-bold text-green-800 mt-2">{activeOrganizations}</h3>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-5">
          <p className="text-sm text-slate-600">Disabled Organizations</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-2">{inactiveOrganizations}</h3>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        <p className="text-sm text-slate-500 mt-1">Jump straight to organization operations.</p>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500 flex items-center">
            <LoaderIcon size={16} className="animate-spin mr-2" />
            Loading organization metrics...
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate('/root-admin/organisations')}
            className="rounded-lg bg-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary/90"
          >
            Manage Organizations
          </button>
          <button
            type="button"
            onClick={() => navigate('/root-admin/settings')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}
