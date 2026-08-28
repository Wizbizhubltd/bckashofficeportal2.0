import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, PencilIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { customersService, type Customer } from '../../services/customers/customers.service';
import { groupsService, type InitiateGroupCreationPayload } from '../../services/groups/groups.service';
import { workflowRequestsService, type WorkflowRequestDetail } from '../../services/workflow-requests/workflow-requests.service';
import { useAppSelector } from '../../store/hooks';
import { withId } from '../../utils/id-label';
import { toTitleCase } from '../../utils/staff-display';

type ProposedMember = { customerId: string; customer: Customer | null };

function toDisplayDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function customerName(customer: Customer | null, fallbackId: string): string {
  if (!customer) return `Customer ${fallbackId.slice(-6)}`;
  return toTitleCase(`${customer.firstName} ${customer.lastName}`.trim()) || 'Unknown Customer';
}

function customerStatusLabel(customer: Customer | null): 'Approved' | 'Pending Approval' | 'Rejected' | 'Suspended' {
  if (!customer) return 'Pending Approval';
  if (customer.status === 'ACTIVE') return 'Approved';
  if (customer.status === 'REJECTED') return 'Rejected';
  if (customer.status === 'DISABLED') return 'Suspended';
  return 'Pending Approval';
}

const PROPOSAL_STATUS_BADGE: Record<WorkflowRequestDetail['status'], 'Pending Review' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Inactive'> = {
  PENDING_REVIEW: 'Pending Review',
  PENDING_APPROVAL: 'Pending Approval',
  RETURNED_TO_MAKER: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  // A maker-initiated withdrawal — see GroupProposalDetail's own delete
  // action. Never actually reachable from here (delete is a hard remove
  // for this entity type, see DELETABLE_STATUSES), but kept in the map
  // since the type admits it.
  CANCELLED: 'Inactive',
};

/**
 * Detail view for a group proposal that hasn't been approved yet (still
 * PENDING_REVIEW/PENDING_APPROVAL/REJECTED) — no `Group` document exists
 * for it yet (see GroupsService's own doc comment on that), only this
 * WorkflowRequest and its payload. Once approved, the same group is instead
 * viewed via GroupDetail.tsx at `/customers/groups/:groupId`.
 */
// A proposal is only ever deletable by its own maker before anyone else has
// put work into it: nobody has reviewed it yet (PENDING_REVIEW), or a
// reviewer's final word was no (REJECTED). Once it's advanced to
// PENDING_APPROVAL or been RETURNED_TO_MAKER, it's no longer the maker's
// alone to erase — and once APPROVED it's a real Group, never reachable
// from this page again anyway. See WorkflowEngineService.deleteRequest.
const DELETABLE_STATUSES: WorkflowRequestDetail['status'][] = ['PENDING_REVIEW', 'REJECTED'];

type EditForm = {
  name: string;
  proposedLeaderName: string;
  meetingDay: string;
  meetingLocation: string;
  expectedMemberCount: string;
};

export function GroupProposalDetail() {
  const navigate = useNavigate();
  const { workflowRequestId } = useParams<{ workflowRequestId: string }>();
  const customersBasePath = '/customers';
  const branches = useAppSelector((state) => state.lookups.branches);
  const { user } = useAuth();

  const [detail, setDetail] = useState<WorkflowRequestDetail | null>(null);
  const [members, setMembers] = useState<ProposedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    proposedLeaderName: '',
    meetingDay: '',
    meetingLocation: '',
    expectedMemberCount: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const routeId = typeof workflowRequestId === 'string' ? workflowRequestId.trim() : '';

  const refresh = () => {
    if (!routeId) {
      setError('Invalid proposal id.');
      setIsLoading(false);
      return Promise.resolve();
    }

    setIsLoading(true);
    setError(null);
    return workflowRequestsService
      .getById(routeId)
      .then(async (result) => {
        setDetail(result);
        const memberIds = Array.isArray(result.payload.proposedMemberCustomerIds)
          ? (result.payload.proposedMemberCustomerIds as string[])
          : [];
        const resolved = await Promise.all(
          memberIds.map(async (customerId) => {
            try {
              const customer = await customersService.getById(customerId);
              return { customerId, customer };
            } catch {
              // Outside the viewer's row-level scope, or deleted — shown as
              // a restricted placeholder rather than failing the whole page.
              return { customerId, customer: null };
            }
          }),
        );
        setMembers(resolved);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load group proposal.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowRequestId]);

  const branchName = useMemo(() => {
    const branchId = typeof detail?.payload.branchId === 'string' ? detail.payload.branchId : '';
    if (!branchId) return '—';
    return withId(branches.find((branch) => branch.id === branchId)?.name, branchId);
  }, [detail, branches]);

  const isOwnProposal = Boolean(detail && user && detail.initiatedBy === user.id);
  const canDelete = isOwnProposal && Boolean(detail && DELETABLE_STATUSES.includes(detail.status));
  // Editable only while genuinely untouched — see
  // WorkflowEngineService.updatePendingPayload's own comment on why this is
  // narrower than DELETABLE_STATUSES (a REJECTED proposal already has its
  // own "Revise & Resubmit" flow, which restarts the review chain instead).
  const canEdit = isOwnProposal && detail?.status === 'PENDING_REVIEW';

  async function handleDeleteProposal() {
    if (!detail) return;
    setIsDeleteModalOpen(false);
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await groupsService.deleteProposal(detail.id);
      navigate(customersBasePath);
    } catch (requestError) {
      setDeleteError(requestError instanceof Error ? requestError.message : 'Failed to delete this proposal.');
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditModal() {
    if (!detail) return;
    const payload = detail.payload;
    setEditForm({
      name: typeof payload.name === 'string' ? payload.name : '',
      proposedLeaderName: typeof payload.proposedLeaderName === 'string' ? payload.proposedLeaderName : '',
      meetingDay: typeof payload.meetingDay === 'string' ? payload.meetingDay : '',
      meetingLocation: typeof payload.meetingLocation === 'string' ? payload.meetingLocation : '',
      expectedMemberCount: typeof payload.expectedMemberCount === 'number' ? String(payload.expectedMemberCount) : '',
    });
    setEditError(null);
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!detail) return;
    const branchId = typeof detail.payload.branchId === 'string' ? detail.payload.branchId : '';
    const memberIds = Array.isArray(detail.payload.proposedMemberCustomerIds)
      ? (detail.payload.proposedMemberCustomerIds as string[])
      : [];
    if (!editForm.name.trim() || !branchId || memberIds.length === 0) {
      setEditError('Missing the original proposal details — cannot save');
      return;
    }
    // Member list is kept as-is — this edits the group's own details
    // (name, expected size, meeting info), not who's proposed to join.
    const payload: InitiateGroupCreationPayload = {
      name: editForm.name.trim(),
      branchId,
      proposedMemberCustomerIds: memberIds,
      proposedLeaderName: editForm.proposedLeaderName.trim() || undefined,
      meetingDay: editForm.meetingDay.trim() || undefined,
      meetingLocation: editForm.meetingLocation.trim() || undefined,
      expectedMemberCount: editForm.expectedMemberCount ? Number(editForm.expectedMemberCount) : undefined,
    };
    try {
      setIsSavingEdit(true);
      setEditError(null);
      await groupsService.updateProposal(detail.id, payload);
      await refresh();
      setIsEditModalOpen(false);
      showToast('Group proposal updated');
    } catch (requestError) {
      setEditError(requestError instanceof Error ? requestError.message : 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(customersBasePath)} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
          <ArrowLeftIcon size={16} className="mr-2" /> Back to Customers
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500">Loading group proposal...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(customersBasePath)} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
          <ArrowLeftIcon size={16} className="mr-2" /> Back to Customers
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <p className="text-sm text-red-600">{error || 'Group proposal not found.'}</p>
        </div>
      </div>
    );
  }

  const payload = detail.payload;
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name : 'Group proposal';
  const leader = typeof payload.proposedLeaderName === 'string' ? payload.proposedLeaderName : '';
  const meetingDay = typeof payload.meetingDay === 'string' ? payload.meetingDay : '';
  const meetingLocation = typeof payload.meetingLocation === 'string' ? payload.meetingLocation : '';
  const expectedMemberCount = typeof payload.expectedMemberCount === 'number' ? payload.expectedMemberCount : null;
  const lastActedStep = [...detail.steps].reverse().find((step) => step.action !== null);

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

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => void handleDeleteProposal()}
        title="Delete Group Proposal"
        description={`Delete "${name}"? This permanently removes the proposal along with any proposed member whose own record is still just a draft — it cannot be undone.`}
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><Trash2Icon size={20} /></div>}
        confirmLabel="Delete"
        confirmVariant="danger"
      />

      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsEditModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Edit Group Proposal</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                The proposed member list is kept as-is — this only edits the group's own details. Only
                available while nobody has reviewed this proposal yet.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Leader Name</label>
                  <input
                    type="text"
                    value={editForm.proposedLeaderName}
                    onChange={(e) => setEditForm((f) => ({ ...f, proposedLeaderName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Day</label>
                    <input
                      type="text"
                      value={editForm.meetingDay}
                      onChange={(e) => setEditForm((f) => ({ ...f, meetingDay: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Members</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.expectedMemberCount}
                      onChange={(e) => setEditForm((f) => ({ ...f, expectedMemberCount: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market / Location</label>
                  <input
                    type="text"
                    value={editForm.meetingLocation}
                    onChange={(e) => setEditForm((f) => ({ ...f, meetingLocation: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>
              {editError && <p className="text-xs text-red-600 font-body mt-3">{editError}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleSaveEdit()}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => navigate(customersBasePath)} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
        <ArrowLeftIcon size={16} className="mr-2" /> Back to Customers
      </button>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-heading font-bold text-primary">{name}</h2>
            <p className="text-sm text-gray-500 mt-1">Proposal ID: {detail.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={PROPOSAL_STATUS_BADGE[detail.status]} />
            {canEdit && (
              <button
                onClick={openEditModal}
                title="Edit this group proposal"
                aria-label="Edit this group proposal"
                className="p-2.5 border border-primary/20 text-primary rounded-lg hover:bg-primary/5 transition-colors"
              >
                <PencilIcon size={16} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isDeleting}
                title="Delete this group proposal"
                aria-label="Delete this group proposal"
                className="p-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Trash2Icon size={16} />
              </button>
            )}
          </div>
        </div>

        {(detail.status === 'PENDING_REVIEW' || detail.status === 'PENDING_APPROVAL' || detail.status === 'RETURNED_TO_MAKER') && (
          <p className="mt-2 text-xs font-body text-amber-600 flex items-center gap-1.5">
            <ClockIcon size={13} /> Awaiting {detail.status === 'PENDING_APPROVAL' ? 'approval' : 'review'}
          </p>
        )}
        {detail.status === 'REJECTED' && lastActedStep && (
          <p className="mt-2 text-xs font-body text-red-600">Rejected: {lastActedStep.comment || 'No reason was given.'}</p>
        )}
        {deleteError && <p className="mt-2 text-xs font-body text-red-600">{deleteError}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{branchName}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Proposed Members</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{members.length}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Submitted</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{toDisplayDateTime(detail.createdAt)}</p>
          </div>
        </div>

        {(leader || meetingDay || meetingLocation || expectedMemberCount) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Proposed Leader</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{leader || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Meeting Day</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{meetingDay || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Market / Location</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{meetingLocation || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Expected Members</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{expectedMemberCount ?? '—'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <UsersIcon size={16} className="text-gray-400" />
          <h3 className="text-sm font-heading font-bold text-primary">Proposed Members</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {members.map(({ customerId, customer }) => (
                <tr
                  key={customerId}
                  onClick={() => {
                    if (customer) navigate(`${customersBasePath}/${customer.id}`);
                  }}
                  className={`transition-colors ${customer ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default text-gray-400'}`}
                >
                  <td className="px-6 py-4 text-gray-800 font-medium">{customerName(customer, customerId)}</td>
                  <td className="px-6 py-4 text-gray-600">{customer?.phoneNumber ?? '—'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={customerStatusLabel(customer)} />
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-400">
                    No proposed members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
