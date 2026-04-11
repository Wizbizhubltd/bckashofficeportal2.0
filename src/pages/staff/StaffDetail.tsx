import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import moment from 'moment';
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
  XIcon } from
'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../app/api';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import { ReusableReactSelect, type SelectOption } from '../../components/ReusableReactSelect';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { compressImageFile } from '../../utils/image-compression';
import {
  buildFrontendStaffIdWithSource,
  toTitleCase,
  type OrganizationNameSource,
} from '../../utils/staff-display';
const mockStaff: Record<string, any> = {
  'EMP-001': {
    id: 'EMP-001',
    name: 'Adebayo Johnson',
    phone: '+234 801 234 5678',
    email: 'adebayo.johnson@bckashmfb.com.ng',
    dob: '1980-05-20',
    gender: 'Male',
    address: '5 Awolowo Road, Ikoyi, Lagos',
    emergencyContact: {
      name: 'Bimpe Johnson',
      phone: '+234 802 111 2233',
      relationship: 'Wife'
    },
    avatar: '',
    role: 'Super Admin',
    department: 'Management',
    branch: 'Head Office',
    dateHired: '2019-03-01',
    employmentType: 'Full-time',
    reportingTo: 'Board of Directors',
    salaryGrade: 'Grade A1',
    status: 'Active',
    kyc: {
      bvn: {
        status: 'Verified'
      },
      nin: {
        status: 'Verified'
      },
      guarantorForm: {
        status: 'Verified'
      },
      offerLetter: {
        status: 'Verified'
      }
    },
    performance: {
      customersOnboarded: '-',
      loansProcessed: 342,
      activeGroups: '-',
      lastLogin: '2025-03-31'
    },
    activity: [
    {
      action: 'Approved loan LN-0050 for ₦1,200,000',
      date: '2025-03-31',
      by: 'System'
    },
    {
      action: 'Verified KYC for Folake Adeyemi (CUS-001)',
      date: '2025-03-30',
      by: 'System'
    },
    {
      action: 'Created new branch: Lekki Phase 1',
      date: '2025-03-28',
      by: 'System'
    },
    {
      action: 'Logged in from Head Office',
      date: '2025-03-31',
      by: 'System'
    }]

  },
  'EMP-002': {
    id: 'EMP-002',
    name: 'Fatima Abubakar',
    phone: '+234 803 567 8901',
    email: 'fatima.abubakar@bckashmfb.com.ng',
    dob: '1987-11-14',
    gender: 'Female',
    address: '12 Opebi Road, Ikeja, Lagos',
    emergencyContact: {
      name: 'Musa Abubakar',
      phone: '+234 804 333 4455',
      relationship: 'Husband'
    },
    avatar: '',
    role: 'Branch Manager',
    department: 'Operations',
    branch: 'Ikeja Branch',
    dateHired: '2020-06-15',
    employmentType: 'Full-time',
    reportingTo: 'Adebayo Johnson',
    salaryGrade: 'Grade B2',
    status: 'Active',
    kyc: {
      bvn: {
        status: 'Verified'
      },
      nin: {
        status: 'Verified'
      },
      guarantorForm: {
        status: 'Verified'
      },
      offerLetter: {
        status: 'Verified'
      }
    },
    performance: {
      customersOnboarded: '-',
      loansProcessed: 187,
      activeGroups: 12,
      lastLogin: '2025-03-31'
    },
    activity: [
    {
      action: 'Processed loan disbursement LN-0048',
      date: '2025-03-30',
      by: 'System'
    },
    {
      action: 'Reviewed customer KYC for Emeka Obi',
      date: '2025-03-29',
      by: 'System'
    },
    {
      action: 'Logged in from Ikeja Branch',
      date: '2025-03-31',
      by: 'System'
    },
    {
      action: 'Updated group Alaba Traders Union membership',
      date: '2025-03-27',
      by: 'System'
    }]

  },
  'EMP-003': {
    id: 'EMP-003',
    name: 'Chukwuma Okonkwo',
    phone: '+234 806 789 0123',
    email: 'chukwuma.okonkwo@bckashmfb.com.ng',
    dob: '1985-02-28',
    gender: 'Male',
    address: '3 Broad Street, Lagos Island',
    emergencyContact: {
      name: 'Ada Okonkwo',
      phone: '+234 807 555 6677',
      relationship: 'Wife'
    },
    avatar: '',
    role: 'Authorizer',
    department: 'Credit',
    branch: 'Head Office',
    dateHired: '2021-01-10',
    employmentType: 'Full-time',
    reportingTo: 'Adebayo Johnson',
    salaryGrade: 'Grade B1',
    status: 'Active',
    kyc: {
      bvn: {
        status: 'Verified'
      },
      nin: {
        status: 'Verified'
      },
      guarantorForm: {
        status: 'Pending'
      },
      offerLetter: {
        status: 'Verified'
      }
    },
    performance: {
      customersOnboarded: '-',
      loansProcessed: 256,
      activeGroups: '-',
      lastLogin: '2025-03-30'
    },
    activity: [
    {
      action: 'Approved loan LN-0047 for ₦500,000',
      date: '2025-03-30',
      by: 'System'
    },
    {
      action: 'Rejected loan LN-0046 — insufficient collateral',
      date: '2025-03-29',
      by: 'System'
    },
    {
      action: 'Verified BVN for Folake Adeyemi',
      date: '2025-03-20',
      by: 'System'
    },
    {
      action: 'Logged in from Head Office',
      date: '2025-03-30',
      by: 'System'
    }]

  },
  'EMP-004': {
    id: 'EMP-004',
    name: 'Emeka Nnamdi',
    phone: '+234 809 012 3456',
    email: 'emeka.nnamdi@bckashmfb.com.ng',
    dob: '1990-09-03',
    gender: 'Male',
    address: '7 Adeniran Ogunsanya, Surulere',
    emergencyContact: {
      name: 'Chioma Nnamdi',
      phone: '+234 810 777 8899',
      relationship: 'Wife'
    },
    avatar: '',
    role: 'Branch Manager',
    department: 'Operations',
    branch: 'Surulere Branch',
    dateHired: '2021-08-20',
    employmentType: 'Full-time',
    reportingTo: 'Adebayo Johnson',
    salaryGrade: 'Grade B2',
    status: 'Active',
    kyc: {
      bvn: {
        status: 'Verified'
      },
      nin: {
        status: 'Pending'
      },
      guarantorForm: {
        status: 'Verified'
      },
      offerLetter: {
        status: 'Verified'
      }
    },
    performance: {
      customersOnboarded: '-',
      loansProcessed: 134,
      activeGroups: 8,
      lastLogin: '2025-03-29'
    },
    activity: [
    {
      action: 'Processed repayment collection for GRP-003',
      date: '2025-03-29',
      by: 'System'
    },
    {
      action: 'Logged in from Surulere Branch',
      date: '2025-03-29',
      by: 'System'
    }]

  },
  'EMP-005': {
    id: 'EMP-005',
    name: 'Aisha Bello',
    phone: '+234 811 234 5678',
    email: 'aisha.bello@bckashmfb.com.ng',
    dob: '1993-04-17',
    gender: 'Female',
    address: '20 Agege Motor Road, Mushin',
    emergencyContact: {
      name: 'Ibrahim Bello',
      phone: '+234 812 999 0011',
      relationship: 'Father'
    },
    avatar: '',
    role: 'Marketer',
    department: 'Sales',
    branch: 'Mushin Branch',
    dateHired: '2022-03-05',
    employmentType: 'Full-time',
    reportingTo: 'Emeka Nnamdi',
    salaryGrade: 'Grade C1',
    status: 'On Leave',
    kyc: {
      bvn: {
        status: 'Verified'
      },
      nin: {
        status: 'Verified'
      },
      guarantorForm: {
        status: 'Verified'
      },
      offerLetter: {
        status: 'Verified'
      }
    },
    performance: {
      customersOnboarded: 45,
      loansProcessed: 89,
      activeGroups: 6,
      lastLogin: '2025-03-15'
    },
    activity: [
    {
      action: 'Leave request approved — Annual Leave',
      date: '2025-03-15',
      by: 'Emeka Nnamdi'
    },
    {
      action: 'Onboarded customer Blessing Nwosu (CUS-003)',
      date: '2025-03-10',
      by: 'System'
    },
    {
      action: 'Logged in from Mushin Branch',
      date: '2025-03-15',
      by: 'System'
    }]

  }
};

type StaffKycStatuses = {
  bvn: string;
  nin: string;
  guarantorForm: string;
  offerLetter: string;
};

type StaffTabKey = 'personal' | 'employment' | 'kyc' | 'performance' | 'activity';

type EditFormValues = {
  fullName: string;
  phoneNumber: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  role: string;
  department: string;
  branch: string;
  dateHired: string;
  employmentType: string;
  reportingTo: string;
  salaryGrade: string;
  bvnStatus: string;
  ninStatus: string;
  guarantorFormStatus: string;
  offerLetterStatus: string;
  customersOnboarded: string;
  loansProcessed: string;
  activeGroups: string;
  lastLogin: string;
  action: string;
  date: string;
  by: string;
};

const PHONE_REGEX = /^[0-9+\-()\s]+$/;

function sanitizePhoneInput(value: string): string {
  return value.replace(/[^0-9+\-()\s]/g, '');
}

function extractItem<T>(response: unknown): T | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const source = response as { data?: unknown; payload?: unknown; item?: unknown };

  if (source.data && typeof source.data === 'object' && !Array.isArray(source.data)) {
    return source.data as T;
  }

  if (source.payload && typeof source.payload === 'object' && !Array.isArray(source.payload)) {
    return source.payload as T;
  }

  if (source.item && typeof source.item === 'object' && !Array.isArray(source.item)) {
    return source.item as T;
  }

  return null;
}

function getKycStatus(input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const value = (input as { status?: unknown }).status;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return 'Pending';
}

type DepartmentLookup = {
  id: string;
  name: string;
};

type RoleLookup = {
  id: string;
  name: string;
  department: string;
};

type BranchLookup = {
  id: string;
  name: string;
};

function toStringId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
    const converted = (value as { toString: () => string }).toString();
    if (converted && converted !== '[object Object]') {
      return converted;
    }
  }

  return '';
}

function extractItems<T>(response: unknown): T[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const source = response as { data?: unknown; payload?: unknown; items?: unknown };

  if (Array.isArray(source.data)) {
    return source.data as T[];
  }

  if (Array.isArray(source.payload)) {
    return source.payload as T[];
  }

  if (Array.isArray(source.items)) {
    return source.items as T[];
  }

  return [];
}

function resolveBranchIdFromRecord(source: Record<string, unknown>): string {
  return (
    toStringId(source.branchId) ||
    (typeof source.branch === 'object' && source.branch !== null
      ? toStringId(source.branch as Record<string, unknown>)
      : '')
  );
}

function resolveBranchNameFromRecord(source: Record<string, unknown>): string {
  if (typeof source.branch === 'string' && source.branch.trim().length > 0) {
    return source.branch.trim();
  }

  if (source.branch && typeof source.branch === 'object') {
    const branchSource = source.branch as Record<string, unknown>;
    if (typeof branchSource.name === 'string' && branchSource.name.trim().length > 0) {
      return branchSource.name.trim();
    }
  }

  return '';
}

function isBranchManagerRecord(source: Record<string, unknown>): boolean {
  const roleValue =
    (typeof source.userLevel === 'string' && source.userLevel) ||
    (typeof source.role === 'string' && source.role) ||
    (typeof source.role === 'object' && source.role !== null && typeof (source.role as Record<string, unknown>).name === 'string'
      ? ((source.role as Record<string, unknown>).name as string)
      : '') ||
    (typeof source.roleName === 'string' && source.roleName) ||
    '';

  const normalized = roleValue.toLowerCase().replace(/[\s_-]/g, '');
  return normalized === 'branchmanager';
}

function toDisplayName(source: Record<string, unknown>): string {
  const firstName = typeof source.firstName === 'string' ? source.firstName : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName : '';
  const joinedName = `${firstName} ${lastName}`.trim();

  if (joinedName.length > 0) {
    return toTitleCase(joinedName);
  }

  if (typeof source.name === 'string' && source.name.trim().length > 0) {
    return toTitleCase(source.name.trim());
  }

  if (typeof source.email === 'string' && source.email.trim().length > 0) {
    return source.email.trim();
  }

  return '';
}

function resolveStaffNameFromReference(value: unknown, allStaff: Record<string, unknown>[]): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim();

    const matched = allStaff.find((item) => {
      const id = toStringId(item.id);
      const backendId = toStringId(item._id);
      const staffId = toStringId(item.staffId);
      return trimmed === id || trimmed === backendId || trimmed === staffId;
    });

    if (!matched) {
      return trimmed;
    }

    const firstName = typeof matched.firstName === 'string' ? matched.firstName : '';
    const lastName = typeof matched.lastName === 'string' ? matched.lastName : '';
    const joinedName = `${firstName} ${lastName}`.trim();
    const fullName = typeof matched.name === 'string' && matched.name.trim().length > 0 ? matched.name : joinedName;

    return fullName.trim().length > 0 ? toTitleCase(fullName) : trimmed;
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const firstName = typeof source.firstName === 'string' ? source.firstName : '';
    const lastName = typeof source.lastName === 'string' ? source.lastName : '';
    const joinedName = `${firstName} ${lastName}`.trim();
    const fullName =
      (typeof source.name === 'string' && source.name) ||
      (typeof source.fullName === 'string' && source.fullName) ||
      joinedName;

    if (typeof fullName === 'string' && fullName.trim().length > 0) {
      return toTitleCase(fullName);
    }
  }

  return '-';
}

function mapApiStaffToView(
  raw: unknown,
  routeId: string | undefined,
  departments: DepartmentLookup[],
  roles: RoleLookup[],
  branches: BranchLookup[],
  allStaff: Record<string, unknown>[],
): any | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const firstName = typeof source.firstName === 'string' ? source.firstName : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName : '';
  const joinedName = `${firstName} ${lastName}`.trim();
  const kyc = (typeof source.kyc === 'object' && source.kyc !== null ? source.kyc : {}) as Record<string, unknown>;
  const emergencyContact =
    typeof source.emergencyContact === 'object' && source.emergencyContact !== null
      ? source.emergencyContact
      : { name: '-', phone: '-', relationship: '-' };
  const performance =
    typeof source.performance === 'object' && source.performance !== null
      ? source.performance
      : { customersOnboarded: '-', loansProcessed: '-', activeGroups: '-', lastLogin: '-' };
  const activity = Array.isArray(source.activity) ? source.activity : [];
  const roleId = toStringId(source.roleId);
  const departmentId = toStringId(source.departmentId);
  const branchId = toStringId(source.branchId);
  const roleLookup = roleId ? roles.find((item) => item.id === roleId) : undefined;
  const departmentLookup = departmentId ? departments.find((item) => item.id === departmentId) : undefined;
  const branchLookup = branchId ? branches.find((item) => item.id === branchId) : undefined;
  const nestedDepartment =
    typeof source.department === 'object' && source.department !== null
      ? (source.department as Record<string, unknown>)
      : null;
  const nestedBranch =
    typeof source.branch === 'object' && source.branch !== null
      ? (source.branch as Record<string, unknown>)
      : null;
  const nestedRole =
    typeof source.role === 'object' && source.role !== null
      ? (source.role as Record<string, unknown>)
      : null;

  const backendId =
    (typeof source.id === 'string' && source.id) ||
    (typeof source._id === 'string' && source._id) ||
    null;
  const recordCreatedAt =
    (typeof source.createdAt === 'string' && source.createdAt) ||
    (typeof source.createdOn === 'string' && source.createdOn) ||
    '';
  const displayId = backendId ? buildFrontendStaffIdWithSource(source, backendId) : null;

  return {
    id: displayId?.id ?? (routeId || 'EMP-002'),
    name: toTitleCase((typeof source.name === 'string' && source.name) || joinedName || 'Unknown Staff'),
    phone:
      (typeof source.phone === 'string' && source.phone) ||
      (typeof source.phoneNumber === 'string' && source.phoneNumber) ||
      '-',
    email: typeof source.email === 'string' ? source.email : '-',
    dob:
      (typeof source.dob === 'string' && source.dob) ||
      (typeof source.dateOfBirth === 'string' && source.dateOfBirth) ||
      '-',
    gender: typeof source.gender === 'string' ? toTitleCase(source.gender) : '-',
    address: typeof source.address === 'string' ? source.address : '-',
    emergencyContact,
    avatar:
      (typeof source.avatar === 'string' && source.avatar) ||
      (typeof source.profilePic === 'string' && source.profilePic) ||
      (typeof source.profilePic === 'object' && source.profilePic !== null
        ? ((source.profilePic as { url?: unknown }).url as string | undefined)
        : undefined) ||
      '',
    role:
      toTitleCase(
        (typeof source.role === 'string' && source.role) ||
          (typeof nestedRole?.name === 'string' && nestedRole.name) ||
          (typeof roleLookup?.name === 'string' && roleLookup.name) ||
          (typeof source.userLevel === 'string' && source.userLevel) ||
          '-',
      ),
    department: toTitleCase(
      (typeof source.department === 'string' && source.department.trim().length > 0 && source.department) ||
        (typeof nestedDepartment?.name === 'string' && nestedDepartment.name) ||
        (typeof departmentLookup?.name === 'string' && departmentLookup.name) ||
        (typeof roleLookup?.department === 'string' && roleLookup.department) ||
        '-',
    ),
    branch: toTitleCase(
      (typeof source.branch === 'string' && source.branch.trim().length > 0 && source.branch) ||
        (typeof nestedBranch?.name === 'string' && nestedBranch.name) ||
        (typeof branchLookup?.name === 'string' && branchLookup.name) ||
        '-',
    ),
    dateHired:
      recordCreatedAt ||
      (typeof source.dateHired === 'string' && source.dateHired) ||
      (typeof source.startDate === 'string' && source.startDate) ||
      '-',
    employmentType: typeof source.employmentType === 'string' ? toTitleCase(source.employmentType) : '-',
    reportingTo: resolveStaffNameFromReference(
      source.reportingTo ?? source.reportingToId ?? source.managerId ?? source.supervisorId,
      allStaff,
    ),
    salaryGrade: typeof source.salaryGrade === 'string' ? source.salaryGrade : '-',
    status: typeof source.status === 'string' ? toTitleCase(source.status) : 'Active',
    kyc: {
      bvn: { status: getKycStatus(kyc.bvn) },
      nin: { status: getKycStatus(kyc.nin) },
      guarantorForm: { status: getKycStatus(kyc.guarantorForm) },
      offerLetter: { status: getKycStatus(kyc.offerLetter) },
    },
    performance: {
      customersOnboarded: (performance as Record<string, unknown>).customersOnboarded ?? '-',
      loansProcessed: (performance as Record<string, unknown>).loansProcessed ?? '-',
      activeGroups: (performance as Record<string, unknown>).activeGroups ?? '-',
      lastLogin: (performance as Record<string, unknown>).lastLogin ?? '-',
    },
    activity,
    backendId,
    createdAt: recordCreatedAt,
    organizationNameSource: (displayId?.organizationNameSource ?? 'fallback') as OrganizationNameSource,
  };
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

const tabs = [
{
  key: 'personal',
  label: 'Personal Info',
  icon: UserIcon
},
{
  key: 'employment',
  label: 'Employment',
  icon: BriefcaseIcon
},
{
  key: 'kyc',
  label: 'KYC & Verification',
  icon: ShieldCheckIcon
},
{
  key: 'performance',
  label: 'Performance',
  icon: BarChart3Icon
},
{
  key: 'activity',
  label: 'Activity Log',
  icon: ClockIcon
}];

function KycRow({
  label,
  status,
  icon,
  onAction





}: {label: string;status: string;icon: React.ReactNode;onAction?: () => void;}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
          {icon}
        </div>
        <span className="text-sm font-body text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={status as any} />
        <button
          onClick={onAction}
          className="text-xs font-body text-primary hover:text-primary/80 transition-colors">
          
          {status === 'Verified' ? 'View' : 'Verify'}
        </button>
      </div>
    </div>);

}
function StatCard({ label, value }: {label: string;value: string | number;}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-400 font-body mb-1">{label}</p>
      <p className="text-xl font-heading font-bold text-gray-800">{value}</p>
    </div>);

}
export function StaffDetail() {
  const STAFF_DATE_FORMAT = 'DD MMM YYYY';
  const { id } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const departments = useAppSelector((state) => state.lookups.departments);
  const roles = useAppSelector((state) => state.lookups.roles);
  const branches = useAppSelector((state) => state.lookups.branches);
  const [activeTab, setActiveTab] = useState<StaffTabKey>('personal');
  const initialStaff = mockStaff[id || 'EMP-002'] || mockStaff['EMP-002'];
  const [staff, setStaff] = useState<any>(initialStaff);
  const [staffBackendId, setStaffBackendId] = useState<string | null>(null);
  const isSuperAdmin = user?.role === 'super_admin';
  // Mutable staff state
  const [staffStatus, setStaffStatus] = useState(initialStaff.status);
  const [staffRole, setStaffRole] = useState(initialStaff.role);
  // Action modal state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState<StaffTabKey>('personal');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [branchManagerDirectory, setBranchManagerDirectory] = useState<
    Array<{ label: string; value: string; branchId: string; branchName: string }>
  >([]);
  // Staff KYC modal
  const [staffKycOpen, setStaffKycOpen] = useState(false);
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
  }>({
    message: '',
    visible: false
  });
  function showToast(message: string) {
    setToast({
      message,
      visible: true
    });
    setTimeout(
      () =>
      setToast((t) => ({
        ...t,
        visible: false
      })),
      3000
    );
  }

  async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      showToast('Please select a valid image file');
      return;
    }

    const preparedFile = await compressImageFile(selectedFile, {
      maxWidth: 960,
      maxHeight: 960,
      quality: 0.82,
      outputType: 'image/jpeg',
    });

    const localPreviewUrl = URL.createObjectURL(preparedFile);
    setStaff((previous: any) => ({
      ...previous,
      avatar: localPreviewUrl,
    }));

    if (!staffBackendId || !organizationIdForEdit) {
      showToast('Profile photo updated locally');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('profilePic', preparedFile);
      formData.append('organizationId', organizationIdForEdit);

      const response = await api.patch<Record<string, unknown>, FormData>(
        `/users/${staffBackendId}/profile-sections`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      const responseSource = response as {
        data?: Record<string, unknown>;
        payload?: Record<string, unknown>;
      };
      const payload = responseSource.data ?? responseSource.payload ?? response;
      const profilePic =
        payload && typeof payload.profilePic === 'object' && payload.profilePic !== null
          ? (payload.profilePic as Record<string, unknown>)
          : null;
      const uploadedUrl =
        (profilePic && typeof profilePic.url === 'string' ? profilePic.url : null) ||
        (typeof payload.avatar === 'string' ? payload.avatar : null);

      if (uploadedUrl) {
        setStaff((previous: any) => ({
          ...previous,
          avatar: uploadedUrl,
        }));
      }

      showToast('Profile photo updated successfully');
    } catch {
      showToast('Profile photo updated locally (upload failed)');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const formatDate = (value: unknown): string => {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim() === '-') {
      return '-';
    }

    const parsed = moment(value);
    return parsed.isValid() ? parsed.format(STAFF_DATE_FORMAT) : value;
  };

  const organizationIdForEdit =
    typeof user?.organizationId === 'string' && user.organizationId.trim().length > 0
      ? user.organizationId.trim()
      : null;

  const formatDateForInput = (value: unknown): string => {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim() === '-') {
      return '';
    }

    const parsed = moment(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
  };
  const roleOptions = useMemo<SelectOption[]>(() => {
    const uniqueValues = new Set<string>();
    roles.forEach((item) => {
      if (typeof item.name === 'string' && item.name.trim().length > 0) {
        uniqueValues.add(toTitleCase(item.name));
      }
    });
    if (typeof staffRole === 'string' && staffRole.trim().length > 0 && staffRole !== '-') {
      uniqueValues.add(staffRole);
    }
    return Array.from(uniqueValues).map((value) => ({ label: value, value }));
  }, [roles, staffRole]);

  const departmentOptions = useMemo<SelectOption[]>(() => {
    const uniqueValues = new Set<string>();
    departments.forEach((item) => {
      if (typeof item.name === 'string' && item.name.trim().length > 0) {
        uniqueValues.add(toTitleCase(item.name));
      }
    });
    if (typeof staff.department === 'string' && staff.department.trim().length > 0 && staff.department !== '-') {
      uniqueValues.add(staff.department);
    }
    return Array.from(uniqueValues).map((value) => ({ label: value, value }));
  }, [departments, staff.department]);

  const branchOptions = useMemo<SelectOption[]>(() => {
    const uniqueValues = new Set<string>();
    branches.forEach((item) => {
      if (typeof item.name === 'string' && item.name.trim().length > 0) {
        uniqueValues.add(toTitleCase(item.name));
      }
    });
    if (typeof staff.branch === 'string' && staff.branch.trim().length > 0 && staff.branch !== '-') {
      uniqueValues.add(staff.branch);
    }
    return Array.from(uniqueValues).map((value) => ({ label: value, value }));
  }, [branches, staff.branch]);

  const employmentTypeOptions = useMemo<SelectOption[]>(() => {
    const base = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Temporary'];
    const uniqueValues = new Set<string>(base);
    if (
      typeof staff.employmentType === 'string' &&
      staff.employmentType.trim().length > 0 &&
      staff.employmentType !== '-'
    ) {
      uniqueValues.add(staff.employmentType);
    }
    return Array.from(uniqueValues).map((value) => ({ label: value, value }));
  }, [staff.employmentType]);

  const dynamicKycStatuses = useMemo<StaffKycStatuses>(() => ({
    bvn: getKycStatus(staff?.kyc?.bvn),
    nin: getKycStatus(staff?.kyc?.nin),
    guarantorForm: getKycStatus(staff?.kyc?.guarantorForm),
    offerLetter: getKycStatus(staff?.kyc?.offerLetter),
  }), [staff?.kyc]);

  const kycItems = useMemo(
    () => [
      { key: 'bvn' as const, label: 'BVN Verification', icon: <ShieldCheckIcon size={16} />, status: dynamicKycStatuses.bvn },
      { key: 'nin' as const, label: 'NIN Verification', icon: <FileTextIcon size={16} />, status: dynamicKycStatuses.nin },
      {
        key: 'guarantorForm' as const,
        label: 'Guarantor Form',
        icon: <FileTextIcon size={16} />,
        status: dynamicKycStatuses.guarantorForm,
      },
      {
        key: 'offerLetter' as const,
        label: 'Offer Letter Signed',
        icon: <FileTextIcon size={16} />,
        status: dynamicKycStatuses.offerLetter,
      },
    ],
    [dynamicKycStatuses],
  );

  const performanceItems = useMemo(
    () => [
      { label: 'Customers Onboarded', value: staff?.performance?.customersOnboarded ?? '-' },
      { label: 'Loans Processed', value: staff?.performance?.loansProcessed ?? '-' },
      { label: 'Active Groups', value: staff?.performance?.activeGroups ?? '-' },
      { label: 'Last Login', value: formatDate(staff?.performance?.lastLogin) },
    ],
    [staff?.performance],
  );

  const activityItems = useMemo(() => {
    if (!Array.isArray(staff?.activity)) {
      return [];
    }

    return [...staff.activity]
      .map((item: any) => ({
        action: typeof item?.action === 'string' ? item.action : '-',
        date: typeof item?.date === 'string' ? item.date : '-',
        by: typeof item?.by === 'string' ? item.by : '-',
      }))
      .sort((first, second) => {
        const firstValue = moment(first.date).isValid() ? moment(first.date).valueOf() : 0;
        const secondValue = moment(second.date).isValid() ? moment(second.date).valueOf() : 0;
        return secondValue - firstValue;
      });
  }, [staff?.activity]);

  const getEditInitialValues = (tab: StaffTabKey): EditFormValues => ({
    fullName: staff.name ?? '',
    phoneNumber: staff.phone ?? '',
    email: staff.email ?? '',
    dateOfBirth: formatDateForInput(staff.dob),
    gender: staff.gender ?? '',
    address: staff.address ?? '',
    emergencyName: staff.emergencyContact?.name ?? '',
    emergencyPhone: staff.emergencyContact?.phone ?? '',
    emergencyRelationship: staff.emergencyContact?.relationship ?? '',
    role: staffRole ?? '',
    department: staff.department ?? '',
    branch: staff.branch ?? '',
    dateHired: formatDateForInput(staff.dateHired),
    employmentType: staff.employmentType ?? '',
    reportingTo: staff.reportingTo ?? '',
    salaryGrade: staff.salaryGrade ?? '',
    bvnStatus: dynamicKycStatuses.bvn,
    ninStatus: dynamicKycStatuses.nin,
    guarantorFormStatus: dynamicKycStatuses.guarantorForm,
    offerLetterStatus: dynamicKycStatuses.offerLetter,
    customersOnboarded: String(staff.performance?.customersOnboarded ?? ''),
    loansProcessed: String(staff.performance?.loansProcessed ?? ''),
    activeGroups: String(staff.performance?.activeGroups ?? ''),
    lastLogin: formatDateForInput(staff.performance?.lastLogin),
    action: tab === 'activity' ? '' : String(staff.activity?.[0]?.action ?? ''),
    date: tab === 'activity' ? moment().format('YYYY-MM-DD') : formatDateForInput(staff.activity?.[0]?.date),
    by: tab === 'activity' ? (staff.name ?? '') : String(staff.activity?.[0]?.by ?? ''),
  });

  const editValidationSchema = useMemo(() => {
    if (editTab === 'personal') {
      return Yup.object({
        fullName: Yup.string().trim().required('Full name is required'),
        phoneNumber: Yup.string().trim().matches(PHONE_REGEX, 'Phone number must contain only numbers').required('Phone number is required'),
        email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
        emergencyPhone: Yup.string().trim().matches(PHONE_REGEX, 'Emergency phone must contain only numbers').required('Emergency phone is required'),
      });
    }

    if (editTab === 'employment') {
      return Yup.object({
        role: Yup.string().trim().required('Role is required'),
        department: Yup.string().trim().required('Department is required'),
        branch: Yup.string().trim().required('Branch is required'),
        reportingTo: Yup.string().trim().required('Reporting to is required'),
      });
    }

    if (editTab === 'kyc') {
      return Yup.object({
        bvnStatus: Yup.string().oneOf(['Pending', 'Verified']).required('BVN status is required'),
        ninStatus: Yup.string().oneOf(['Pending', 'Verified']).required('NIN status is required'),
        guarantorFormStatus: Yup.string().oneOf(['Pending', 'Verified']).required('Guarantor form status is required'),
        offerLetterStatus: Yup.string().oneOf(['Pending', 'Verified']).required('Offer letter status is required'),
      });
    }

    if (editTab === 'performance') {
      return Yup.object({
        customersOnboarded: Yup.string().trim().required('Customers onboarded is required'),
        loansProcessed: Yup.string().trim().required('Loans processed is required'),
        activeGroups: Yup.string().trim().required('Active groups is required'),
      });
    }

    return Yup.object({
      action: Yup.string().trim().required('Activity action is required'),
      date: Yup.string().trim().required('Date is required'),
      by: Yup.string().trim().required('By is required'),
    });
  }, [editTab]);

  const buildEditPayload = (values: EditFormValues): Record<string, unknown> => {
    if (editTab === 'personal') {
      return {
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        address: values.address,
        emergencyContact: {
          name: values.emergencyName,
          phone: values.emergencyPhone,
          relationship: values.emergencyRelationship,
        },
      };
    }

    if (editTab === 'employment') {
      return {
        role: values.role,
        department: values.department,
        branch: values.branch,
        employmentType: values.employmentType,
        reportingTo: values.reportingTo,
        salaryGrade: values.salaryGrade,
      };
    }

    if (editTab === 'kyc') {
      return {
        kyc: {
          bvn: { status: values.bvnStatus },
          nin: { status: values.ninStatus },
          guarantorForm: { status: values.guarantorFormStatus },
          offerLetter: { status: values.offerLetterStatus },
        },
      };
    }

    if (editTab === 'performance') {
      return {
        performance: {
          customersOnboarded: values.customersOnboarded,
          loansProcessed: values.loansProcessed,
          activeGroups: values.activeGroups,
          lastLogin: values.lastLogin,
        },
      };
    }

    return {
      activity: [
        {
          action: values.action,
          date: values.date,
          by: values.by,
        },
        ...(Array.isArray(staff.activity) ? staff.activity : []),
      ],
    };
  };

  async function submitTabEdit(values: EditFormValues): Promise<void> {
    if (!staffBackendId) {
      throw new Error('No backend staff record found to update');
    }

    if (!organizationIdForEdit) {
      throw new Error('Organization ID is required for edit updates');
    }

    await api.patch(`/users/${staffBackendId}`, {
      organizationId: organizationIdForEdit,
      ...buildEditPayload(values),
    });

    setStaff((prev: any) => {
      const next = { ...prev };

      if (editTab === 'personal') {
        next.name = values.fullName || prev.name;
        next.phone = values.phoneNumber || prev.phone;
        next.email = values.email || prev.email;
        next.dob = values.dateOfBirth || prev.dob;
        next.gender = values.gender || prev.gender;
        next.address = values.address || prev.address;
        next.emergencyContact = {
          ...(prev.emergencyContact ?? {}),
          name: values.emergencyName || prev.emergencyContact?.name,
          phone: values.emergencyPhone || prev.emergencyContact?.phone,
          relationship: values.emergencyRelationship || prev.emergencyContact?.relationship,
        };
      }

      if (editTab === 'employment') {
        next.role = values.role || prev.role;
        next.department = values.department || prev.department;
        next.branch = values.branch || prev.branch;
        next.employmentType = values.employmentType || prev.employmentType;
        next.reportingTo = values.reportingTo || prev.reportingTo;
        next.salaryGrade = values.salaryGrade || prev.salaryGrade;
      }

      if (editTab === 'kyc') {
        next.kyc = {
          ...prev.kyc,
          bvn: { ...(prev.kyc?.bvn ?? {}), status: values.bvnStatus || prev.kyc?.bvn?.status },
          nin: { ...(prev.kyc?.nin ?? {}), status: values.ninStatus || prev.kyc?.nin?.status },
          guarantorForm: {
            ...(prev.kyc?.guarantorForm ?? {}),
            status: values.guarantorFormStatus || prev.kyc?.guarantorForm?.status,
          },
          offerLetter: {
            ...(prev.kyc?.offerLetter ?? {}),
            status: values.offerLetterStatus || prev.kyc?.offerLetter?.status,
          },
        };
      }

      if (editTab === 'performance') {
        next.performance = {
          ...prev.performance,
          customersOnboarded: values.customersOnboarded || prev.performance?.customersOnboarded,
          loansProcessed: values.loansProcessed || prev.performance?.loansProcessed,
          activeGroups: values.activeGroups || prev.performance?.activeGroups,
          lastLogin: values.lastLogin || prev.performance?.lastLogin,
        };
      }

      if (editTab === 'activity') {
        next.activity = [
          {
            action: values.action,
            date: values.date,
            by: values.by,
          },
          ...(Array.isArray(prev.activity) ? prev.activity : []),
        ];
      }

      return next;
    });

    if (editTab === 'employment' && values.role) {
      setStaffRole(values.role);
    }
    showToast(`${toTitleCase(editTab)} record updated successfully`);
    closeEditModal();
  }

  const editFormik = useFormik<EditFormValues>({
    initialValues: getEditInitialValues(editTab),
    enableReinitialize: true,
    validateOnMount: true,
    validationSchema: editValidationSchema,
    onSubmit: async (values) => {
      if (!organizationIdForEdit) {
        showToast('Organization ID is missing from session; edits are blocked');
        return;
      }

      if (!staffBackendId) {
        showToast('No backend staff record found to update');
        return;
      }

      const sanitizedValues: EditFormValues = {
        ...values,
        phoneNumber: sanitizePhoneInput(values.phoneNumber),
        emergencyPhone: sanitizePhoneInput(values.emergencyPhone),
      };

      try {
        setIsSavingEdit(true);
        await submitTabEdit(sanitizedValues);
      } catch (error) {
        showToast(getActionErrorMessage(error, 'Failed to update record'));
      } finally {
        setIsSavingEdit(false);
      }
    },
  });

  const openEditModal = (tab: StaffTabKey): void => {
    setEditTab(tab);
    setIsEditModalOpen(true);
    editFormik.resetForm({
      values: getEditInitialValues(tab),
    });
  };

  const closeEditModal = (): void => {
    setIsEditModalOpen(false);
    editFormik.resetForm({
      values: getEditInitialValues(editTab),
    });
  };

  const renderTabUpdateButton = (tab: StaffTabKey): React.ReactNode => {
    const canEditTab = tab === 'personal' || tab === 'employment';
    if (!isSuperAdmin || !canEditTab) {
      return null;
    }

    return (
      <div className="flex justify-end mb-4">
        <button
          onClick={() => openEditModal(tab)}
          className="px-4 py-2 border border-indigo-200 text-indigo-600 text-sm font-heading font-bold rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
          <PencilIcon size={15} /> Update Record
        </button>
      </div>
    );
  };

  useEffect(() => {
    const routeId = id || 'EMP-002';
    const fallbackStaff = mockStaff[routeId] || mockStaff['EMP-002'];

    setStaff(fallbackStaff);
    setStaffStatus(fallbackStaff.status);
    setStaffRole(fallbackStaff.role);
    setStaffBackendId(null);

    let isMounted = true;

    const loadBackendStaff = async () => {
      try {
        const detailResponse = await api.get(`/users/${encodeURIComponent(routeId)}`);
        const matched = extractItem<Record<string, unknown>>(detailResponse);

        if (!matched || !isMounted) {
          return;
        }

        let staffDirectory: Record<string, unknown>[] = [matched];

        try {
          const staffResponse = await api.get('/admin/staff', {
            params: {
              includeInactive: true,
            },
          });

          const listedStaff = extractItems<unknown>(staffResponse)
            .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));

          if (listedStaff.length > 0) {
            staffDirectory = listedStaff;
          }
        } catch {
          // keep detail response as fallback source
        }

        const currentStaffBackendId =
          toStringId(matched.id) ||
          toStringId(matched._id) ||
          toStringId(matched.staffId);

        const managerDirectory = staffDirectory
          .filter((entry) => {
            if (!isBranchManagerRecord(entry)) {
              return false;
            }

            const managerId =
              toStringId(entry.id) ||
              toStringId(entry._id) ||
              toStringId(entry.staffId);
            if (managerId && currentStaffBackendId && managerId === currentStaffBackendId) {
              return false;
            }

            return true;
          })
          .map((entry) => {
            const displayName = toDisplayName(entry);
            const managerBranchId = resolveBranchIdFromRecord(entry);
            const managerBranchName = resolveBranchNameFromRecord(entry);

            if (displayName.length === 0) {
              return null;
            }

            return {
              label: displayName,
              value: displayName,
              branchId: managerBranchId,
              branchName: managerBranchName,
            };
          })
          .filter(
            (entry): entry is { label: string; value: string; branchId: string; branchName: string } => entry !== null,
          );

        if (isMounted) {
          setBranchManagerDirectory(managerDirectory);
        }

        const mapped = mapApiStaffToView(matched, routeId, departments, roles, branches, staffDirectory);
        if (!mapped) {
          return;
        }

        setStaff(mapped);
        setStaffStatus(mapped.status);
        setStaffRole(mapped.role);
        setStaffBackendId(typeof mapped.backendId === 'string' && mapped.backendId ? mapped.backendId : null);
      } catch {
        // fallback stays on mock
      }
    };

    void loadBackendStaff();

    return () => {
      isMounted = false;
    };
  }, [id, branches, departments, roles]);

  const reportingToSelectOptions = useMemo<SelectOption[]>(() => {
    const selectedBranchValue =
      editTab === 'employment' && isEditModalOpen
        ? String(editFormik.values.branch ?? '').trim()
        : typeof staff.branch === 'string'
          ? staff.branch.trim()
          : '';

    const normalizedSelectedBranchName = selectedBranchValue.toLowerCase();
    const selectedBranch = branches.find(
      (item) => typeof item.name === 'string' && item.name.trim().toLowerCase() === normalizedSelectedBranchName,
    );
    const selectedBranchId = selectedBranch?.id ?? '';

    const filteredManagers = branchManagerDirectory.filter((item) => {
      if (selectedBranchId.length > 0 && item.branchId.length > 0) {
        return item.branchId === selectedBranchId;
      }

      if (normalizedSelectedBranchName.length > 0 && item.branchName.length > 0) {
        return item.branchName.trim().toLowerCase() === normalizedSelectedBranchName;
      }

      return true;
    });

    const uniqueValues = new Map<string, SelectOption>();

    filteredManagers.forEach((item) => {
      if (item.value.trim().length > 0) {
        uniqueValues.set(item.value, { label: item.label, value: item.value });
      }
    });

    const currentReportingValue =
      editTab === 'employment' && isEditModalOpen
        ? String(editFormik.values.reportingTo ?? '').trim()
        : typeof staff.reportingTo === 'string'
          ? staff.reportingTo.trim()
          : '';

    if (currentReportingValue.length > 0 && currentReportingValue !== '-' && !uniqueValues.has(currentReportingValue)) {
      uniqueValues.set(currentReportingValue, {
        label: currentReportingValue,
        value: currentReportingValue,
      });
    }

    return Array.from(uniqueValues.values());
  }, [
    branchManagerDirectory,
    branches,
    editFormik.values.branch,
    editFormik.values.reportingTo,
    editTab,
    isEditModalOpen,
    staff.branch,
    staff.reportingTo,
  ]);

  async function handleStaffAction(action: string, inputValue?: string) {
    setActiveModal(null);
    const statusUpdates: Record<string, string> = {
      suspend: 'Suspended',
      activate: 'Active'
    };
    const messages: Record<string, string> = {
      changeRole: `Role updated to ${inputValue}`,
      resetPassword: `Password reset link sent to ${staff.email}`,
      suspend: `${staff.name} has been suspended`,
      activate: `${staff.name} has been activated`
    };

    try {
      if (action === 'changeRole' && inputValue) {
        if (staffBackendId) {
          await api.patch(`/users/${staffBackendId}`, {
            organizationId: organizationIdForEdit,
            role: inputValue,
          });
        }

        setStaffRole(inputValue);
        setStaff((prev: any) => ({
          ...prev,
          role: inputValue,
        }));
      }

      if (statusUpdates[action]) {
        const nextStatus = statusUpdates[action];

        if (staffBackendId) {
          await api.patch(`/users/${staffBackendId}`, {
            organizationId: organizationIdForEdit,
            status: nextStatus,
          });
        }

        setStaffStatus(nextStatus);
        setStaff((prev: any) => ({
          ...prev,
          status: nextStatus,
        }));
      }

      showToast(messages[action] || 'Action completed');
    } catch (error) {
      showToast(getActionErrorMessage(error, 'Failed to update staff record'));
    }
  }

  async function handleStaffKycVerify(type: keyof StaffKycStatuses) {
    if (dynamicKycStatuses[type] === 'Verified') {
      return;
    }

    try {
      if (staffBackendId) {
        await api.patch(`/users/${staffBackendId}`, {
          organizationId: organizationIdForEdit,
          kyc: {
            [type]: { status: 'Verified' },
          },
        });
      }

      setStaff((prev: any) => ({
        ...prev,
        kyc: {
          ...prev.kyc,
          [type]: {
            ...(prev.kyc?.[type] ?? {}),
            status: 'Verified',
          },
        },
      }));

      const labels: Record<string, string> = {
        bvn: 'BVN',
        nin: 'NIN',
        guarantorForm: 'Guarantor Form',
        offerLetter: 'Offer Letter'
      };
      showToast(`${labels[type]} verified successfully`);
    } catch (error) {
      showToast(getActionErrorMessage(error, 'Failed to update KYC status'));
    }
  }
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible &&
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: '-50%'
          }}
          exit={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body">
          
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Staff Action Modals */}
      <ConfirmationModal
        isOpen={activeModal === 'changeRole'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => handleStaffAction('changeRole', val)}
        title="Change Staff Role"
        description={`Change the role for ${staff.name}. Current role: ${staffRole}.`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <UserCogIcon size={20} />
          </div>
        }
        confirmLabel="Update Role"
        confirmVariant="primary"
        inputType="select"
        inputLabel="New role"
        selectOptions={[
        {
          label: 'Super Admin',
          value: 'Super Admin'
        },
        {
          label: 'Branch Manager',
          value: 'Branch Manager'
        },
        {
          label: 'Authorizer',
          value: 'Authorizer'
        },
        {
          label: 'Marketer',
          value: 'Marketer'
        },
        {
          label: 'Loan Officer',
          value: 'Loan Officer'
        }]
        }
        requireInput />
      
      <ConfirmationModal
        isOpen={activeModal === 'resetPassword'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => handleStaffAction('resetPassword')}
        title="Reset Password"
        description={`Send a password reset link to ${staff.name} at ${staff.email}?`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <KeyIcon size={20} />
          </div>
        }
        confirmLabel="Send Reset Link"
        confirmVariant="primary" />
      
      <ConfirmationModal
        isOpen={activeModal === 'suspend'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => handleStaffAction('suspend', val)}
        title="Suspend Staff"
        description={`Are you sure you want to suspend ${staff.name}? They will lose access to the portal.`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <AlertCircleIcon size={20} />
          </div>
        }
        confirmLabel="Suspend Staff"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for suspension"
        inputPlaceholder="Provide the reason..."
        requireInput />
      
      <ConfirmationModal
        isOpen={activeModal === 'activate'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => handleStaffAction('activate')}
        title="Activate Staff"
        description={`Are you sure you want to reactivate ${staff.name}'s account?`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircleIcon size={20} />
          </div>
        }
        confirmLabel="Activate Staff"
        confirmVariant="primary" />
      

      {/* Staff KYC Modal */}
      <AnimatePresence>
        {staffKycOpen &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
            <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setStaffKycOpen(false)} />
          
            <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 10
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 10
            }}
            transition={{
              duration: 0.2
            }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            
              <button
              onClick={() => setStaffKycOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              
                <XIcon size={18} />
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShieldCheckIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-gray-900">
                    Staff KYC Verification
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-body text-gray-500">
                    <span>{staff.name} — {staff.id}</span>
                    {import.meta.env.DEV && staff.organizationNameSource &&
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                        {staff.organizationNameSource}
                      </span>
                    }
                  </div>
                </div>
              </div>
              {/* Progress */}
              {(() => {
              const total = 4;
              const verified = Object.values(dynamicKycStatuses).filter(
                (s) => s === 'Verified'
              ).length;
              return (
                <div className="mb-4">
                    <div className="flex justify-between text-xs font-body text-gray-500 mb-1">
                      <span>
                        {verified}/{total} verified
                      </span>
                      <span>{Math.round(verified / total * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${verified / total * 100}%`
                      }} />
                    
                    </div>
                  </div>);

            })()}
              <div className="space-y-1">
                {kycItems.map((item) =>
              <div
                key={item.key}
                className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                        {item.icon}
                      </div>
                      <span className="text-sm font-body text-gray-700">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                    status={item.status as any} />
                  
                      {item.status !== 'Verified' &&
                  <button
                    onClick={() => handleStaffKycVerify(item.key as keyof StaffKycStatuses)}
                    className="text-xs font-heading font-bold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded bg-primary/5">
                    
                          Verify
                        </button>
                  }
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <div className="absolute inset-0 bg-black/40" onClick={closeEditModal} />

            <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">

              <button
              onClick={closeEditModal}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">

                <XIcon size={18} />
              </button>

              <div className="mb-5">
                <h3 className="text-lg font-heading font-bold text-gray-900">
                  Edit {toTitleCase(editTab)} Record
                </h3>
                <p className="text-sm text-gray-500 font-body mt-1">
                  Update {staff.name}&apos;s {toTitleCase(editTab)} information.
                </p>
              </div>

              <form onSubmit={editFormik.handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editTab === 'personal' &&
                  <>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Full Name</label>
                        <input
                          name="fullName"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.fullName}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                        {editFormik.touched.fullName && editFormik.errors.fullName &&
                        <p className="text-xs text-red-500 mt-1">{editFormik.errors.fullName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Phone Number</label>
                        <input
                          name="phoneNumber"
                          inputMode="numeric"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.phoneNumber}
                          onChange={(event) => editFormik.setFieldValue('phoneNumber', sanitizePhoneInput(event.target.value), true)}
                          onBlur={editFormik.handleBlur}
                        />
                        {editFormik.touched.phoneNumber && editFormik.errors.phoneNumber &&
                        <p className="text-xs text-red-500 mt-1">{editFormik.errors.phoneNumber}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Email Address</label>
                        <input
                          name="email"
                          type="email"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.email}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                        {editFormik.touched.email && editFormik.errors.email &&
                        <p className="text-xs text-red-500 mt-1">{editFormik.errors.email}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Date of Birth</label>
                        <input
                          name="dateOfBirth"
                          type="date"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.dateOfBirth}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Gender</label>
                        <input
                          name="gender"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.gender}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Residential Address</label>
                        <input
                          name="address"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.address}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Emergency Contact Name</label>
                        <input
                          name="emergencyName"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.emergencyName}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Emergency Contact Phone</label>
                        <input
                          name="emergencyPhone"
                          inputMode="numeric"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.emergencyPhone}
                          onChange={(event) => editFormik.setFieldValue('emergencyPhone', sanitizePhoneInput(event.target.value), true)}
                          onBlur={editFormik.handleBlur}
                        />
                        {editFormik.touched.emergencyPhone && editFormik.errors.emergencyPhone &&
                        <p className="text-xs text-red-500 mt-1">{editFormik.errors.emergencyPhone}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-body text-gray-500 mb-1">Emergency Contact Relationship</label>
                        <input
                          name="emergencyRelationship"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.emergencyRelationship}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                      </div>
                    </>
                  }

                  {editTab === 'employment' &&
                  <>
                      <ReusableReactSelect
                        name="role"
                        label="Role"
                        formik={editFormik}
                        options={roleOptions}
                        placeholder="Select role"
                      />
                      <ReusableReactSelect
                        name="department"
                        label="Department"
                        formik={editFormik}
                        options={departmentOptions}
                        placeholder="Select department"
                      />
                      <ReusableReactSelect
                        name="branch"
                        label="Branch"
                        formik={editFormik}
                        options={branchOptions}
                        placeholder="Select branch"
                      />
                      <ReusableReactSelect
                        name="employmentType"
                        label="Employment Type"
                        formik={editFormik}
                        options={employmentTypeOptions}
                        placeholder="Select employment type"
                      />
                      <ReusableReactSelect
                        name="reportingTo"
                        label="Reporting To"
                        formik={editFormik}
                        options={reportingToSelectOptions}
                        placeholder="Select reporting manager"
                      />
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-body text-gray-500 mb-1">Salary Grade</label>
                        <input
                          name="salaryGrade"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full"
                          value={editFormik.values.salaryGrade}
                          onChange={editFormik.handleChange}
                          onBlur={editFormik.handleBlur}
                        />
                      </div>
                    </>
                  }

                  {editTab === 'kyc' &&
                  <>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">BVN Status</label>
                        <select name="bvnStatus" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.bvnStatus} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur}>
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">NIN Status</label>
                        <select name="ninStatus" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.ninStatus} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur}>
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Guarantor Form Status</label>
                        <select name="guarantorFormStatus" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.guarantorFormStatus} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur}>
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Offer Letter Status</label>
                        <select name="offerLetterStatus" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.offerLetterStatus} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur}>
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                        </select>
                      </div>
                    </>
                  }

                  {editTab === 'performance' &&
                  <>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Customers Onboarded</label>
                        <input name="customersOnboarded" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.customersOnboarded} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Loans Processed</label>
                        <input name="loansProcessed" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.loansProcessed} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Active Groups</label>
                        <input name="activeGroups" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.activeGroups} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Last Login</label>
                        <input type="date" name="lastLogin" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.lastLogin} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                      </div>
                    </>
                  }

                  {editTab === 'activity' &&
                  <>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-body text-gray-500 mb-1">Activity Action</label>
                        <input name="action" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.action} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                        {editFormik.touched.action && editFormik.errors.action &&
                        <p className="text-xs text-red-500 mt-1">{editFormik.errors.action}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">Date</label>
                        <input type="date" name="date" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.date} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                      </div>
                      <div>
                        <label className="block text-xs font-body text-gray-500 mb-1">By</label>
                        <input name="by" className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full" value={editFormik.values.by} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} />
                        {editFormik.touched.by && editFormik.errors.by &&
                        <p className="text-xs text-red-500 mt-1">{editFormik.errors.by}</p>}
                      </div>
                    </>
                  }
                </div>

                {!organizationIdForEdit &&
                <p className="text-xs text-red-500 mt-4">
                    Organization ID is missing from session; edits are blocked.
                  </p>
                }

                <div className="flex items-center justify-end gap-2 mt-6">
                  <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors">

                    Cancel
                  </button>
                  <button
                  type="submit"
                  disabled={isSavingEdit || !organizationIdForEdit || !editFormik.isValid}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Back Button */}
      <button
        onClick={() => navigate('/staff-management')}
        className="flex items-center gap-2 text-sm font-body text-gray-500 hover:text-primary transition-colors">
        
        <ArrowLeftIcon size={16} />
        Back to Staff Management
      </button>

      {/* Profile Header */}
      <motion.div
        initial={{
          opacity: 0,
          y: 12
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.3
        }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <ProfileAvatar
            src={staff.avatar}
            name={staff.name}
            alt={staff.name}
            className="w-20 h-20 rounded-full border-4 border-primary/10"
            iconSize={30}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h2 className="text-2xl font-heading font-bold text-gray-900">
                {staff.name}
              </h2>
              <StatusBadge status={staffStatus as any} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm font-body text-gray-500">
              <span className="inline-flex items-center gap-2">
                {staff.id}
                {import.meta.env.DEV && staff.organizationNameSource &&
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                    {staff.organizationNameSource}
                  </span>
                }
              </span>
              <span>{staffRole}</span>
              <span>{staff.branch}</span>
              <span>Record Created {formatDate(staff.createdAt || staff.dateHired)}</span>
            </div>
          </div>
          {isSuperAdmin &&
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
              <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">

                <ImageIcon size={15} /> {isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
              </button>
              <button
              onClick={() => setStaffKycOpen(true)}
              className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
              
                <ShieldCheckIcon size={15} /> Verify KYC
              </button>
              <button
              onClick={() => setActiveModal('changeRole')}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              
                <UserCogIcon size={15} /> Change Role
              </button>
              <button
              onClick={() => setActiveModal('resetPassword')}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              
                <KeyIcon size={15} /> Reset Password
              </button>
              {staffStatus === 'Active' &&
            <button
              onClick={() => setActiveModal('suspend')}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-heading font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5">
              
                  <AlertCircleIcon size={15} /> Suspend
                </button>
            }
              {(staffStatus === 'Suspended' || staffStatus === 'On Leave') &&
            <button
              onClick={() => setActiveModal('activate')}
              className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
              
                  <CheckCircleIcon size={15} /> Activate
                </button>
            }
            </div>
          }
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as StaffTabKey)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-body whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                
                <Icon size={16} />
                {tab.label}
              </button>);

          })}
        </div>

        <div className="p-6">
          {/* Personal Information */}
          {activeTab === 'personal' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}>
            {renderTabUpdateButton('personal')}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
            {
              label: 'Full Name',
              value: staff.name
            },
            {
              label: 'Phone Number',
              value: staff.phone
            },
            {
              label: 'Email Address',
              value: staff.email
            },
            {
              label: 'Date of Birth',
              value: formatDate(staff.dob)
            },
            {
              label: 'Gender',
              value: staff.gender
            },
            {
              label: 'Residential Address',
              value: staff.address
            },
            {
              label: 'Emergency Contact',
              value: staff.emergencyContact.name
            },
            {
              label: 'Emergency Phone',
              value: staff.emergencyContact.phone
            },
            {
              label: 'Relationship',
              value: staff.emergencyContact.relationship
            }].
            map((item) =>
            <div key={item.label}>
                  <p className="text-xs text-gray-400 font-body mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm font-body font-medium text-gray-800">
                    {item.value}
                  </p>
                </div>
            )}
            </div>
            </motion.div>
          }

          {/* Employment Details */}
          {activeTab === 'employment' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}>
            {renderTabUpdateButton('employment')}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
            {
              label: 'Staff ID',
              value: staff.id
            },
            {
              label: 'Role',
              value: staff.role
            },
            {
              label: 'Department',
              value: staff.department
            },
            {
              label: 'Branch',
              value: staff.branch
            },
            {
              label: 'Record Created',
              value: formatDate(staff.createdAt || staff.dateHired)
            },
            {
              label: 'Employment Type',
              value: staff.employmentType
            },
            {
              label: 'Reporting To',
              value: staff.reportingTo
            },
            {
              label: 'Salary Grade',
              value: staff.salaryGrade
            }].
            map((item) =>
            <div key={item.label}>
                  <p className="text-xs text-gray-400 font-body mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm font-body font-medium text-gray-800">
                    {item.value}
                  </p>
                </div>
            )}
            </div>
            </motion.div>
          }

          {/* KYC & Verification */}
          {activeTab === 'kyc' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="max-w-xl">
            {renderTabUpdateButton('kyc')}
            {kycItems.map((item) =>
            <KycRow key={item.key} label={item.label} status={item.status} icon={item.icon} />
            )}
            
            </motion.div>
          }

          {/* Performance */}
          {activeTab === 'performance' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}>
            {renderTabUpdateButton('performance')}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {performanceItems.map((item) =>
                <StatCard key={item.label} label={item.label} value={item.value} />
                )}
              </div>
            </motion.div>
          }

          {/* Activity Log */}
          {activeTab === 'activity' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="max-w-2xl">
            {renderTabUpdateButton('activity')}
            
              <div className="relative pl-6 border-l-2 border-gray-100 space-y-6">
                {activityItems.map((item: any, idx: number) =>
              <div key={idx} className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-white border-2 border-primary" />
                    <p className="text-sm font-body text-gray-800">
                      {typeof item.action === 'string' ? toTitleCase(item.action) : item.action}
                    </p>
                    <p className="text-xs font-body text-gray-400 mt-0.5">
                      {formatDate(item.date)} • by {typeof item.by === 'string' ? toTitleCase(item.by) : item.by}
                    </p>
                  </div>
              )}
                {activityItems.length === 0 &&
                <p className="text-sm text-gray-500">No activity logs available.</p>
                }
              </div>
            </motion.div>
          }
        </div>
      </div>
    </div>);

}