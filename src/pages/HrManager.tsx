import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UsersIcon,
  UserCheckIcon,
  UserMinusIcon,
  BriefcaseIcon,
  LoaderIcon,
  SearchIcon,
  PlusIcon,
  DownloadIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleXIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Trash2Icon,
  EyeIcon,
  PencilIcon,
  XIcon,
  UploadCloudIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  GENDER_OPTIONS,
  ID_TYPE_OPTIONS,
  STAFF_ROLE_LABEL,
  STAFF_ROLE_OPTIONS,
  STAFF_STATUS_LABEL,
  STAFF_USER_TYPE_OPTIONS,
} from '../constants/identity-options';
import { staffService, type InitiateStaffOnboardingPayload, type OnboardableStaffRole, type Staff } from '../services/staff/staff.service';
import { workflowRequestsService } from '../services/workflow-requests/workflow-requests.service';
import type { WorkflowRequestDetail, WorkflowRequestSummary } from '../services/workflow-requests/workflow-requests.types';
import { useRoleAssignmentApprovals } from '../hooks/useRoleAssignmentApprovals';
import { RoleAssignmentApprovalsPanel } from '../components/RoleAssignmentApprovalsPanel';
import { useAppSelector } from '../store/hooks';
import { buildFrontendStaffId, toTitleCase } from '../utils/staff-display';

const PAGE_SIZE = 10;
const STAFF_ENTITY_TYPE = 'STAFF';

const editInputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

/**
 * One shape for every tab's row — Approved rows come from a real Staff
 * document, Pending/Rejected rows come from a WorkflowRequest (STAFF
 * onboarding is Manager-initiated, Admin/SuperAdmin/Approver-approved — see
 * StaffService.initiateOnboarding — so a proposed hire has no Staff document
 * at all until approved; `backendId`/`requestId` tell the table which one
 * it's looking at and what a click/action should target).
 */
type DirectoryRow = {
  key: string;
  backendId: string | null;
  requestId: string | null;
  name: string;
  email: string;
  roleLabel: string;
  roleValue: string;
  unit: string;
  branch: string;
  branchId: string | null;
  department: string;
  departmentId: string | null;
  statusLabel: 'Active' | 'Suspended' | 'Pending Approval' | 'Rejected';
  proposedAt?: string;
  proposedBy?: string;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionComment?: string | null;
};

type LookupItem = { id: string; name: string };

/**
 * `GET /staff` returns flat ids for department/unit/branch — resolved
 * against the pre-saved lookups (hydrated at login, see lookupsSlice), not
 * against anything on the Staff record itself, which carries no names.
 */
function mapStaffToRow(
  staff: Staff,
  departments: LookupItem[],
  units: LookupItem[],
  branches: LookupItem[],
): DirectoryRow {
  return {
    key: `staff-${staff.id}`,
    backendId: staff.id,
    requestId: null,
    name: toTitleCase(`${staff.firstName} ${staff.lastName}`.trim()) || 'Unknown Staff',
    email: staff.email,
    roleLabel: STAFF_ROLE_LABEL[staff.role] ?? staff.role,
    roleValue: staff.role,
    unit: units.find((unit) => unit.id === staff.unitId)?.name ?? '—',
    department: departments.find((department) => department.id === staff.departmentId)?.name ?? '—',
    departmentId: staff.departmentId ?? null,
    branch: branches.find((branch) => branch.id === staff.branchId)?.name ?? '—',
    branchId: staff.branchId ?? null,
    // Real Staff.status never actually lands on PENDING_APPROVAL/REJECTED —
    // those only ever exist as a WorkflowRequest's own status (see the
    // Pending/Rejected mappers below); a persisted Staff record is always
    // ACTIVE or DISABLED. Still routed through the label map for the one
    // real case (DISABLED -> "Suspended").
    statusLabel: (STAFF_STATUS_LABEL[staff.status] ?? staff.status) as DirectoryRow['statusLabel'],
  };
}

/** Onboarding's `InitiateStaffOnboardingDto` does carry a `role` (any of ONBOARDABLE_STAFF_ROLES, not just MARKETER) — it's stored on the WorkflowRequest payload verbatim, same as every other proposed field. */
function mapWorkflowRequestToRow(
  entry: WorkflowRequestSummary,
  detail: WorkflowRequestDetail | undefined,
  statusLabel: 'Pending Approval' | 'Rejected',
  departments: LookupItem[],
  units: LookupItem[],
  branches: LookupItem[],
): DirectoryRow {
  const payload = (detail?.payload ?? {}) as Record<string, unknown>;
  const firstName = typeof payload.firstName === 'string' ? payload.firstName : '';
  const lastName = typeof payload.lastName === 'string' ? payload.lastName : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const role = typeof payload.role === 'string' ? payload.role : 'MARKETER';
  const departmentId = typeof payload.departmentId === 'string' ? payload.departmentId : null;
  const unitId = typeof payload.unitId === 'string' ? payload.unitId : null;
  const branchId = typeof payload.branchId === 'string' ? payload.branchId : entry.branchId;
  const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');

  return {
    key: `request-${entry.id}`,
    backendId: entry.entityId,
    requestId: entry.id,
    name: detail ? toTitleCase(`${firstName} ${lastName}`.trim()) || 'Unknown Staff' : 'Loading...',
    email: detail ? email : '',
    roleLabel: detail ? (STAFF_ROLE_LABEL[role] ?? role) : 'Loading...',
    roleValue: role,
    unit: units.find((unit) => unit.id === unitId)?.name ?? '—',
    department: departments.find((department) => department.id === departmentId)?.name ?? '—',
    departmentId,
    branch: branches.find((branch) => branch.id === branchId)?.name ?? '—',
    branchId,
    statusLabel,
    proposedAt: entry.createdAt,
    proposedBy: entry.initiatedBy,
    rejectedBy: rejectionStep?.actedBy ?? null,
    rejectedAt: rejectionStep?.actedAt ?? null,
    rejectionComment: rejectionStep?.comment ?? null,
  };
}

/**
 * Flat, plain-string editing shape for the "Edit & Resubmit" modal — one
 * field per InitiateStaffOnboardingPayload leaf (residentialAddress.state/
 * city stay plain text here rather than the cascading state->city id
 * selects StaffOnboarding.tsx uses, since the payload itself only ever
 * stores their display names, not ids — a plain text field round-trips
 * that with no reverse lookup needed).
 */
type EditableStaffForm = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  userType: string;
  departmentId: string;
  unitId: string;
  branchId: string;
  startDate: string;
  bvn: string;
  state: string;
  city: string;
  street: string;
  dateOfBirth: string;
  gender: string;
  idType: string;
  idNumber: string;
  nokName: string;
  nokRelationship: string;
  nokPhone: string;
  nokAddress: string;
  referenceName: string;
  referenceRelationship: string;
  referencePhone: string;
  referenceAddress: string;
};

const EMPTY_EDIT_FORM: EditableStaffForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  role: '',
  userType: '',
  departmentId: '',
  unitId: '',
  branchId: '',
  startDate: '',
  bvn: '',
  state: '',
  city: '',
  street: '',
  dateOfBirth: '',
  gender: '',
  idType: '',
  idNumber: '',
  nokName: '',
  nokRelationship: '',
  nokPhone: '',
  nokAddress: '',
  referenceName: '',
  referenceRelationship: '',
  referencePhone: '',
  referenceAddress: '',
};

/** A rejected request's stored payload -> the edit form's flat shape. Mirrors StaffOnboardingPayload field-for-field (see backashbackend's staff.service.ts). */
function payloadToEditForm(payload: Record<string, unknown>): EditableStaffForm {
  const residentialAddress = (payload.residentialAddress ?? {}) as Record<string, unknown>;
  const kyc = (payload.kyc ?? {}) as Record<string, unknown>;
  const nextOfKin = (payload.nextOfKin ?? {}) as Record<string, unknown>;
  const reference = (payload.reference ?? {}) as Record<string, unknown>;
  const str = (value: unknown): string => (typeof value === 'string' ? value : '');
  // startDate/dateOfBirth travel as full ISO datetimes — <input type="date"> needs just the yyyy-mm-dd prefix.
  const dateOnly = (value: unknown): string => (typeof value === 'string' ? value.slice(0, 10) : '');

  return {
    firstName: str(payload.firstName),
    lastName: str(payload.lastName),
    email: str(payload.email),
    phoneNumber: str(payload.phoneNumber),
    role: str(payload.role),
    userType: str(payload.userType),
    departmentId: str(payload.departmentId),
    unitId: str(payload.unitId),
    branchId: str(payload.branchId),
    startDate: dateOnly(payload.startDate),
    bvn: '', // BVN is stored encrypted server-side — never round-tripped back to the client; leave blank unless the user wants to (re)supply it.
    state: str(residentialAddress.state),
    city: str(residentialAddress.city),
    street: str(residentialAddress.street),
    dateOfBirth: dateOnly(kyc.dateOfBirth),
    gender: str(kyc.gender),
    idType: str(kyc.idType),
    idNumber: str(kyc.idNumber),
    nokName: str(nextOfKin.name),
    nokRelationship: str(nextOfKin.relationship),
    nokPhone: str(nextOfKin.phoneNumber),
    nokAddress: str(nextOfKin.address),
    referenceName: str(reference.name),
    referenceRelationship: str(reference.relationship),
    referencePhone: str(reference.phoneNumber),
    referenceAddress: str(reference.address),
  };
}

function editFormToPayload(
  form: EditableStaffForm,
  files: { passportPhoto: File | null; idDocument: File | null },
): InitiateStaffOnboardingPayload {
  return {
    role: form.role as OnboardableStaffRole,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: form.phoneNumber.trim(),
    userType: form.userType as InitiateStaffOnboardingPayload['userType'],
    departmentId: form.departmentId,
    unitId: form.unitId,
    branchId: form.branchId,
    moduleAccess: [],
    startDate: form.startDate,
    bvn: form.bvn.trim() || undefined,
    residentialAddress: { state: form.state.trim(), city: form.city.trim(), street: form.street.trim() },
    kyc: {
      dateOfBirth: form.dateOfBirth,
      gender: form.gender as InitiateStaffOnboardingPayload['kyc']['gender'],
      idType: form.idType as InitiateStaffOnboardingPayload['kyc']['idType'],
      idNumber: form.idNumber.trim(),
    },
    nextOfKin: {
      name: form.nokName.trim(),
      relationship: form.nokRelationship.trim(),
      phoneNumber: form.nokPhone.trim(),
      address: form.nokAddress.trim(),
    },
    reference: {
      name: form.referenceName.trim(),
      relationship: form.referenceRelationship.trim(),
      phoneNumber: form.referencePhone.trim(),
      address: form.referenceAddress.trim(),
    },
    passportPhoto: files.passportPhoto ?? undefined,
    idDocument: files.idDocument ?? undefined,
  };
}

async function downloadRowsAsExcel(rows: DirectoryRow[], sheetLabel: string) {
  // Lazy-loaded — exceljs is a sizeable dependency only ever needed once
  // someone actually clicks "Download List", not on every page load.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetLabel);
  sheet.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Role', key: 'role', width: 16 },
    { header: 'Unit', key: 'unit', width: 22 },
    { header: 'Branch', key: 'branch', width: 22 },
    { header: 'Department', key: 'department', width: 22 },
    { header: 'Status', key: 'status', width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow({
      name: row.name,
      role: row.roleLabel,
      unit: row.unit,
      branch: row.branch,
      department: row.department,
      status: row.statusLabel,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `employee-directory-${sheetLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeftIcon size={16} />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}

export function HrManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const departments = useAppSelector((state) => state.lookups.departments);
  const units = useAppSelector((state) => state.lookups.roles);
  const branches = useAppSelector((state) => state.lookups.branches);

  // Org-wide BRANCH_ROLE_ASSIGNMENT proposals — the actual Admin/SuperAdmin/
  // Approver "authorizer" queue for "assign an admin to a branch". No
  // branch/staff filter here (unlike BranchDetail/StaffDetail's own use of
  // this hook) since this is the one page meant to surface every pending
  // one, not just those touching a page you happen to already be on.
  const roleAssignmentApprovals = useRoleAssignmentApprovals({}, (message, variant) =>
    variant === 'error' ? toast.error(message) : toast.success(message),
  );

  const [view, setView] = useState<'approved' | 'pending' | 'rejected'>('approved');

  const [employees, setEmployees] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<WorkflowRequestSummary[]>([]);
  const [pendingDetails, setPendingDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  const [rejectedRequests, setRejectedRequests] = useState<WorkflowRequestSummary[]>([]);
  const [rejectedDetails, setRejectedDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingRejected, setIsLoadingRejected] = useState(true);

  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  // A reason is required server-side to reject — captured via a modal
  // rather than acting immediately on click.
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  // Deleting a rejected request is a permanent hard delete — see
  // workflowRequestsService.deleteRequest's own doc comment (initiator only).
  const [deleteTargetRequestId, setDeleteTargetRequestId] = useState<string | null>(null);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);

  // Read-only "View" modal — works for either a Pending or a Rejected row
  // (whichever detail map actually has it).
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);

  // Withdrawing a still-PENDING_APPROVAL request is a soft cancel, not a hard
  // delete — see workflowRequestsService.cancel's own doc comment. STAFF's
  // chain is a single approve-only step, so a fresh proposal sits at
  // PENDING_APPROVAL immediately (never PENDING_REVIEW), which is why this
  // uses `cancel` rather than the generic hard-delete endpoint (that one's
  // PENDING_REVIEW/REJECTED only).
  const [withdrawTargetRequestId, setWithdrawTargetRequestId] = useState<string | null>(null);
  const [isWithdrawingRequest, setIsWithdrawingRequest] = useState(false);

  // Edit & Resubmit modal for a REJECTED request the viewer themselves proposed.
  const [editTargetRequestId, setEditTargetRequestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditableStaffForm>(EMPTY_EDIT_FORM);
  const [editPassportPhoto, setEditPassportPhoto] = useState<File | null>(null);
  const [editIdDocument, setEditIdDocument] = useState<File | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const isStaffDirectoryRoute = /^\/staff-management\/?$/.test(location.pathname);
    if (!isStaffDirectoryRoute) {
      return;
    }

    let isMounted = true;

    const loadApproved = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const staff = await staffService.list();
        if (isMounted) setEmployees(staff);
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : 'Failed to load organization staff');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const loadPending = async () => {
      setIsLoadingPending(true);
      try {
        const requests = await workflowRequestsService.getPendingByEntityType(STAFF_ENTITY_TYPE);
        if (!isMounted) return;
        setPendingRequests(requests);
        const details = await Promise.all(requests.map((request) => workflowRequestsService.getById(request.id)));
        if (!isMounted) return;
        setPendingDetails(Object.fromEntries(details.map((detail) => [detail.id, detail])));
      } catch {
        if (isMounted) {
          setPendingRequests([]);
          setPendingDetails({});
        }
      } finally {
        if (isMounted) setIsLoadingPending(false);
      }
    };

    const loadRejected = async () => {
      setIsLoadingRejected(true);
      try {
        const requests = await workflowRequestsService.getRejectedByEntityType(STAFF_ENTITY_TYPE);
        if (!isMounted) return;
        setRejectedRequests(requests);
        const details = await Promise.all(requests.map((request) => workflowRequestsService.getById(request.id)));
        if (!isMounted) return;
        setRejectedDetails(Object.fromEntries(details.map((detail) => [detail.id, detail])));
      } catch {
        if (isMounted) {
          setRejectedRequests([]);
          setRejectedDetails({});
        }
      } finally {
        if (isMounted) setIsLoadingRejected(false);
      }
    };

    void loadApproved();
    void loadPending();
    void loadRejected();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function refreshPendingAndRejected() {
    try {
      const [pending, rejected] = await Promise.all([
        workflowRequestsService.getPendingByEntityType(STAFF_ENTITY_TYPE),
        workflowRequestsService.getRejectedByEntityType(STAFF_ENTITY_TYPE),
      ]);
      setPendingRequests(pending);
      setRejectedRequests(rejected);
      const [pendingDetailList, rejectedDetailList] = await Promise.all([
        Promise.all(pending.map((request) => workflowRequestsService.getById(request.id))),
        Promise.all(rejected.map((request) => workflowRequestsService.getById(request.id))),
      ]);
      setPendingDetails(Object.fromEntries(pendingDetailList.map((detail) => [detail.id, detail])));
      setRejectedDetails(Object.fromEntries(rejectedDetailList.map((detail) => [detail.id, detail])));
    } catch {
      // best-effort — the tabs just keep showing whatever they already had
    }
  }

  async function handleWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      const staff = await staffService.list();
      setEmployees(staff);
      await refreshPendingAndRejected();
      if (action === 'APPROVED') {
        // It doesn't just vanish from Pending — jump the viewer straight to
        // where it actually landed, instead of leaving them staring at a
        // Pending tab with one fewer row and no visible destination.
        setView('approved');
        toast.success('Staff onboarding approved — now showing in Approved.');
      } else {
        setView('rejected');
        toast.success('Staff onboarding rejected — now showing in Rejected.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to act on this request');
    } finally {
      setActingRequestId(null);
    }
  }

  function confirmReject(comment?: string) {
    if (!rejectTargetId || !comment?.trim()) return;
    void handleWorkflowAction(rejectTargetId, 'REJECTED', comment.trim());
    setRejectTargetId(null);
  }

  async function handleDeleteRequest() {
    if (!deleteTargetRequestId) return;
    setIsDeletingRequest(true);
    try {
      await workflowRequestsService.deleteRequest(deleteTargetRequestId);
      toast.success('Rejected staff request deleted');
      setDeleteTargetRequestId(null);
      await refreshPendingAndRejected();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete this request');
    } finally {
      setIsDeletingRequest(false);
    }
  }

  async function handleWithdrawRequest() {
    if (!withdrawTargetRequestId) return;
    setIsWithdrawingRequest(true);
    try {
      await workflowRequestsService.cancel(withdrawTargetRequestId);
      toast.success('Proposal withdrawn');
      setWithdrawTargetRequestId(null);
      await refreshPendingAndRejected();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw this proposal');
    } finally {
      setIsWithdrawingRequest(false);
    }
  }

  function openEditModal(requestId: string) {
    const detail = rejectedDetails[requestId];
    if (!detail) {
      toast.error('Still loading this request — try again in a moment');
      return;
    }
    setEditForm(payloadToEditForm(detail.payload));
    setEditPassportPhoto(null);
    setEditIdDocument(null);
    setEditTargetRequestId(requestId);
  }

  function updateEditField<K extends keyof EditableStaffForm>(field: K, value: EditableStaffForm[K]) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleResubmit() {
    if (!editTargetRequestId) return;
    setIsResubmitting(true);
    try {
      const payload = editFormToPayload(editForm, {
        passportPhoto: editPassportPhoto,
        idDocument: editIdDocument,
      });
      await staffService.resubmitOnboarding(editTargetRequestId, payload);
      toast.success('Staff onboarding resubmitted for approval');
      setEditTargetRequestId(null);
      await refreshPendingAndRejected();
      setView('pending');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resubmit this request');
    } finally {
      setIsResubmitting(false);
    }
  }

  const approvedRows = useMemo(
    () => employees.map((staff) => mapStaffToRow(staff, departments, units, branches)),
    [employees, departments, units, branches],
  );
  const pendingRows = useMemo(
    () =>
      pendingRequests.map((entry) =>
        mapWorkflowRequestToRow(entry, pendingDetails[entry.id], 'Pending Approval', departments, units, branches),
      ),
    [pendingRequests, pendingDetails, departments, units, branches],
  );
  const rejectedRows = useMemo(
    () =>
      rejectedRequests.map((entry) =>
        mapWorkflowRequestToRow(entry, rejectedDetails[entry.id], 'Rejected', departments, units, branches),
      ),
    [rejectedRequests, rejectedDetails, departments, units, branches],
  );

  const activeRows = view === 'approved' ? approvedRows : view === 'pending' ? pendingRows : rejectedRows;
  const activeIsLoading = view === 'approved' ? isLoading : view === 'pending' ? isLoadingPending : isLoadingRejected;

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activeRows.filter((row) => {
      if (query && !row.name.toLowerCase().includes(query)) return false;
      if (filterBranchId && row.branchId !== filterBranchId) return false;
      if (filterRole && row.roleValue !== filterRole) return false;
      if (filterDepartmentId && row.departmentId !== filterDepartmentId) return false;
      return true;
    });
  }, [activeRows, searchQuery, filterBranchId, filterRole, filterDepartmentId]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  // Reset to page 1 whenever the tab, search, or a filter changes — a stale
  // page number from a longer list would otherwise render an empty page.
  function updateView(next: typeof view) {
    setView(next);
    setPage(1);
  }
  function updateSearch(value: string) {
    setSearchQuery(value);
    setPage(1);
  }
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const activeStaffCount = useMemo(() => employees.filter((staff) => staff.status === 'ACTIVE').length, [employees]);

  // Whichever tab it came from — a request only ever lives in one of the two maps at a time.
  const viewingDetail = viewingRequestId
    ? (pendingDetails[viewingRequestId] ?? rejectedDetails[viewingRequestId] ?? null)
    : null;
  const viewingPayload = (viewingDetail?.payload ?? {}) as Record<string, unknown>;
  const lookupName = (items: LookupItem[], id: unknown): string =>
    items.find((item) => item.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* <h2 className="text-xl font-heading font-bold text-primary">Staff Management</h2> */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/onboarding/staff')}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors">
            <PlusIcon size={14} />
            Onboard Staff
          </button>
          <button
            onClick={() => void downloadRowsAsExcel(filteredRows, view === 'approved' ? 'Approved' : view === 'pending' ? 'Pending' : 'Rejected')}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-heading font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <DownloadIcon size={14} />
            Download List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 mr-4">
            <UsersIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Employees</p>
            <h3 className="text-2xl font-heading font-bold text-primary">{isLoading ? '—' : employees.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 rounded-lg text-green-600 mr-4">
            <UserCheckIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Active Staff</p>
            <h3 className="text-2xl font-heading font-bold text-primary">{isLoading ? '—' : activeStaffCount}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600 mr-4">
            <UserMinusIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Pending Approval</p>
            <h3 className="text-2xl font-heading font-bold text-primary">{isLoadingPending ? '—' : pendingRequests.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600 mr-4">
            <BriefcaseIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Departments</p>
            <h3 className="text-2xl font-heading font-bold text-primary">{departments.length}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="p-6 border-b border-gray-100 space-y-4">
          <h3 className="text-lg font-heading font-bold text-primary">Employee Directory</h3>

          <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => updateView('approved')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'approved' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Approved ({approvedRows.length})
            </button>
            <button
              onClick={() => updateView('pending')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Pending ({pendingRows.length})
            </button>
            <button
              onClick={() => updateView('rejected')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Rejected ({rejectedRows.length})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search by name..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <select
              value={filterBranchId}
              onChange={(event) => updateFilter(setFilterBranchId, event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-body bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(event) => updateFilter(setFilterRole, event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-body bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">All Roles</option>
              {STAFF_ROLE_OPTIONS.map((option:any) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={filterDepartmentId}
              onChange={(event) => updateFilter(setFilterDepartmentId, event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-body bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Unit</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Department</th>
                <th className="px-6 py-4 font-medium">Status</th>
                {(view === 'pending' || view === 'rejected') && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {activeIsLoading && (
                <tr>
                  <td colSpan={view === 'pending' || view === 'rejected' ? 8 : 7} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <LoaderIcon size={18} className="animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!activeIsLoading && loadError && view === 'approved' && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-red-600">
                    {loadError}
                  </td>
                </tr>
              )}

              {!activeIsLoading && (view !== 'approved' || !loadError) && pageRows.length === 0 && (
                <tr>
                  <td colSpan={view === 'pending' || view === 'rejected' ? 8 : 7} className="px-6 py-10 text-center text-sm text-gray-500">
                    {view === 'approved' && 'No staff records match your search/filters.'}
                    {view === 'pending' && (
                      <span className="inline-flex items-center gap-2">
                        <ClockIcon size={16} className="text-gray-300" /> Nothing awaiting approval.
                      </span>
                    )}
                    {view === 'rejected' && (
                      <span className="inline-flex items-center gap-2">
                        <CircleXIcon size={16} className="text-gray-300" /> Nothing rejected.
                      </span>
                    )}
                  </td>
                </tr>
              )}

              {!activeIsLoading &&
                pageRows.map((row) => {
                  const isOwnProposal = (view === 'pending' || view === 'rejected') && user?.id === row.proposedBy;
                  return (
                    <tr
                      key={row.key}
                      onClick={() => row.backendId && navigate(`/staff-management/${row.backendId}`)}
                      className={`transition-colors ${row.backendId ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
                      <td className="px-6 py-4">
                        <p className="font-heading font-medium text-primary">{row.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">{row.backendId ? buildFrontendStaffId(row.backendId) : `Request ${row.requestId?.slice(-6)}`}</p>
                        </div>
                        {view === 'pending' && row.proposedAt && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Proposed {new Date(row.proposedAt).toLocaleDateString()}
                            {isOwnProposal ? ' · your proposal' : ''}
                          </p>
                        )}
                        {view === 'rejected' && row.rejectedAt && (
                          <p className="text-xs text-red-500 mt-0.5">
                            Rejected {new Date(row.rejectedAt).toLocaleDateString()}
                            {row.rejectionComment ? `: "${row.rejectionComment}"` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{row.email || '—'}</td>
                      <td className="px-6 py-4 text-gray-700">{row.roleLabel}</td>
                      <td className="px-6 py-4 text-gray-600">{row.unit}</td>
                      <td className="px-6 py-4 text-gray-600">{row.branch}</td>
                      <td className="px-6 py-4 text-gray-600">{row.department}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={row.statusLabel} />
                      </td>
                      {view === 'pending' && (
                        <td className="px-6 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {row.requestId && (
                              <button
                                onClick={() => setViewingRequestId(row.requestId)}
                                title="View proposal details"
                                aria-label="View proposal details"
                                className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                                <EyeIcon size={14} />
                              </button>
                            )}
                            {isOwnProposal ? (
                              <>
                                <span className="text-xs text-gray-400">Awaiting another reviewer</span>
                                {row.requestId && (
                                  <button
                                    onClick={() => setWithdrawTargetRequestId(row.requestId)}
                                    title="Withdraw this proposal"
                                    aria-label="Withdraw this proposal"
                                    className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                                    <Trash2Icon size={14} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  disabled={actingRequestId === row.requestId}
                                  onClick={() => row.requestId && void handleWorkflowAction(row.requestId, 'APPROVED')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60">
                                  <CheckCircleIcon size={13} /> Approve
                                </button>
                                <button
                                  disabled={actingRequestId === row.requestId}
                                  onClick={() => row.requestId && setRejectTargetId(row.requestId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
                                  <XCircleIcon size={13} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                      {view === 'rejected' && (
                        <td className="px-6 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {row.requestId && (
                              <button
                                onClick={() => setViewingRequestId(row.requestId)}
                                title="View proposal details"
                                aria-label="View proposal details"
                                className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                                <EyeIcon size={14} />
                              </button>
                            )}
                            {isOwnProposal && row.requestId && (
                              <>
                                <button
                                  onClick={() => openEditModal(row.requestId!)}
                                  title="Edit and resubmit for approval"
                                  aria-label="Edit and resubmit for approval"
                                  className="p-2 border border-primary/20 text-primary rounded-lg hover:bg-primary/5 transition-colors">
                                  <PencilIcon size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteTargetRequestId(row.requestId)}
                                  title="Delete this rejected request"
                                  aria-label="Delete this rejected request"
                                  className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                                  <Trash2Icon size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <Pagination page={clampedPage} totalPages={totalPages} onChange={setPage} />
      </div>

      {/* Org-wide branch role assignment approvals — an Admin/SuperAdmin/
          Approver assigning another staff member to cover a branch (see
          StaffDetail.tsx's "Propose Assignment") lands here for a different
          Admin/SuperAdmin/Approver to approve or reject. Approving here
          activates the coverage and notifies the assigned staff member. */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6 space-y-4">
        <div>
          <h3 className="text-lg font-heading font-bold text-primary">Branch Role Assignments</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Admins/Approvers proposed to cover one or more branches — awaiting a different Admin/SuperAdmin/Approver's review.
          </p>
        </div>
        <RoleAssignmentApprovalsPanel state={roleAssignmentApprovals} />
      </div>

      <ConfirmationModal
        isOpen={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        onConfirm={(reason) => confirmReject(reason)}
        title="Reject this staff onboarding request?"
        description="A reason is required — the Branch Manager who proposed it will see it."
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. Missing valid ID documentation"
        requireInput
      />

      <ConfirmationModal
        isOpen={deleteTargetRequestId !== null}
        onClose={() => setDeleteTargetRequestId(null)}
        onConfirm={() => void handleDeleteRequest()}
        title="Delete this rejected request?"
        description="This permanently removes the request — it cannot be undone."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isDeletingRequest ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
      />

      <ConfirmationModal
        isOpen={withdrawTargetRequestId !== null}
        onClose={() => setWithdrawTargetRequestId(null)}
        onConfirm={() => void handleWithdrawRequest()}
        title="Withdraw this proposal?"
        description="This removes it from the approval queue — nothing was ever created, so there's nothing else to undo. This cannot be reversed."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isWithdrawingRequest ? 'Withdrawing…' : 'Withdraw'}
        confirmVariant="danger"
      />

      {/* ─── View proposal details (Pending or Rejected) ─────── */}
      {viewingRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewingRequestId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold text-gray-900">Proposal Details</h3>
              <button onClick={() => setViewingRequestId(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <XIcon size={18} />
              </button>
            </div>
            {!viewingDetail ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Personal</p>
                  <p className="font-heading font-bold text-gray-900">
                    {toTitleCase(`${String(viewingPayload.firstName ?? '')} ${String(viewingPayload.lastName ?? '')}`.trim())}
                  </p>
                  <p className="text-gray-600">{String(viewingPayload.email ?? '—')} · {String(viewingPayload.phoneNumber ?? '—')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Role</p>
                    <p className="text-gray-800 font-medium">{STAFF_ROLE_LABEL[String(viewingPayload.role)] ?? String(viewingPayload.role ?? '—')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">User Type</p>
                    <p className="text-gray-800 font-medium">{String(viewingPayload.userType ?? '—')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Department</p>
                    <p className="text-gray-800 font-medium">{lookupName(departments, viewingPayload.departmentId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Unit</p>
                    <p className="text-gray-800 font-medium">{lookupName(units, viewingPayload.unitId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Branch</p>
                    <p className="text-gray-800 font-medium">{lookupName(branches, viewingPayload.branchId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Start Date</p>
                    <p className="text-gray-800 font-medium">{String(viewingPayload.startDate ?? '—').slice(0, 10)}</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">KYC</p>
                  {(() => {
                    const kyc = (viewingPayload.kyc ?? {}) as Record<string, unknown>;
                    return (
                      <p className="text-gray-700">
                        {String(kyc.gender ?? '—')} · DOB {String(kyc.dateOfBirth ?? '—').slice(0, 10)} · {String(kyc.idType ?? '—')} {String(kyc.idNumber ?? '')}
                      </p>
                    );
                  })()}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Residential Address</p>
                  {(() => {
                    const address = (viewingPayload.residentialAddress ?? {}) as Record<string, unknown>;
                    return (
                      <p className="text-gray-700">
                        {String(address.street ?? '—')}, {String(address.city ?? '—')}, {String(address.state ?? '—')}
                      </p>
                    );
                  })()}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Next of Kin</p>
                  {(() => {
                    const nok = (viewingPayload.nextOfKin ?? {}) as Record<string, unknown>;
                    return (
                      <p className="text-gray-700">
                        {String(nok.name ?? '—')} ({String(nok.relationship ?? '—')}) · {String(nok.phoneNumber ?? '—')}
                      </p>
                    );
                  })()}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Reference</p>
                  {(() => {
                    const reference = (viewingPayload.reference ?? {}) as Record<string, unknown>;
                    return (
                      <p className="text-gray-700">
                        {String(reference.name ?? '—')} ({String(reference.relationship ?? '—')}) · {String(reference.phoneNumber ?? '—')}
                      </p>
                    );
                  })()}
                </div>
                {Boolean(viewingPayload.passportPhotoUrl || viewingPayload.idDocumentUrl) && (
                  <div className="border-t border-gray-100 pt-3 flex gap-4">
                    {typeof viewingPayload.passportPhotoUrl === 'string' && viewingPayload.passportPhotoUrl && (
                      <a href={viewingPayload.passportPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-medium hover:underline">
                        View passport photo
                      </a>
                    )}
                    {typeof viewingPayload.idDocumentUrl === 'string' && viewingPayload.idDocumentUrl && (
                      <a href={viewingPayload.idDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-medium hover:underline">
                        View ID document
                      </a>
                    )}
                  </div>
                )}
                {view === 'rejected' && viewingDetail.steps.some((step) => step.action === 'REJECTED') && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Rejection Reason</p>
                    <p className="text-red-600">
                      {viewingDetail.steps.find((step) => step.action === 'REJECTED')?.comment ?? '—'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Edit & Resubmit (Rejected, own proposal only) ────── */}
      {editTargetRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditTargetRequestId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-heading font-bold text-gray-900">Edit &amp; Resubmit</h3>
                <p className="text-xs text-gray-500">Correcting a rejected staff onboarding proposal — this restarts the approval chain.</p>
              </div>
              <button onClick={() => setEditTargetRequestId(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <XIcon size={18} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleResubmit();
              }}
              className="space-y-5"
            >
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Personal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required value={editForm.firstName} onChange={(e) => updateEditField('firstName', e.target.value)} placeholder="First name" className={editInputClass} />
                  <input required value={editForm.lastName} onChange={(e) => updateEditField('lastName', e.target.value)} placeholder="Last name" className={editInputClass} />
                  <input required type="email" value={editForm.email} onChange={(e) => updateEditField('email', e.target.value)} placeholder="Email" className={editInputClass} />
                  <input required value={editForm.phoneNumber} onChange={(e) => updateEditField('phoneNumber', e.target.value)} placeholder="Phone number" className={editInputClass} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Role &amp; Organisation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select required value={editForm.role} onChange={(e) => updateEditField('role', e.target.value)} className={editInputClass}>
                    <option value="">Select role...</option>
                    {STAFF_ROLE_OPTIONS.filter((option) => option.value !== 'SUPERADMIN').map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select required value={editForm.userType} onChange={(e) => updateEditField('userType', e.target.value)} className={editInputClass}>
                    <option value="">Select user type...</option>
                    {STAFF_USER_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select required value={editForm.departmentId} onChange={(e) => updateEditField('departmentId', e.target.value)} className={editInputClass}>
                    <option value="">Select department...</option>
                    {departments.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <select required value={editForm.unitId} onChange={(e) => updateEditField('unitId', e.target.value)} className={editInputClass}>
                    <option value="">Select unit...</option>
                    {units.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <select required value={editForm.branchId} onChange={(e) => updateEditField('branchId', e.target.value)} className={editInputClass}>
                    <option value="">Select branch...</option>
                    {branches.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <input required type="date" value={editForm.startDate} onChange={(e) => updateEditField('startDate', e.target.value)} className={editInputClass} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">KYC</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required type="date" value={editForm.dateOfBirth} onChange={(e) => updateEditField('dateOfBirth', e.target.value)} className={editInputClass} />
                  <select required value={editForm.gender} onChange={(e) => updateEditField('gender', e.target.value)} className={editInputClass}>
                    <option value="">Select gender...</option>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select required value={editForm.idType} onChange={(e) => updateEditField('idType', e.target.value)} className={editInputClass}>
                    <option value="">Select ID type...</option>
                    {ID_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input required value={editForm.idNumber} onChange={(e) => updateEditField('idNumber', e.target.value)} placeholder="ID number" className={editInputClass} />
                  <input value={editForm.bvn} onChange={(e) => updateEditField('bvn', e.target.value)} placeholder="BVN (leave blank to keep unchanged)" className={editInputClass} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Residential Address</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input required value={editForm.state} onChange={(e) => updateEditField('state', e.target.value)} placeholder="State" className={editInputClass} />
                  <input required value={editForm.city} onChange={(e) => updateEditField('city', e.target.value)} placeholder="City" className={editInputClass} />
                  <input required value={editForm.street} onChange={(e) => updateEditField('street', e.target.value)} placeholder="Street" className={editInputClass} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Next of Kin</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required value={editForm.nokName} onChange={(e) => updateEditField('nokName', e.target.value)} placeholder="Name" className={editInputClass} />
                  <input required value={editForm.nokRelationship} onChange={(e) => updateEditField('nokRelationship', e.target.value)} placeholder="Relationship" className={editInputClass} />
                  <input required value={editForm.nokPhone} onChange={(e) => updateEditField('nokPhone', e.target.value)} placeholder="Phone number" className={editInputClass} />
                  <input required value={editForm.nokAddress} onChange={(e) => updateEditField('nokAddress', e.target.value)} placeholder="Address" className={editInputClass} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reference</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required value={editForm.referenceName} onChange={(e) => updateEditField('referenceName', e.target.value)} placeholder="Name" className={editInputClass} />
                  <input required value={editForm.referenceRelationship} onChange={(e) => updateEditField('referenceRelationship', e.target.value)} placeholder="Relationship" className={editInputClass} />
                  <input required value={editForm.referencePhone} onChange={(e) => updateEditField('referencePhone', e.target.value)} placeholder="Phone number" className={editInputClass} />
                  <input required value={editForm.referenceAddress} onChange={(e) => updateEditField('referenceAddress', e.target.value)} placeholder="Address" className={editInputClass} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Documents (optional — leave blank to keep what's already on file)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-primary/40">
                    <UploadCloudIcon size={16} />
                    {editPassportPhoto ? editPassportPhoto.name : 'Replace passport photo'}
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => setEditPassportPhoto(e.target.files?.[0] ?? null)} />
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-primary/40">
                    <UploadCloudIcon size={16} />
                    {editIdDocument ? editIdDocument.name : 'Replace ID document'}
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => setEditIdDocument(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEditTargetRequestId(null)} className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isResubmitting} className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {isResubmitting ? 'Resubmitting...' : 'Resubmit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
