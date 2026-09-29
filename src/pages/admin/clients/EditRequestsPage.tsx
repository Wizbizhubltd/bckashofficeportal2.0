import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { editRequestsApi, type ClientEditRequest } from '../../../api/clientsApi';
import { useAuth } from '../../../context/AuthContext';
import { useRolePath } from '../../../hooks/useRolePath';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { Pagination } from '../../../components/Pagination';

const PAGE_SIZE = 15;

const FILTERS: { value: ClientEditRequest['status'] | 'all'; label: string }[] = [
  { value: 'pending', label: 'Awaiting review' },
  { value: 'approved', label: 'Granted' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Refused' },
  { value: 'all', label: 'All' },
];

const STATUS_STYLES: Record<ClientEditRequest['status'], string> = {
  pending: 'bg-sky-50 text-sky-800 border-sky-200',
  approved: 'bg-amber-50 text-amber-800 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABELS: Record<ClientEditRequest['status'], string> = {
  pending: 'Awaiting review',
  approved: 'Granted',
  completed: 'Completed',
  rejected: 'Refused',
};

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

/**
 * Requests to edit approved clients in the viewer's office(s), newest first. Controllers grant or
 * refuse them here (or from the client's page); everyone else can follow their progress.
 */
export function EditRequestsPage() {
  const rolePath = useRolePath();
  const { userType } = useAuth();
  const isController = userType === 'controller';
  const [status, setStatus] = useState<ClientEditRequest['status'] | 'all'>('pending');
  const [items, setItems] = useState<ClientEditRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState<ClientEditRequest | null>(null);
  const [refusing, setRefusing] = useState<ClientEditRequest | null>(null);

  const load = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const result = await editRequestsApi.list(status, pageToLoad, PAGE_SIZE);
      setItems(result.items);
      setTotalCount(result.totalCount);
      setPage(result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load edit requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const review = async (request: ClientEditRequest, grant: boolean, note: string | undefined) => {
    setGranting(null);
    setRefusing(null);
    try {
      if (grant) await editRequestsApi.approve(request.id, note?.trim() || null);
      else await editRequestsApi.reject(request.id, note ?? '');
      toast.success(grant ? `Edit privilege granted for ${request.clientName ?? 'the client'}.` : 'Edit request refused.');
      void load(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The request could not be reviewed.');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-heading font-bold text-primary">Edit Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Approved clients are locked. Whoever onboarded them asks for edit privilege here; a controller grants or refuses it. An edited client goes back to pending
          approval.
        </p>
      </div>

      <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatus(filter.value)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${status === filter.value ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Requested by</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isController && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    {status === 'pending' ? 'No edit requests are waiting.' : 'No edit requests found.'}
                  </td>
                </tr>
              ) : (
                items.map((request) => (
                  <tr key={request.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={rolePath(`/clients/${request.clientId}`)} className="font-medium text-primary hover:underline">
                        {request.clientName ?? `Client #${request.clientId}`}
                      </Link>
                      <span className="block text-xs text-gray-400">
                        {request.clientAccountNo ? `A/C ${request.clientAccountNo} · ` : ''}
                        {request.officeName ?? '—'}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-gray-700">
                      {request.reason}
                      {request.reviewNote && <span className="mt-1 block text-xs text-gray-500">Controller's note: {request.reviewNote}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {request.requestedByName ?? '—'}
                      <span className="block text-xs text-gray-400">{formatDateTime(request.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}>{STATUS_LABELS[request.status]}</span>
                      {request.reviewedByName && (
                        <span className="mt-1 block text-xs text-gray-400">
                          {request.reviewedByName} · {formatDateTime(request.reviewedAt)}
                        </span>
                      )}
                    </td>
                    {isController && (
                      <td className="px-4 py-3">
                        {request.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setRefusing(request)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              <XCircleIcon size={14} /> Refuse
                            </button>
                            <button
                              onClick={() => setGranting(request)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                            >
                              <CheckCircleIcon size={14} /> Grant
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={(p) => void load(p)} />
      </div>

      <ConfirmationModal
        isOpen={!!granting}
        onClose={() => setGranting(null)}
        onConfirm={(note) => granting && void review(granting, true, note)}
        title="Grant edit privilege"
        description={`${granting?.requestedByName ?? 'The requester'} will be able to edit ${granting?.clientName ?? 'the client'}'s profile. The first saved edit sends the client back to pending approval.`}
        inputType="textarea"
        inputLabel="Note (optional)"
        confirmLabel="Grant"
      />
      <ConfirmationModal
        isOpen={!!refusing}
        onClose={() => setRefusing(null)}
        onConfirm={(note) => refusing && void review(refusing, false, note)}
        title="Refuse edit request"
        description="The profile stays locked. Tell the requester why."
        inputType="textarea"
        inputLabel="Why is it refused?"
        requireInput
        confirmLabel="Refuse"
        confirmVariant="danger"
      />
    </div>
  );
}
