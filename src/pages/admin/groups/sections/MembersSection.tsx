import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlusIcon, UserMinusIcon, SearchIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { ConfirmationModal } from '../../../../components/ConfirmationModal';

interface GroupMember {
  id: number;
  clientId: number | null;
  clientDisplayName: string | null;
  clientAccountNo: string | null;
  createdAt: string | null;
  createdById: number | null;
  removedAt: string | null;
  removedById: number | null;
}

interface ClientSearchResult {
  id: number;
  displayName: string | null;
  accountNo: string | null;
}

interface MembersSectionProps {
  groupId: number;
}

export function MembersSection({ groupId }: MembersSectionProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<GroupMember[]>(`/groups/${groupId}/members`, {
        params: { includeRemoved: showHistory || undefined },
      });
      setMembers(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, showHistory]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiClient.get(`/clients`, { params: { search: searchTerm, pageSize: 10 } });
        setSearchResults(response.data.items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm]);

  const handleAdd = async (client: ClientSearchResult) => {
    try {
      await apiClient.post(`/groups/${groupId}/members`, { clientId: client.id });
      toast.success(`${client.displayName ?? 'Client'} added to the group.`);
      setSearchTerm('');
      setSearchResults([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add member.');
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) {
      return;
    }
    try {
      await apiClient.delete(`/groups/${groupId}/members/${removeTarget.id}`);
      toast.success('Member removed.');
      setRemoveTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide">Member Roster</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} className="rounded text-primary focus:ring-primary" />
          Show removed members
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Add Member</label>
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        {searchTerm.trim() && (
          <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {searching ? (
              <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No matching clients.</p>
            ) : (
              searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void handleAdd(c)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50"
                >
                  <span>{c.displayName} <span className="text-gray-400">({c.accountNo})</span></span>
                  <UserPlusIcon size={14} className="text-primary" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Added</th>
              {showHistory && <th className="px-4 py-3 font-medium">Removed</th>}
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No members yet.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{m.clientDisplayName} <span className="text-gray-400">({m.clientAccountNo})</span></td>
                  <td className="px-4 py-3 text-gray-700">{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}</td>
                  {showHistory && (
                    <td className="px-4 py-3 text-gray-700">{m.removedAt ? new Date(m.removedAt).toLocaleDateString() : '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    {!m.removedAt && (
                      <button onClick={() => setRemoveTarget(m)} className="text-gray-400 hover:text-red-600" aria-label="Remove member">
                        <UserMinusIcon size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemove()}
        title="Remove member?"
        description={`${removeTarget?.clientDisplayName ?? 'This client'} will be removed from the group. Their membership history is retained.`}
        confirmLabel="Remove"
        confirmVariant="danger"
      />
    </div>
  );
}
