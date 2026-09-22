import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon, SearchIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { Pagination } from '../../../components/Pagination';
import { StatusBadge } from '../../../components/StatusBadge';
import type { ClientStatus } from '../clients/ClientsListPage';

export interface GroupListItem {
  id: number;
  accountNo: string | null;
  name: string | null;
  officeId: number | null;
  staffId: number | null;
  status: ClientStatus;
  joinedDate: string | null;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

interface Office {
  id: number;
  name: string | null;
}

const PAGE_SIZE = 20;

export function GroupsListPage() {
  const [items, setItems] = useState<GroupListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<Office[]>([]);

  const [search, setSearch] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [status, setStatus] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void apiClient.get<Office[]>('/offices').then((response) => setOffices(response.data));
  }, []);

  const load = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const response = await apiClient.get<PagedResult<GroupListItem>>('/groups', {
        params: {
          search: search || undefined,
          officeId: officeId || undefined,
          status: status || undefined,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        },
      });
      setItems(response.data.items);
      setTotalCount(response.data.totalCount);
      setPage(response.data.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void load(1);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, officeId, status]);

  const officeName = (id: number | null) => offices.find((o) => o.id === id)?.name ?? '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Manage lending groups (BR-GRP-1).</p>
        </div>
        <Link
          to="/admin/groups/new"
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add Group
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <select
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          <option value="">All Offices</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Declined">Declined</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Account No.</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Office</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No groups found.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    <Link to={`/admin/groups/${item.id}`} className="text-primary hover:underline font-medium">
                      {item.accountNo || `#${item.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.name}</td>
                  <td className="px-4 py-3 text-gray-700">{officeName(item.officeId)}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={(p) => void load(p)} />
      </div>
    </div>
  );
}
