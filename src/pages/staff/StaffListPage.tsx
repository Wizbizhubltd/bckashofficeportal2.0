import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon } from 'lucide-react';
import { usersApi, staffName, type OnboardingStatus, type StaffUser } from '../../api/usersApi';
import { useAuth } from '../../context/AuthContext';
import { useRolePath } from '../../hooks/useRolePath';
import { useScopedOffices } from '../../hooks/useScopedOffices';
import { isOfficeRole, rolesBelow, ROLE_LABELS } from '../../config/roles';
import { Pagination } from '../../components/Pagination';
import { StatusBadge } from '../../components/StatusBadge';

const PAGE_SIZE = 15;

/** Staff in the viewer's office(s), newest first. The API leaves out anyone outside them. */
export function StaffListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rolePath = useRolePath();
  const { userType } = useAuth();
  const offices = useScopedOffices();

  const [items, setItems] = useState<StaffUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [officeId, setOfficeId] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState((searchParams.get('onboardingStatus') as OnboardingStatus | null) ?? '');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleOptions = isOfficeRole(userType) ? [userType, ...rolesBelow(userType)] : [];

  const load = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const result = await usersApi.list({
        officeId: officeId ? Number(officeId) : undefined,
        userType: userTypeFilter || undefined,
        onboardingStatus: (onboardingStatus || undefined) as OnboardingStatus | undefined,
        search: search.trim() || undefined,
        page: pageToLoad,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
      setPage(result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load staff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(1), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId, userTypeFilter, onboardingStatus, search]);

  const selectClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Staff Directory</h1>
          <p className="text-sm text-gray-500 mt-1">Everyone in {offices.length === 1 ? offices[0].name ?? 'your office' : 'your offices'}.</p>
        </div>
        <Link to={rolePath('/staff/new')} className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <PlusIcon size={16} />
          Onboard Staff
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className={selectClass} />
        {offices.length > 1 ? (
          <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} className={selectClass}>
            <option value="">All my offices</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? `Office #${o.id}`}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden lg:block" />
        )}
        <select value={userTypeFilter} onChange={(e) => setUserTypeFilter(e.target.value)} className={selectClass}>
          <option value="">All roles</option>
          {roleOptions.map((slug) => (
            <option key={slug} value={slug}>
              {ROLE_LABELS[slug]}
            </option>
          ))}
        </select>
        <select value={onboardingStatus} onChange={(e) => setOnboardingStatus(e.target.value)} className={selectClass}>
          <option value="">All onboarding statuses</option>
          <option value="Approved">Approved</option>
          <option value="Pending">Pending</option>
          <option value="Declined">Declined</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Office</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Onboarding</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No staff found.
                  </td>
                </tr>
              ) : (
                items.map((staff) => (
                  <tr key={staff.id} onClick={() => navigate(rolePath(`/staff/${staff.id}`))} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <Link to={rolePath(`/staff/${staff.id}`)} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline font-medium">
                        {staffName(staff)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{staff.email}</td>
                    <td className="px-4 py-3 text-gray-700">{staff.officeName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{ROLE_LABELS[staff.userType ?? ''] ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={staff.onboardingStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={staff.blocked ? 'Suspended' : 'Active'} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={(p) => void load(p)} />
      </div>
    </div>
  );
}
