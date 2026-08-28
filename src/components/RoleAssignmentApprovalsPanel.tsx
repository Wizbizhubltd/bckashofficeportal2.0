import { CheckCircleIcon, CircleXIcon, ClockIcon, Trash2Icon, XCircleIcon } from 'lucide-react';
import { STAFF_ROLE_LABEL } from '../constants/identity-options';
import type { RoleAssignmentApprovalsState } from '../hooks/useRoleAssignmentApprovals';
import { ConfirmationModal } from './ConfirmationModal';

interface RoleAssignmentApprovalsPanelProps {
  state: RoleAssignmentApprovalsState;
  /** StaffDetail already shows the staff member's own name in the page header — redundant to repeat it on every row there. */
  hideStaffName?: boolean;
  emptyPendingHint?: string;
  emptyRejectedHint?: string;
}

/**
 * Shared Pending/Rejected UI for BRANCH_ROLE_ASSIGNMENT proposals — same
 * visual language as BranchDetail.tsx's own manager-records Pending/Rejected
 * cards, driven entirely by `useRoleAssignmentApprovals`. Used on
 * BranchDetail (filtered to one branch), StaffDetail (filtered to one
 * staff member), and HrManager (org-wide — the actual "authorizer" queue).
 */
export function RoleAssignmentApprovalsPanel({
  state,
  hideStaffName = false,
  emptyPendingHint = "A proposed branch role assignment will show up here until it's approved or rejected.",
  emptyRejectedHint = 'A rejected assignment never takes effect — it shows up here instead of as active coverage.',
}: RoleAssignmentApprovalsPanelProps) {
  const {
    view,
    setView,
    pendingRows,
    rejectedRows,
    isLoadingPending,
    isLoadingRejected,
    actingRequestId,
    approve,
    startReject,
    rejectTargetId,
    closeReject,
    confirmReject,
    startWithdraw,
    withdrawTargetId,
    closeWithdraw,
    withdraw,
    isWithdrawing,
    startDelete,
    deleteTargetId,
    closeDelete,
    remove,
    isDeleting,
  } = state;

  return (
    <div className="space-y-4">
      <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('pending')}
          className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
          Pending ({pendingRows.length})
        </button>
        <button
          onClick={() => setView('rejected')}
          className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
          Rejected ({rejectedRows.length})
        </button>
      </div>

      {view === 'pending' ? (
        <div className="space-y-3">
          {isLoadingPending && pendingRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <ClockIcon size={40} className="text-gray-200 mx-auto mb-3 animate-pulse" />
              <p className="text-sm font-body text-gray-400">Loading pending requests...</p>
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <ClockIcon size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-heading font-bold text-gray-500">Nothing awaiting approval</p>
              <p className="text-xs font-body text-gray-400 mt-1">{emptyPendingHint}</p>
            </div>
          ) : (
            pendingRows.map((row) => (
              <div key={row.requestId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <ClockIcon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!hideStaffName && <p className="font-heading font-bold text-gray-900">{row.staffName}</p>}
                      <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-primary/10 text-primary">
                        {STAFF_ROLE_LABEL[row.role] ?? row.role}
                      </span>
                      {row.isOwnProposal && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-blue-50 text-blue-600">Your proposal</span>
                      )}
                    </div>
                    <p className="text-xs font-body text-gray-500 mt-1">Branches: {row.branchNames}</p>
                    <p className="text-xs font-body text-gray-400 mt-0.5">
                      Proposed by {row.proposedByName} · {new Date(row.proposedAt).toLocaleDateString()}
                    </p>
                    {row.comments && <p className="text-xs font-body text-gray-500 mt-1 italic">"{row.comments}"</p>}
                  </div>
                </div>

                {row.isOwnProposal ? (
                  <div className="flex items-start gap-2 flex-shrink-0">
                    <p className="text-xs font-body text-gray-400 text-right max-w-[160px]">
                      Awaiting another Admin/SuperAdmin/Approver's review — you can't approve your own proposal.
                    </p>
                    <button
                      disabled={actingRequestId === row.requestId}
                      onClick={() => startWithdraw(row.requestId)}
                      title="Withdraw this proposal"
                      aria-label="Withdraw this proposal"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60">
                      <Trash2Icon size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      disabled={actingRequestId === row.requestId}
                      onClick={() => approve(row.requestId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60">
                      <CheckCircleIcon size={13} /> Approve
                    </button>
                    <button
                      disabled={actingRequestId === row.requestId}
                      onClick={() => startReject(row.requestId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
                      <XCircleIcon size={13} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {isLoadingRejected && rejectedRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <CircleXIcon size={40} className="text-gray-200 mx-auto mb-3 animate-pulse" />
              <p className="text-sm font-body text-gray-400">Loading rejected requests...</p>
            </div>
          ) : rejectedRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <CircleXIcon size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-heading font-bold text-gray-500">Nothing rejected</p>
              <p className="text-xs font-body text-gray-400 mt-1">{emptyRejectedHint}</p>
            </div>
          ) : (
            rejectedRows.map((row) => (
              <div key={row.requestId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                    <CircleXIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!hideStaffName && <p className="font-heading font-bold text-gray-900">{row.staffName}</p>}
                      <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-primary/10 text-primary">
                        {STAFF_ROLE_LABEL[row.role] ?? row.role}
                      </span>
                    </div>
                    <p className="text-xs font-body text-gray-500 mt-1">Branches: {row.branchNames}</p>
                    <p className="text-xs font-body text-gray-400 mt-0.5">
                      Proposed by {row.proposedByName} · {new Date(row.proposedAt).toLocaleDateString()}
                    </p>
                    {row.comments && <p className="text-xs font-body text-gray-500 mt-1 italic">"{row.comments}"</p>}
                    {row.rejectedByName && (
                      <p className="text-xs font-body text-red-600 mt-1.5">
                        Rejected by {row.rejectedByName}
                        {row.rejectedAt ? ` · ${new Date(row.rejectedAt).toLocaleDateString()}` : ''}
                        {row.rejectionComment ? `: "${row.rejectionComment}"` : ''}
                      </p>
                    )}
                  </div>
                </div>
                {row.isOwnProposal && (
                  <button
                    onClick={() => startDelete(row.requestId)}
                    title="Delete this rejected proposal"
                    aria-label="Delete this rejected proposal"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                    <Trash2Icon size={15} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={rejectTargetId !== null}
        onClose={closeReject}
        onConfirm={(reason) => confirmReject(reason)}
        title="Reject this branch role assignment?"
        description="A reason is required — the person who proposed it will see it."
        icon={<XCircleIcon size={20} className="text-red-600" />}
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. This staff member already covers enough branches"
        requireInput
      />

      <ConfirmationModal
        isOpen={withdrawTargetId !== null}
        onClose={closeWithdraw}
        onConfirm={() => void withdraw()}
        title="Withdraw this proposal?"
        description="This removes it from the approval queue — nothing was ever assigned, so there's nothing else to undo. This cannot be reversed."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
        confirmVariant="danger"
      />

      <ConfirmationModal
        isOpen={deleteTargetId !== null}
        onClose={closeDelete}
        onConfirm={() => void remove()}
        title="Delete this rejected proposal?"
        description="This permanently removes the request — it cannot be undone."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
      />
    </div>
  );
}
