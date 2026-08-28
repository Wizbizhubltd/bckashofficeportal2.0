import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  UserIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  ClockIcon,
  BarChart3Icon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon,
  KeyIcon,
  ImageIcon,
  PencilIcon,
  UserCogIcon,
  ExternalLinkIcon,
  LoaderIcon,
  XIcon,
  LucideIcon,
  Building2Icon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ProfileAvatar, resolveUploadUrl } from '../../components/ProfileAvatar';
import { ReusableMultiSelect } from '../../components/ReusableMultiSelect';
import { ReusableReactSelect, type SelectOption } from '../../components/ReusableReactSelect';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ID_TYPE_LABEL,
  ID_TYPE_OPTIONS,
  STAFF_ROLE_LABEL,
  STAFF_ROLE_OPTIONS,
  STAFF_STATUS_LABEL,
  STAFF_USER_TYPE_OPTIONS,
} from '../../constants/identity-options';
import { referenceDataService } from '../../services/reference-data/reference-data.service';
import {
  branchStaffAssignmentsService,
  type BranchStaffRoleAssignment,
} from '../../services/branch-staff-assignments/branch-staff-assignments.service';
import {
  staffService,
  type Gender,
  type IdentificationType,
  type Staff,
  type StaffActivityEntry,
  type StaffPerformanceSummary,
  type UpdateStaffProfilePayload,
} from '../../services/staff/staff.service';
import { useRoleAssignmentApprovals } from '../../hooks/useRoleAssignmentApprovals';
import { RoleAssignmentApprovalsPanel } from '../../components/RoleAssignmentApprovalsPanel';
import { useAppSelector } from '../../store/hooks';
import { buildFrontendStaffId, toTitleCase } from '../../utils/staff-display';

const DATE_FORMAT = 'DD MMM YYYY';
const DATETIME_FORMAT = 'DD MMM YYYY, h:mm A';
const PHONE_REGEX = /^(?:\+234|0)[789]\d{9}$/;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type StaffTabKey = 'personal' | 'employment' | 'kyc' | 'performance' | 'activity' | 'branch-assignments';

const BASE_TABS: { key: StaffTabKey; label: string; icon: LucideIcon }[] = [
  { key: 'personal', label: 'Personal Info', icon: UserIcon },
  { key: 'employment', label: 'Employment', icon: BriefcaseIcon },
  { key: 'kyc', label: 'KYC & Verification', icon: ShieldCheckIcon },
  { key: 'performance', label: 'Performance', icon: BarChart3Icon },
  { key: 'activity', label: 'Activity Log', icon: ClockIcon },
];

// Branch coverage only ever applies to ADMIN/APPROVER (see
// BranchStaffAssignmentRole's own doc comment — MANAGER stays the existing
// single-branch BranchManagerAssignment model, everyone else is never
// branch-scoped) — shown as an extra tab rather than a separate page since
// it's just one more facet of this staff member's record.
const BRANCH_ASSIGNMENT_ROLES: readonly Staff['role'][] = ['ADMIN', 'APPROVER'];

function normalizeName(input: string): string {
  return input.trim().toLowerCase();
}

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) {
    return '—';
  }
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format(withTime ? DATETIME_FORMAT : DATE_FORMAT) : '—';
}

function formatDateForInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const parsed = moment(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

type EditFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  idType: string;
  idNumber: string;
  state: string;
  city: string;
  street: string;
  nokName: string;
  nokRelationship: string;
  nokPhone: string;
  nokAddress: string;
  referenceName: string;
  referenceRelationship: string;
  referencePhone: string;
  referenceAddress: string;
  role: string;
  userType: string;
  departmentId: string;
  unitId: string;
  branchId: string;
  employmentType: string;
  salaryGrade: string;
  managerId: string;
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-400 font-body mb-1">{label}</p>
      <p className="text-xl font-heading font-bold text-gray-800">{value}</p>
    </div>
  );
}

function ComplianceRow({
  label,
  icon,
  verified,
  canToggle,
  onToggle,
  isBusy,
}: {
  label: string;
  icon: React.ReactNode;
  verified: boolean;
  canToggle: boolean;
  onToggle?: () => void;
  isBusy?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">{icon}</div>
        <span className="text-sm font-body text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={verified ? 'Verified' : 'Pending'} />
        {canToggle && onToggle && (
          <button
            onClick={onToggle}
            disabled={isBusy}
            className="text-xs font-body text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {isBusy ? '...' : verified ? 'Unmark' : 'Verify'}
          </button>
        )}
      </div>
    </div>
  );
}

export function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const departments = useAppSelector((state) => state.lookups.departments);
  const storeUnits = useAppSelector((state) => state.lookups.roles);
  const branches = useAppSelector((state) => state.lookups.branches);
  const states = useAppSelector((state) => state.lookups.states);

  const [activeTab, setActiveTab] = useState<StaffTabKey>('personal');
  const [staff, setStaff] = useState<Staff | null>(null);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [performance, setPerformance] = useState<StaffPerformanceSummary | null>(null);
  const [activity, setActivity] = useState<StaffActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState<'personal' | 'employment'>('personal');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [bvnModalOpen, setBvnModalOpen] = useState(false);
  const [bvnInput, setBvnInput] = useState('');
  const [isVerifyingBvn, setIsVerifyingBvn] = useState(false);
  const [compliancePending, setCompliancePending] = useState<string | null>(null);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const [coverage, setCoverage] = useState<BranchStaffRoleAssignment[]>([]);
  const [isLoadingCoverage, setIsLoadingCoverage] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignBranchIds, setAssignBranchIds] = useState<string[]>([]);
  const [assignComments, setAssignComments] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<BranchStaffRoleAssignment | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // `super_admin`/`admin` only reach this page at all (see App.tsx's
  // ORG_MANAGERS guard) — the one further restriction is the seeded
  // SuperAdmin's own record, never editable through this form.
  const canEdit = staff?.role !== 'SUPERADMIN';

  const loadAll = async (staffId: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [staffResult, allStaffResult, performanceResult, activityResult] = await Promise.all([
        staffService.getById(staffId),
        staffService.list(),
        staffService.getPerformance(staffId),
        staffService.getActivity(staffId),
      ]);
      setStaff(staffResult);
      setAllStaff(allStaffResult);
      setPerformance(performanceResult);
      setActivity(activityResult);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load staff record');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      return;
    }
    let isMounted = true;
    (async () => {
      if (isMounted) await loadAll(id);
    })();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const showBranchAssignments = staff ? BRANCH_ASSIGNMENT_ROLES.includes(staff.role) : false;
  const tabs = showBranchAssignments
    ? [...BASE_TABS, { key: 'branch-assignments' as const, label: 'Branch Coverage', icon: Building2Icon }]
    : BASE_TABS;

  const loadCoverage = async (staffId: string) => {
    setIsLoadingCoverage(true);
    try {
      setCoverage(await branchStaffAssignmentsService.getForStaff(staffId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load branch coverage');
    } finally {
      setIsLoadingCoverage(false);
    }
  };

  useEffect(() => {
    if (staff && showBranchAssignments) {
      loadCoverage(staff.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id, showBranchAssignments]);

  // Pending/rejected BRANCH_ROLE_ASSIGNMENT proposals for this staff member —
  // otherwise a proposed assignment (see handleAssignSubmit below) is
  // invisible anywhere for an Admin/SuperAdmin/Approver to act on. See
  // useRoleAssignmentApprovals's own doc comment.
  const roleAssignmentApprovals = useRoleAssignmentApprovals(
    { staffId: staff?.id },
    (message, variant) => (variant === 'error' ? toast.error(message) : toast.success(message)),
    () => staff && loadCoverage(staff.id),
  );

  // A tab this staff member no longer qualifies for (e.g. their role was
  // just changed away from ADMIN/APPROVER) shouldn't stay selected and blank.
  useEffect(() => {
    if (!showBranchAssignments && activeTab === 'branch-assignments') {
      setActiveTab('personal');
    }
  }, [showBranchAssignments, activeTab]);

  const fullName = staff ? toTitleCase(`${staff.firstName} ${staff.lastName}`.trim()) : '';
  const departmentName = departments.find((d) => d.id === staff?.departmentId)?.name ?? '—';
  const unitName = storeUnits.find((r) => r.id === staff?.unitId)?.name ?? '—';
  const branchName = branches.find((b) => b.id === staff?.branchId)?.name ?? '—';
  const manager = allStaff.find((s) => s.id === staff?.managerId);
  const managerName = manager ? toTitleCase(`${manager.firstName} ${manager.lastName}`.trim()) : '—';

  const managerOptions: SelectOption[] = allStaff
    .filter((s) => s.id !== staff?.id && s.role !== 'SUPERADMIN')
    .map((s) => ({
      label: `${toTitleCase(`${s.firstName} ${s.lastName}`.trim())} (${STAFF_ROLE_LABEL[s.role] ?? s.role})`,
      value: s.id,
    }));

  const departmentOptions: SelectOption[] = departments.map((d) => ({ label: d.name, value: d.id }));
  const branchOptions: SelectOption[] = branches.map((b) => ({ label: b.name, value: b.id }));
  const coveredBranchIds = new Set(coverage.map((row) => row.branchId));
  const assignableBranchOptions: SelectOption[] = branchOptions.filter((option) => !coveredBranchIds.has(option.value));
  const stateOptions: SelectOption[] = states.map((s) => ({ label: s.name, value: s.id }));
  const cityOptions: SelectOption[] = cities.map((c) => ({ label: c.name, value: c.id }));

  const getEditInitialValues = (): EditFormValues => {
    const selectedStateId = states.find((s) => s.name === staff?.residentialAddress?.state)?.id ?? '';
    return {
      firstName: staff?.firstName ?? '',
      lastName: staff?.lastName ?? '',
      email: staff?.email ?? '',
      phoneNumber: staff?.phoneNumber ?? '',
      dateOfBirth: formatDateForInput(staff?.kyc?.dateOfBirth),
      gender: staff?.kyc?.gender ?? '',
      idType: staff?.kyc?.idType ?? '',
      idNumber: staff?.kyc?.idNumber ?? '',
      state: selectedStateId,
      city: '', // resolved once the city list for `state` has loaded — see effect below
      street: staff?.residentialAddress?.street ?? '',
      nokName: staff?.nextOfKin?.name ?? '',
      nokRelationship: staff?.nextOfKin?.relationship ?? '',
      nokPhone: staff?.nextOfKin?.phoneNumber ?? '',
      nokAddress: staff?.nextOfKin?.address ?? '',
      referenceName: staff?.reference?.name ?? '',
      referenceRelationship: staff?.reference?.relationship ?? '',
      referencePhone: staff?.reference?.phoneNumber ?? '',
      referenceAddress: staff?.reference?.address ?? '',
      role: staff?.role ?? '',
      userType: staff?.userType ?? '',
      departmentId: staff?.departmentId ?? '',
      unitId: staff?.unitId ?? '',
      branchId: staff?.branchId ?? '',
      employmentType: staff?.employmentType ?? '',
      salaryGrade: staff?.salaryGrade ?? '',
      managerId: staff?.managerId ?? '',
    };
  };

  const personalSchema = Yup.object({
    firstName: Yup.string().trim().required('First name is required'),
    lastName: Yup.string().trim().required('Last name is required'),
    email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
    phoneNumber: Yup.string().trim().matches(PHONE_REGEX, 'Enter a valid Nigerian mobile number').required('Phone number is required'),
    nokPhone: Yup.string().trim().matches(PHONE_REGEX, 'Enter a valid Nigerian mobile number').required('Next of kin phone is required'),
    referencePhone: Yup.string().trim().matches(PHONE_REGEX, 'Enter a valid Nigerian mobile number').required('Reference phone is required'),
  });

  const employmentSchema = Yup.object({
    role: Yup.string().required('Role is required'),
    userType: Yup.string().required('User type is required'),
    departmentId: Yup.string().required('Department is required'),
    unitId: Yup.string().required('Unit is required'),
    branchId: Yup.string().required('Branch is required'),
  });

  const formik = useFormik<EditFormValues>({
    initialValues: getEditInitialValues(),
    validationSchema: editTab === 'personal' ? personalSchema : employmentSchema,
    validateOnBlur: true,
    validateOnChange: false,
    enableReinitialize: false,
    onSubmit: async (values) => {
      if (!staff) return;
      setIsSavingEdit(true);
      try {
        const payload: UpdateStaffProfilePayload =
          editTab === 'personal'
            ? {
                firstName: values.firstName.trim(),
                lastName: values.lastName.trim(),
                email: values.email.trim().toLowerCase(),
                phoneNumber: values.phoneNumber.trim(),
                kyc:
                  values.dateOfBirth && values.gender && values.idType && values.idNumber
                    ? {
                        dateOfBirth: values.dateOfBirth,
                        gender: values.gender as Gender,
                        idType: values.idType as IdentificationType,
                        idNumber: values.idNumber.trim(),
                      }
                    : undefined,
                residentialAddress:
                  values.state && values.city && values.street
                    ? {
                        state: stateOptions.find((o) => o.value === values.state)?.label ?? values.state,
                        city: cityOptions.find((o) => o.value === values.city)?.label ?? values.city,
                        street: values.street.trim(),
                      }
                    : undefined,
                nextOfKin:
                  values.nokName && values.nokRelationship && values.nokPhone && values.nokAddress
                    ? {
                        name: values.nokName.trim(),
                        relationship: values.nokRelationship.trim(),
                        phoneNumber: values.nokPhone.trim(),
                        address: values.nokAddress.trim(),
                      }
                    : undefined,
                reference:
                  values.referenceName && values.referenceRelationship && values.referencePhone && values.referenceAddress
                    ? {
                        name: values.referenceName.trim(),
                        relationship: values.referenceRelationship.trim(),
                        phoneNumber: values.referencePhone.trim(),
                        address: values.referenceAddress.trim(),
                      }
                    : undefined,
              }
            : {
                role: values.role as UpdateStaffProfilePayload['role'],
                userType: values.userType as UpdateStaffProfilePayload['userType'],
                departmentId: values.departmentId,
                unitId: values.unitId,
                branchId: values.branchId,
                employmentType: values.employmentType ? (values.employmentType as UpdateStaffProfilePayload['employmentType']) : undefined,
                salaryGrade: values.salaryGrade.trim() || undefined,
                managerId: values.managerId,
              };

        const updated = await staffService.updateProfile(staff.id, payload);
        setStaff(updated);
        if (id) {
          const [nextActivity] = await Promise.all([staffService.getActivity(id)]);
          setActivity(nextActivity);
        }
        toast.success('Staff record updated.');
        setIsEditModalOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update staff record');
      } finally {
        setIsSavingEdit(false);
      }
    },
  });

  const openEditModal = (tab: 'personal' | 'employment') => {
    setEditTab(tab);
    formik.resetForm({ values: getEditInitialValues() });
    setIsEditModalOpen(true);
  };

  // Marketers are always Initiator, non-negotiable — the backend forces
  // this server-side regardless of what's submitted (see
  // StaffService.resolveUserType), same handling as StaffOnboarding.tsx.
  useEffect(() => {
    if (formik.values.role === 'MARKETER' && formik.values.userType !== 'Initiator') {
      formik.setFieldValue('userType', 'Initiator', false);
    }
  }, [formik.values.role]);

  // Cascading city load for the edit modal — same pattern as
  // ProfilePersonalInfoCard.tsx / StaffOnboarding.tsx.
  useEffect(() => {
    if (!isEditModalOpen || editTab !== 'personal' || !formik.values.state) {
      return;
    }
    let isMounted = true;
    setIsLoadingCities(true);
    referenceDataService
      .listCitiesByState(formik.values.state)
      .then((cityList) => {
        if (!isMounted) return;
        const mapped = cityList.map((c) => ({ id: c.id, name: c.name }));
        setCities(mapped);
        const currentCityName = staff?.residentialAddress?.city;
        const preselect = mapped.find((c) => c.name === currentCityName);
        if (preselect && !formik.values.city) {
          formik.setFieldValue('city', preselect.id, false);
        }
      })
      .catch(() => {
        if (isMounted) setCities([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingCities(false);
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditModalOpen, editTab, formik.values.state]);

  const selectedDepartmentName = departments.find((d) => d.id === formik.values.departmentId)?.name;
  const unitOptions: SelectOption[] = useMemo(
    () =>
      storeUnits
        .filter((u) => !selectedDepartmentName || normalizeName(u.department) === normalizeName(selectedDepartmentName))
        .map((u) => ({ label: u.name, value: u.id })),
    [storeUnits, selectedDepartmentName],
  );

  const toggleCompliance = async (field: 'ninVerified' | 'guarantorFormVerified' | 'offerLetterVerified') => {
    if (!staff) return;
    setCompliancePending(field);
    try {
      const updated = await staffService.updateCompliance(staff.id, { [field]: !staff[field] });
      setStaff(updated);
      toast.success('Compliance status updated.');
      if (id) setActivity(await staffService.getActivity(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update compliance status');
    } finally {
      setCompliancePending(null);
    }
  };

  const handleVerifyBvn = async () => {
    if (!staff) return;
    const bvn = bvnInput.trim();
    if (!/^\d{11}$/.test(bvn)) {
      toast.error('Enter a valid 11-digit BVN');
      return;
    }
    setIsVerifyingBvn(true);
    try {
      const updated = await staffService.verifyBvn(staff.id, { bvn });
      setStaff(updated);
      toast.success('BVN verified.');
      setBvnModalOpen(false);
      setBvnInput('');
      if (id) setActivity(await staffService.getActivity(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'BVN verification failed');
    } finally {
      setIsVerifyingBvn(false);
    }
  };

  const handleStatusToggle = async (reason?: string) => {
    if (!staff) return;
    setIsTogglingStatus(true);
    try {
      const updated =
        staff.status === 'DISABLED' ? await staffService.enable(staff.id) : await staffService.disable(staff.id, { reason: reason ?? '' });
      setStaff(updated);
      toast.success(staff.status === 'DISABLED' ? 'Staff account re-enabled.' : 'Staff account disabled.');
      setStatusModalOpen(false);
      if (id) setActivity(await staffService.getActivity(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update account status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const openAssignModal = () => {
    setAssignBranchIds([]);
    setAssignComments('');
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async () => {
    if (!staff || assignBranchIds.length === 0) return;
    setIsSubmittingAssign(true);
    try {
      await branchStaffAssignmentsService.assign({
        staffId: staff.id,
        branchIds: assignBranchIds,
        role: staff.role as 'ADMIN' | 'APPROVER',
        comments: assignComments.trim() || undefined,
      });
      toast.success('Assignment proposed — pending a different Admin/SuperAdmin/Approver’s approval.');
      setIsAssignModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to propose assignment');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleRevoke = async (reason?: string) => {
    if (!staff || !revokeTarget) return;
    setIsRevoking(true);
    try {
      await branchStaffAssignmentsService.revoke({
        staffId: staff.id,
        branchId: revokeTarget.branchId,
        role: revokeTarget.role,
        reason,
      });
      toast.success('Branch coverage revoked.');
      setRevokeTarget(null);
      await loadCoverage(staff.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke coverage');
    } finally {
      setIsRevoking(false);
    }
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !staff) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Image must be 5MB or smaller');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const updated = await staffService.updateDocuments(staff.id, { passportPhoto: file });
      setStaff(updated);
      toast.success('Passport photo updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update passport photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <LoaderIcon size={24} className="animate-spin mr-3" />
        Loading staff record...
      </div>
    );
  }

  if (loadError || !staff) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/staff-management')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary">
          <ArrowLeftIcon size={16} /> Every manager ever assigned to this brancht
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircleIcon size={18} className="flex-shrink-0" />
          {loadError ?? 'Staff record not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/staff-management')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary">
        <ArrowLeftIcon size={16} /> Every manager ever assigned to this brancht
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative flex-shrink-0">
          <ProfileAvatar
            src={staff.passportPhotoUrl}
            name={fullName}
            alt="Staff photo"
            className="w-20 h-20 rounded-full border-2 border-gray-100"
            iconSize={32}
          />
          {canEdit && (
            <>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 disabled:opacity-60"
                aria-label="Update passport photo"
              >
                {isUploadingPhoto ? <LoaderIcon size={12} className="animate-spin" /> : <ImageIcon size={12} />}
              </button>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-heading font-bold text-primary">{fullName}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-heading font-medium bg-primary/10 text-primary">
              {STAFF_ROLE_LABEL[staff.role] ?? staff.role}
            </span>
            <StatusBadge status={STAFF_STATUS_LABEL[staff.status] as any} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {buildFrontendStaffId(staff.id)} · {staff.email}
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusModalOpen(true)}
              className={`px-4 py-2 border text-sm font-heading font-bold rounded-lg transition-colors ${
                staff.status === 'DISABLED'
                  ? 'border-green-200 text-green-700 hover:bg-green-50'
                  : 'border-red-200 text-red-600 hover:bg-red-50'
              }`}
            >
              {staff.status === 'DISABLED' ? 'Re-enable Account' : 'Disable Account'}
            </button>
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircleIcon size={16} className="flex-shrink-0" />
          SuperAdmin accounts can't be edited or disabled from this page.
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-heading font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  {canEdit && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => openEditModal('personal')}
                        className="px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-heading font-bold rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                      >
                        <PencilIcon size={15} /> Update Record
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <InfoField label="Full Name" value={fullName} />
                    <InfoField label="Email" value={staff.email} />
                    <InfoField label="Phone Number" value={staff.phoneNumber} />
                    <InfoField label="Date of Birth" value={formatDate(staff.kyc?.dateOfBirth)} />
                    <InfoField label="Gender" value={staff.kyc?.gender ?? '—'} />
                    <InfoField label="ID Type" value={staff.kyc?.idType ? ID_TYPE_LABEL[staff.kyc.idType] ?? staff.kyc.idType : '—'} />
                    <InfoField label="ID Number" value={staff.kyc?.idNumber ?? '—'} />
                    <InfoField
                      label="Residential Address"
                      value={
                        staff.residentialAddress
                          ? `${staff.residentialAddress.street}, ${staff.residentialAddress.city}, ${staff.residentialAddress.state}`
                          : '—'
                      }
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-md font-semibold text-primary mb-3">Next of Kin</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      <InfoField label="Name" value={staff.nextOfKin?.name ?? '—'} />
                      <InfoField label="Relationship" value={staff.nextOfKin?.relationship ?? '—'} />
                      <InfoField label="Phone Number" value={staff.nextOfKin?.phoneNumber ?? '—'} />
                      <InfoField label="Address" value={staff.nextOfKin?.address ?? '—'} />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-md font-semibold text-primary mb-3">Reference</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      <InfoField label="Name" value={staff.reference?.name ?? '—'} />
                      <InfoField label="Relationship" value={staff.reference?.relationship ?? '—'} />
                      <InfoField label="Phone Number" value={staff.reference?.phoneNumber ?? '—'} />
                      <InfoField label="Address" value={staff.reference?.address ?? '—'} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'employment' && (
                <div className="space-y-6">
                  {canEdit && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => openEditModal('employment')}
                        className="px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-heading font-bold rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                      >
                        <PencilIcon size={15} /> Update Record
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <InfoField label="Role" value={STAFF_ROLE_LABEL[staff.role] ?? staff.role} />
                    <InfoField label="User Type" value={staff.userType} />
                    <InfoField label="Department" value={departmentName} />
                    <InfoField label="Unit" value={unitName} />
                    <InfoField label="Branch" value={branchName} />
                    <InfoField label="Employment Type" value={staff.employmentType ?? '—'} />
                    <InfoField label="Reporting To" value={managerName} />
                    <InfoField label="Salary Grade" value={staff.salaryGrade ?? '—'} />
                    <InfoField label="Start Date" value={formatDate(staff.startDate)} />
                    <InfoField label="Status" value={STAFF_STATUS_LABEL[staff.status] ?? staff.status} />
                  </div>
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="space-y-6">
                  <div>
                    <ComplianceRow
                      label="BVN Verification"
                      icon={<ShieldCheckIcon size={16} />}
                      verified={staff.bvnVerified}
                      canToggle={canEdit && !staff.bvnVerified}
                      onToggle={() => setBvnModalOpen(true)}
                    />
                    <ComplianceRow
                      label="NIN Verification"
                      icon={<FileTextIcon size={16} />}
                      verified={staff.ninVerified}
                      canToggle={canEdit}
                      isBusy={compliancePending === 'ninVerified'}
                      onToggle={() => toggleCompliance('ninVerified')}
                    />
                    <ComplianceRow
                      label="Guarantor Form"
                      icon={<FileTextIcon size={16} />}
                      verified={staff.guarantorFormVerified}
                      canToggle={canEdit}
                      isBusy={compliancePending === 'guarantorFormVerified'}
                      onToggle={() => toggleCompliance('guarantorFormVerified')}
                    />
                    <ComplianceRow
                      label="Offer Letter Signed"
                      icon={<FileTextIcon size={16} />}
                      verified={staff.offerLetterVerified}
                      canToggle={canEdit}
                      isBusy={compliancePending === 'offerLetterVerified'}
                      onToggle={() => toggleCompliance('offerLetterVerified')}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-md font-semibold text-primary mb-3">Documents</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <ImageIcon size={16} className="text-gray-400" /> Passport Photo
                        </div>
                        {staff.passportPhotoUrl ? (
                          <a
                            href={resolveUploadUrl(staff.passportPhotoUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View <ExternalLinkIcon size={12} />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not uploaded</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FileTextIcon size={16} className="text-gray-400" /> ID Document
                        </div>
                        {staff.idDocumentUrl ? (
                          <a
                            href={resolveUploadUrl(staff.idDocumentUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View <ExternalLinkIcon size={12} />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Customers Onboarded" value={performance?.customersOnboarded ?? '—'} />
                  <StatCard label="Active Groups" value={performance?.activeGroups ?? '—'} />
                  <StatCard label="Loans Raised" value={performance?.loansRaised ?? '—'} />
                  <StatCard label="Last Login" value={formatDate(performance?.lastLoginAt, true)} />
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-1">
                  {activity.length === 0 && <p className="text-sm text-gray-500 py-8 text-center">No recorded activity yet.</p>}
                  {activity.map((entry, index) => (
                    <div key={`${entry.timestamp}-${index}`} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <ClockIcon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-body text-gray-700">{toTitleCase(entry.action.replace(/_/g, ' '))}</p>
                        <p className="text-xs text-gray-400">
                          {formatDate(entry.timestamp, true)} · {entry.entityType}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'branch-assignments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Branches {fullName} currently oversees as {STAFF_ROLE_LABEL[staff.role] ?? staff.role} —
                      admin/approver-tier branch notifications route here.
                    </p>
                    <button
                      onClick={openAssignModal}
                      className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                    >
                      <PlusIcon size={15} /> Propose Assignment
                    </button>
                  </div>

                  {isLoadingCoverage ? (
                    <div className="flex items-center justify-center py-12 text-gray-500">
                      <LoaderIcon size={20} className="animate-spin mr-2" /> Loading coverage...
                    </div>
                  ) : coverage.length === 0 ? (
                    <p className="text-sm text-gray-500 py-8 text-center">No branches assigned yet.</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {coverage.map((row) => (
                        <div key={row.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                              <Building2Icon size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-body text-gray-700">
                                {branches.find((b) => b.id === row.branchId)?.name ?? row.branchId}
                              </p>
                              <p className="text-xs text-gray-400">Since {formatDate(row.startDate)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setRevokeTarget(row)}
                            className="text-xs font-body text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2Icon size={13} /> Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Proposed assignments awaiting a different Admin/SuperAdmin/
                      Approver's approval — otherwise "Propose Assignment" above
                      has nowhere visible to land until someone approves it. */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <p className="text-sm font-heading font-bold text-gray-700 mb-3">Pending / Rejected Proposals</p>
                    <RoleAssignmentApprovalsPanel state={roleAssignmentApprovals} hideStaffName />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-heading font-bold text-primary flex items-center gap-2">
                  <UserCogIcon size={18} /> {editTab === 'personal' ? 'Update Personal Info' : 'Update Employment Details'}
                </h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon size={20} />
                </button>
              </div>

              <form onSubmit={formik.handleSubmit} className="space-y-5">
                {editTab === 'personal' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <EditField formik={formik} name="firstName" label="First Name" />
                      <EditField formik={formik} name="lastName" label="Last Name" />
                      <EditField formik={formik} name="email" label="Email" type="email" />
                      <EditField formik={formik} name="phoneNumber" label="Phone Number" />
                      <EditField formik={formik} name="dateOfBirth" label="Date of Birth" type="date" />
                      <ReusableReactSelect name="gender" label="Gender" formik={formik} options={GENDER_OPTIONS} placeholder="Select gender" />
                      <ReusableReactSelect name="idType" label="ID Type" formik={formik} options={ID_TYPE_OPTIONS} placeholder="Select ID type" />
                      <EditField formik={formik} name="idNumber" label="ID Number" />
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Residential Address</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ReusableReactSelect name="state" label="State" formik={formik} options={stateOptions} placeholder="Select state" />
                        <ReusableReactSelect
                          name="city"
                          label="City"
                          formik={formik}
                          options={cityOptions}
                          placeholder={formik.values.state ? 'Select city' : 'Select state first'}
                          isDisabled={!formik.values.state}
                          isLoading={isLoadingCities}
                        />
                        <div className="sm:col-span-2">
                          <EditField formik={formik} name="street" label="Street" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Next of Kin</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditField formik={formik} name="nokName" label="Name" />
                        <EditField formik={formik} name="nokRelationship" label="Relationship" />
                        <EditField formik={formik} name="nokPhone" label="Phone Number" />
                        <EditField formik={formik} name="nokAddress" label="Address" />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Reference</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditField formik={formik} name="referenceName" label="Name" />
                        <EditField formik={formik} name="referenceRelationship" label="Relationship" />
                        <EditField formik={formik} name="referencePhone" label="Phone Number" />
                        <EditField formik={formik} name="referenceAddress" label="Address" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ReusableReactSelect name="role" label="Role" formik={formik} options={STAFF_ROLE_OPTIONS} placeholder="Select role" />
                    <ReusableReactSelect
                      name="userType"
                      label="User Type"
                      formik={formik}
                      options={STAFF_USER_TYPE_OPTIONS}
                      placeholder="Select user type"
                      isDisabled={formik.values.role === 'MARKETER'}
                      helperText={
                        formik.values.role === 'MARKETER' ? 'Marketers are always Initiator.' : undefined
                      }
                    />
                    <ReusableReactSelect
                      name="departmentId"
                      label="Department"
                      formik={formik}
                      options={departmentOptions}
                      placeholder="Select department"
                    />
                    <ReusableReactSelect name="unitId" label="Unit" formik={formik} options={unitOptions} placeholder="Select unit" />
                    <ReusableReactSelect name="branchId" label="Branch" formik={formik} options={branchOptions} placeholder="Select branch" />
                    <ReusableReactSelect
                      name="employmentType"
                      label="Employment Type"
                      formik={formik}
                      options={EMPLOYMENT_TYPE_OPTIONS}
                      placeholder="Select employment type"
                    />
                    <EditField formik={formik} name="salaryGrade" label="Salary Grade" />
                    <ReusableReactSelect
                      name="managerId"
                      label="Reporting To"
                      formik={formik}
                      options={managerOptions}
                      placeholder="Select manager (optional)"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-sm font-heading font-medium text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {isSavingEdit ? <LoaderIcon size={16} className="animate-spin" /> : <CheckCircleIcon size={16} />}
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BVN verify modal */}
      <AnimatePresence>
        {bvnModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-bold text-primary flex items-center gap-2">
                  <KeyIcon size={18} /> Verify BVN
                </h3>
                <button onClick={() => setBvnModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon size={20} />
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BVN</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={bvnInput}
                onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="11-digit BVN"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              <button
                onClick={handleVerifyBvn}
                disabled={isVerifyingBvn}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {isVerifyingBvn ? <LoaderIcon size={16} className="animate-spin" /> : <ShieldCheckIcon size={16} />}
                {isVerifyingBvn ? 'Verifying...' : 'Verify'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={(reason) => handleStatusToggle(reason)}
        title={staff.status === 'DISABLED' ? 'Re-enable this account?' : 'Disable this account?'}
        description={
          staff.status === 'DISABLED'
            ? `${fullName} will be able to log in again.`
            : `${fullName} will not be able to log in or act on any workflow request.`
        }
        confirmLabel={isTogglingStatus ? 'Working...' : staff.status === 'DISABLED' ? 'Re-enable' : 'Disable'}
        confirmVariant={staff.status === 'DISABLED' ? 'primary' : 'danger'}
        inputType={staff.status === 'DISABLED' ? 'none' : 'textarea'}
        inputLabel="Reason"
        inputPlaceholder="Why is this account being disabled?"
        requireInput={staff.status !== 'DISABLED'}
      />

      {/* Propose branch assignment modal */}
      <AnimatePresence>
        {isAssignModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-bold text-primary flex items-center gap-2">
                  <Building2Icon size={18} /> Propose Branch Assignment
                </h3>
                <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <ReusableMultiSelect
                  label="Branches"
                  values={assignBranchIds}
                  options={assignableBranchOptions}
                  onChange={setAssignBranchIds}
                  placeholder="Select one or more branches"
                  helperText="A different Admin/SuperAdmin/Approver must approve this before it takes effect — one decision applies to every branch selected here."
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comments (optional)</label>
                  <textarea
                    value={assignComments}
                    onChange={(e) => setAssignComments(e.target.value)}
                    rows={3}
                    placeholder="Why is this coverage being proposed?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-sm font-heading font-medium text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSubmit}
                  disabled={isSubmittingAssign || assignBranchIds.length === 0}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {isSubmittingAssign ? <LoaderIcon size={16} className="animate-spin" /> : <CheckCircleIcon size={16} />}
                  {isSubmittingAssign ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={(reason) => handleRevoke(reason)}
        title="Revoke this branch coverage?"
        description={`${fullName} will immediately stop being an assigned ${revokeTarget?.role ?? ''} for ${
          branches.find((b) => b.id === revokeTarget?.branchId)?.name ?? 'this branch'
        }. This takes effect right away — no second approval needed.`}
        confirmLabel={isRevoking ? 'Working...' : 'Revoke'}
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason (optional)"
        inputPlaceholder="Why is this coverage being revoked?"
      />
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-body mb-1">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  );
}

function EditField({
  formik,
  name,
  label,
  type = 'text',
}: {
  formik: ReturnType<typeof useFormik<EditFormValues>>;
  name: keyof EditFormValues;
  label: string;
  type?: string;
}) {
  const error = formik.touched[name] && typeof formik.errors[name] === 'string' ? (formik.errors[name] as string) : '';
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        autoComplete="off"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
