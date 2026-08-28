import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BRANCH_ROLE_ASSIGNMENT_ENTITY_TYPE,
  buildRoleAssignmentProposalRows,
  type RoleAssignmentProposalRow,
} from '../services/branch-staff-assignments/role-assignment-approvals';
import { workflowRequestsService } from '../services/workflow-requests/workflow-requests.service';

export interface RoleAssignmentApprovalsFilter {
  /** Only proposals whose payload.branchIds includes this branch — for BranchDetail's own tab. */
  branchId?: string;
  /** Only proposals whose payload.staffId is this staff member — for StaffDetail's own tab. */
  staffId?: string;
  /** No filter — every BRANCH_ROLE_ASSIGNMENT proposal in the system, org-wide (HrManager). */
}

/**
 * Shared Pending/Rejected state + actions for BRANCH_ROLE_ASSIGNMENT
 * proposals — same shape as BranchDetail.tsx's own inline
 * manager-records-pending state, pulled out here so BranchDetail,
 * StaffDetail, and HrManager can each surface an approval queue for this
 * entity type without three copies of the same fetch/act/withdraw/delete
 * logic (see RoleAssignmentApprovalsPanel for the matching shared UI).
 *
 * `onMessage` lets each host page report outcomes through its own toast
 * mechanism (BranchDetail's local `showToast`, or react-hot-toast
 * elsewhere) rather than this hook picking one for everybody. `onApproved`
 * is a hook for a host to refresh its own already-active-coverage list
 * (e.g. StaffDetail's `coverage`/BranchDetail's current-manager display)
 * since approving here mutates state this hook otherwise knows nothing about.
 */
export function useRoleAssignmentApprovals(
  filter: RoleAssignmentApprovalsFilter = {},
  onMessage?: (message: string, variant: 'success' | 'error') => void,
  onApproved?: () => void,
) {
  const { user } = useAuth();
  const { branchId, staffId } = filter;

  const [view, setView] = useState<'pending' | 'rejected'>('pending');
  const [pendingRows, setPendingRows] = useState<RoleAssignmentProposalRow[]>([]);
  const [rejectedRows, setRejectedRows] = useState<RoleAssignmentProposalRow[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isLoadingRejected, setIsLoadingRejected] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const matchesFilter = useCallback(
    (row: RoleAssignmentProposalRow) => {
      if (branchId && !row.branchIds.includes(branchId)) return false;
      if (staffId && row.staffId !== staffId) return false;
      return true;
    },
    [branchId, staffId],
  );

  const refreshPending = useCallback(async () => {
    setIsLoadingPending(true);
    try {
      const all = await workflowRequestsService.getPendingByEntityType(BRANCH_ROLE_ASSIGNMENT_ENTITY_TYPE);
      const rows = await buildRoleAssignmentProposalRows(all, user?.id);
      setPendingRows(rows.filter(matchesFilter));
    } catch {
      setPendingRows([]);
    } finally {
      setIsLoadingPending(false);
    }
  }, [user?.id, matchesFilter]);

  const refreshRejected = useCallback(async () => {
    setIsLoadingRejected(true);
    try {
      const all = await workflowRequestsService.getRejectedByEntityType(BRANCH_ROLE_ASSIGNMENT_ENTITY_TYPE);
      const rows = await buildRoleAssignmentProposalRows(all, user?.id);
      setRejectedRows(rows.filter(matchesFilter));
    } catch {
      setRejectedRows([]);
    } finally {
      setIsLoadingRejected(false);
    }
  }, [user?.id, matchesFilter]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshPending(), refreshRejected()]);
  }, [refreshPending, refreshRejected]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, staffId, user?.id]);

  async function act(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      await refresh();
      setView(action === 'APPROVED' ? 'pending' : 'rejected');
      if (action === 'APPROVED') onApproved?.();
      onMessage?.(
        action === 'APPROVED'
          ? 'Branch role assignment approved — the staff member has been notified.'
          : 'Branch role assignment rejected',
        'success',
      );
    } catch (error) {
      onMessage?.(error instanceof Error ? error.message : 'Failed to act on this request', 'error');
    } finally {
      setActingRequestId(null);
    }
  }

  function confirmReject(comment?: string) {
    if (!rejectTargetId || !comment?.trim()) return;
    void act(rejectTargetId, 'REJECTED', comment.trim());
    setRejectTargetId(null);
  }

  async function withdraw() {
    if (!withdrawTargetId) return;
    setIsWithdrawing(true);
    try {
      await workflowRequestsService.cancel(withdrawTargetId);
      onMessage?.('Proposal withdrawn', 'success');
      setWithdrawTargetId(null);
      await refreshPending();
    } catch (error) {
      onMessage?.(error instanceof Error ? error.message : 'Failed to withdraw this proposal', 'error');
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function remove() {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await workflowRequestsService.deleteRequest(deleteTargetId);
      onMessage?.('Rejected proposal deleted', 'success');
      setDeleteTargetId(null);
      await refreshRejected();
    } catch (error) {
      onMessage?.(error instanceof Error ? error.message : 'Failed to delete this proposal', 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    view,
    setView,
    pendingRows,
    rejectedRows,
    isLoadingPending,
    isLoadingRejected,
    actingRequestId,
    approve: (requestId: string) => void act(requestId, 'APPROVED'),
    startReject: (requestId: string) => setRejectTargetId(requestId),
    rejectTargetId,
    closeReject: () => setRejectTargetId(null),
    confirmReject,
    startWithdraw: (requestId: string) => setWithdrawTargetId(requestId),
    withdrawTargetId,
    closeWithdraw: () => setWithdrawTargetId(null),
    withdraw,
    isWithdrawing,
    startDelete: (requestId: string) => setDeleteTargetId(requestId),
    deleteTargetId,
    closeDelete: () => setDeleteTargetId(null),
    remove,
    isDeleting,
    refresh,
  };
}

export type RoleAssignmentApprovalsState = ReturnType<typeof useRoleAssignmentApprovals>;
