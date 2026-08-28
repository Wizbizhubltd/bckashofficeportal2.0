import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BanknoteIcon,
  BellIcon,
  BuildingIcon,
  CheckCircleIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { branchesService, type Branch, type BranchActivityEntry, type BranchStats } from '../../services/branches/branches.service';
import { branchFundingService, type BranchFunding } from '../../services/branch-funding/branch-funding.service';
import { branchRequestsService, type BranchRequest } from '../../services/branch-requests/branch-requests.service';
import { BranchFundingDetailModal } from './BranchFundingDetailModal';

type StatusBadgeValue = ComponentProps<typeof StatusBadge>['status'];

const FUNDING_STATUS_BADGE: Record<BranchFunding['status'], StatusBadgeValue> = {
  PENDING_VERIFICATION: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

function formatDisplayDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

function humanizeAction(action: string): string {
  const lower = action.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * A Branch Manager's own dedicated tab — everything Dashboard.tsx used to
 * carry for that role now lives here instead (branch metrics, funding
 * history/confirmation/disputes, requests to head office, notifications) —
 * see App.tsx/Sidebar.tsx's own comments on why this is a separate route
 * rather than a Dashboard section.
 */
export function MyBranch() {
  const { user } = useAuth();
  const branchId = user?.branchId ?? null;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [balanceKobo, setBalanceKobo] = useState<number | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  const [fundingRecords, setFundingRecords] = useState<BranchFunding[]>([]);
  const [isLoadingFunding, setIsLoadingFunding] = useState(true);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [selectedFunding, setSelectedFunding] = useState<BranchFunding | null>(null);
  // Pending = awaiting this manager's confirmation, Active = verified (credited
  // to the branch balance), Rejected = this manager rejected it. Matches
  // BranchFunding['status'] one-to-one — see FUNDING_STATUS_BADGE.
  const [fundingView, setFundingView] = useState<'pending' | 'active' | 'rejected'>('pending');

  const [activity, setActivity] = useState<BranchActivityEntry[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  const [requests, setRequests] = useState<BranchRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSubject, setRequestSubject] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const loadOverview = () => {
    if (!branchId) return;
    setIsLoadingOverview(true);
    Promise.all([
      branchesService.getById(branchId),
      branchesService.getStats(branchId).catch(() => ({ branchId, staffCount: 0, activeLoansCount: 0 })),
      branchesService.getBalance(branchId).catch(() => ({ branchId, availableAmount: 0 })),
    ])
      .then(([branchResult, statsResult, balanceResult]) => {
        setBranch(branchResult);
        setStats(statsResult);
        setBalanceKobo(balanceResult.availableAmount);
      })
      .catch(() => {
        setBranch(null);
      })
      .finally(() => setIsLoadingOverview(false));
  };

  const loadFunding = () => {
    if (!branchId) return;
    setIsLoadingFunding(true);
    branchFundingService
      .list()
      .then((items) => {
        setFundingRecords(items);
        setFundingError(null);
      })
      .catch((error) => {
        setFundingRecords([]);
        setFundingError(error instanceof Error ? error.message : 'Failed to load funding history');
      })
      .finally(() => setIsLoadingFunding(false));
  };

  const loadActivity = () => {
    if (!branchId) return;
    setIsLoadingActivity(true);
    branchesService
      .getActivity(branchId)
      .then((entries) => setActivity(entries.slice().reverse()))
      .catch(() => setActivity([]))
      .finally(() => setIsLoadingActivity(false));
  };

  const loadRequests = () => {
    if (!branchId) return;
    setIsLoadingRequests(true);
    branchRequestsService
      .list()
      .then((items) => setRequests(items))
      .catch(() => setRequests([]))
      .finally(() => setIsLoadingRequests(false));
  };

  useEffect(() => {
    loadOverview();
    loadFunding();
    loadActivity();
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function handleVerify(id: string) {
    try {
      await branchFundingService.verify(id);
      showToast('Funding record verified — branch balance credited');
      loadFunding();
      loadOverview();
      setSelectedFunding(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to verify this funding record');
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Reason for rejecting this funding record:');
    if (!reason?.trim()) return;
    try {
      await branchFundingService.reject(id, { reason: reason.trim() });
      showToast('Funding record rejected');
      loadFunding();
      setSelectedFunding(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to reject this funding record');
    }
  }

  async function handleRaiseDispute(reason: string, evidence: File) {
    if (!selectedFunding) return;
    const updated = await branchFundingService.raiseDispute(selectedFunding.id, reason, evidence);
    showToast('Dispute raised — head office will follow up');
    setFundingRecords((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedFunding(updated);
  }

  async function handleCreateRequest() {
    if (!requestSubject.trim() || !requestMessage.trim()) {
      setRequestError('A subject and message are both required');
      return;
    }
    setSubmittingRequest(true);
    setRequestError(null);
    try {
      await branchRequestsService.create({ subject: requestSubject.trim(), message: requestMessage.trim() });
      showToast('Request sent to head office');
      setRequestModalOpen(false);
      setRequestSubject('');
      setRequestMessage('');
      loadRequests();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Failed to send this request');
    } finally {
      setSubmittingRequest(false);
    }
  }

  const sortedFundingRecords = useMemo(
    () => fundingRecords.slice().sort((a, b) => new Date(b.fundedAt).getTime() - new Date(a.fundedAt).getTime()),
    [fundingRecords],
  );

  const pendingFundingRecords = useMemo(
    () => sortedFundingRecords.filter((record) => record.status === 'PENDING_VERIFICATION'),
    [sortedFundingRecords],
  );
  const activeFundingRecords = useMemo(
    () => sortedFundingRecords.filter((record) => record.status === 'VERIFIED'),
    [sortedFundingRecords],
  );
  const rejectedFundingRecords = useMemo(
    () => sortedFundingRecords.filter((record) => record.status === 'REJECTED'),
    [sortedFundingRecords],
  );
  const visibleFundingRecords =
    fundingView === 'pending'
      ? pendingFundingRecords
      : fundingView === 'active'
        ? activeFundingRecords
        : rejectedFundingRecords;

  if (!branchId) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <BuildingIcon size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-heading font-bold text-gray-500">No Branch Assigned</p>
        <p className="text-xs text-gray-400 mt-1">Your account isn't assigned to a branch yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body"
          >
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <BranchFundingDetailModal
        isOpen={selectedFunding !== null}
        onClose={() => setSelectedFunding(null)}
        funding={selectedFunding}
        branchName={branch?.name}
        mode="manager"
        onVerify={selectedFunding ? () => void handleVerify(selectedFunding.id) : undefined}
        onReject={selectedFunding ? () => void handleReject(selectedFunding.id) : undefined}
        onRaiseDispute={handleRaiseDispute}
      />

      <AnimatePresence>
        {requestModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setRequestModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-heading font-bold text-gray-900">Request to Head Office</h3>
                <button onClick={() => setRequestModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon size={20} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={requestSubject}
                    onChange={(e) => setRequestSubject(e.target.value)}
                    placeholder="e.g. Need additional float"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe what you need..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                {requestError && <p className="text-xs text-red-600">{requestError}</p>}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setRequestModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreateRequest()}
                  disabled={submittingRequest}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submittingRequest ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-primary">Branch Management</h2>
          <p className="text-gray-500 font-body text-sm mt-1">{isLoadingOverview ? 'Loading...' : (branch?.name ?? '—')}</p>
        </div>
        <button
          onClick={() => setRequestModalOpen(true)}
          className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-[#e64a19] transition-colors text-sm font-heading font-bold shadow-sm"
        >
          <MessageSquarePlusIcon size={16} className="mr-2" />
          Request to Head Office
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <WalletIcon size={22} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Fund Balance</p>
            <h3 className="text-xl font-heading font-bold text-primary">{balanceKobo === null ? '—' : formatNaira(balanceKobo)}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <BanknoteIcon size={22} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Active Loans</p>
            <h3 className="text-xl font-heading font-bold text-primary">{stats?.activeLoansCount ?? '—'}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <UsersIcon size={22} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Staff</p>
            <h3 className="text-xl font-heading font-bold text-primary">{stats?.staffCount ?? '—'}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funding history */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-heading font-bold text-primary">Branch Funding</h3>
            <p className="text-xs text-gray-400 mt-0.5">Click a record to confirm it, raise a dispute, or view details.</p>
            <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit mt-3">
              <button
                onClick={() => setFundingView('pending')}
                className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${fundingView === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}
              >
                Pending ({pendingFundingRecords.length})
              </button>
              <button
                onClick={() => setFundingView('active')}
                className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${fundingView === 'active' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}
              >
                Active ({activeFundingRecords.length})
              </button>
              <button
                onClick={() => setFundingView('rejected')}
                className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${fundingView === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}
              >
                Rejected ({rejectedFundingRecords.length})
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-heading">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Dispute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {visibleFundingRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedFunding(record)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-gray-600">{formatDisplayDate(record.fundedAt)}</td>
                    <td className="px-6 py-4 font-heading font-bold text-gray-800">{formatNaira(record.amount)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={FUNDING_STATUS_BADGE[record.status]} />
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {record.disputeDetails ? (record.disputeDetails.resolution ?? 'Open') : '—'}
                    </td>
                  </tr>
                ))}
                {!isLoadingFunding && !fundingError && visibleFundingRecords.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      {fundingView === 'pending' && 'Nothing awaiting your confirmation.'}
                      {fundingView === 'active' && 'No verified funding for your branch yet.'}
                      {fundingView === 'rejected' && 'Nothing rejected.'}
                    </td>
                  </tr>
                )}
                {isLoadingFunding && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      <span className="inline-flex items-center gap-2">
                        <Loader2Icon size={16} className="animate-spin" /> Loading...
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingFunding && fundingError && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-red-500 text-sm font-body">
                      {fundingError}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications from head office */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-1 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2">
            <BellIcon size={18} className="text-primary" />
            <h3 className="text-lg font-heading font-bold text-primary">Notifications</h3>
          </div>
          <div className="flex-1 divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {isLoadingActivity && (
              <p className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon size={16} className="animate-spin" /> Loading...
                </span>
              </p>
            )}
            {!isLoadingActivity && activity.length === 0 && (
              <p className="px-6 py-12 text-center text-gray-400 text-sm font-body">Nothing from head office yet.</p>
            )}
            {!isLoadingActivity &&
              activity.slice(0, 10).map((entry) => (
                <div key={entry.id} className="px-6 py-3">
                  <p className="text-sm font-body font-medium text-gray-800">{humanizeAction(entry.action)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.actorName ?? 'System'} · {formatDisplayDateTime(entry.timestamp)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Requests to head office */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-heading font-bold text-primary">Your Requests to Head Office</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {isLoadingRequests && (
            <p className="px-6 py-8 text-center text-gray-400 text-sm font-body">Loading...</p>
          )}
          {!isLoadingRequests && requests.length === 0 && (
            <p className="px-6 py-8 text-center text-gray-400 text-sm font-body">No requests sent yet.</p>
          )}
          {!isLoadingRequests &&
            requests.map((request) => (
              <div key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-heading font-bold text-gray-900">{request.subject}</p>
                  <StatusBadge status={request.status === 'OPEN' ? 'Pending' : 'Completed'} />
                </div>
                <p className="text-sm text-gray-600 mt-1">{request.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDisplayDateTime(request.createdAt)}</p>
                {request.status === 'RESOLVED' && request.resolutionNote && (
                  <p className="text-xs text-green-700 mt-1.5">Response: "{request.resolutionNote}"</p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
