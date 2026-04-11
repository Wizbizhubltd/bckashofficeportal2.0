import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingIcon,
  PlusIcon,
  WalletIcon,
  UsersIcon,
  CheckCircle2Icon,
  SearchIcon,
  FilterIcon,
  CheckCircleIcon } from
'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import {
  BranchData,
  CreateBranchPayload,
  EditBranchPayload,
  CreateBranchModal,
  EditBranchModal,
  FundBranchModal } from
'./branches/BranchModals';
import { api } from '../app/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { upsertBranchScoped } from '../store/slices/lookupsSlice';
import { useAuth } from '../context/AuthContext';
import type { BranchManagerLookup } from '../store/slices/lookupsSlice';
export const initialBranches: BranchData[] = [
{
  id: 'BR-001',
  name: 'Ikeja Branch',
  location: 'Ikeja, Lagos',
  manager: 'Fatima Abubakar',
  staff: 12,
  fund: '₦50,000,000',
  activeLoans: 45,
  status: 'Active',
  phone: '+234 801 234 5678',
  email: 'ikeja@bckashmfb.com.ng',
  dateCreated: '2022-03-15',
  totalDisbursed: '₦180,000,000',
  repaymentRate: '97.2%',
  bankAccounts: [
  {
    id: 'BA-001',
    bankName: 'First Bank',
    accountNumber: '2034567890',
    accountName: 'BCKash MFB - Ikeja',
    isCurrent: true,
    dateAdded: '2022-03-15'
  },
  {
    id: 'BA-002',
    bankName: 'GTBank',
    accountNumber: '0112345678',
    accountName: 'BCKash MFB Ikeja Ops',
    isCurrent: false,
    dateAdded: '2023-06-10'
  }],

  fundingHistory: [
  {
    id: 'FH-001',
    amount: '₦20,000,000',
    date: '2022-03-20',
    reference: 'FND-2022-001',
    allocatedBy: 'Adebayo Johnson',
    note: 'Initial branch setup fund'
  },
  {
    id: 'FH-002',
    amount: '₦15,000,000',
    date: '2023-01-10',
    reference: 'FND-2023-012',
    allocatedBy: 'Adebayo Johnson',
    note: 'Q1 2023 top-up'
  },
  {
    id: 'FH-003',
    amount: '₦15,000,000',
    date: '2024-07-01',
    reference: 'FND-2024-045',
    allocatedBy: 'Adebayo Johnson',
    note: 'H2 2024 allocation'
  }]

},
{
  id: 'BR-002',
  name: 'Surulere Branch',
  location: 'Surulere, Lagos',
  manager: 'Emeka Nnamdi',
  staff: 8,
  fund: '₦30,000,000',
  activeLoans: 28,
  status: 'Active',
  phone: '+234 802 345 6789',
  email: 'surulere@bckashmfb.com.ng',
  dateCreated: '2022-06-20',
  totalDisbursed: '₦95,000,000',
  repaymentRate: '96.8%',
  bankAccounts: [
  {
    id: 'BA-003',
    bankName: 'Access Bank',
    accountNumber: '0987654321',
    accountName: 'BCKash MFB - Surulere',
    isCurrent: true,
    dateAdded: '2022-06-20'
  }],

  fundingHistory: [
  {
    id: 'FH-004',
    amount: '₦15,000,000',
    date: '2022-06-25',
    reference: 'FND-2022-018',
    allocatedBy: 'Adebayo Johnson',
    note: 'Initial fund'
  },
  {
    id: 'FH-005',
    amount: '₦15,000,000',
    date: '2024-01-15',
    reference: 'FND-2024-003',
    allocatedBy: 'Adebayo Johnson',
    note: 'Annual top-up'
  }]

},
{
  id: 'BR-003',
  name: 'Mushin Branch',
  location: 'Mushin, Lagos',
  manager: 'Oluwaseun Ade',
  staff: 15,
  fund: '₦80,000,000',
  activeLoans: 72,
  status: 'Active',
  phone: '+234 803 456 7890',
  email: 'mushin@bckashmfb.com.ng',
  dateCreated: '2021-11-10',
  totalDisbursed: '₦320,000,000',
  repaymentRate: '95.4%',
  bankAccounts: [
  {
    id: 'BA-004',
    bankName: 'Zenith Bank',
    accountNumber: '1023456789',
    accountName: 'BCKash MFB - Mushin',
    isCurrent: true,
    dateAdded: '2021-11-10'
  },
  {
    id: 'BA-005',
    bankName: 'UBA',
    accountNumber: '2098765432',
    accountName: 'BCKash Mushin Operations',
    isCurrent: false,
    dateAdded: '2022-08-15'
  },
  {
    id: 'BA-006',
    bankName: 'First Bank',
    accountNumber: '3012345678',
    accountName: 'BCKash MFB Mushin Collections',
    isCurrent: false,
    dateAdded: '2023-03-01'
  }],

  fundingHistory: [
  {
    id: 'FH-006',
    amount: '₦30,000,000',
    date: '2021-11-15',
    reference: 'FND-2021-042',
    allocatedBy: 'Adebayo Johnson',
    note: 'Initial setup — flagship branch'
  },
  {
    id: 'FH-007',
    amount: '₦25,000,000',
    date: '2023-04-01',
    reference: 'FND-2023-028',
    allocatedBy: 'Adebayo Johnson',
    note: 'Expansion fund'
  },
  {
    id: 'FH-008',
    amount: '₦25,000,000',
    date: '2025-01-10',
    reference: 'FND-2025-002',
    allocatedBy: 'Adebayo Johnson',
    note: '2025 allocation'
  }]

},
{
  id: 'BR-004',
  name: 'Oshodi Branch',
  location: 'Oshodi, Lagos',
  manager: 'Unassigned',
  staff: 0,
  fund: '₦0',
  activeLoans: 0,
  status: 'Pending',
  phone: '',
  email: '',
  dateCreated: '2026-06-01',
  totalDisbursed: '₦0',
  repaymentRate: '-',
  bankAccounts: [],
  fundingHistory: []
},
{
  id: 'BR-005',
  name: 'Alaba Branch',
  location: "Alaba Int'l Market",
  manager: 'Chidi Okeke',
  staff: 10,
  fund: '₦45,000,000',
  activeLoans: 35,
  status: 'Active',
  phone: '+234 805 678 9012',
  email: 'alaba@bckashmfb.com.ng',
  dateCreated: '2023-01-08',
  totalDisbursed: '₦150,000,000',
  repaymentRate: '98.1%',
  bankAccounts: [
  {
    id: 'BA-007',
    bankName: 'Fidelity Bank',
    accountNumber: '5012345678',
    accountName: 'BCKash MFB - Alaba',
    isCurrent: true,
    dateAdded: '2023-01-08'
  }],

  fundingHistory: [
  {
    id: 'FH-009',
    amount: '₦25,000,000',
    date: '2023-01-12',
    reference: 'FND-2023-002',
    allocatedBy: 'Adebayo Johnson',
    note: 'Initial fund allocation'
  },
  {
    id: 'FH-010',
    amount: '₦20,000,000',
    date: '2024-06-01',
    reference: 'FND-2024-038',
    allocatedBy: 'Adebayo Johnson',
    note: 'Mid-year top-up'
  }]

}];

function parseFund(fund: string): number {
  return parseInt(fund.replace(/[₦,]/g, ''), 10) || 0;
}
function formatFund(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function toStringId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const source = value as Record<string, unknown>;
  const candidate = source.id ?? source._id;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate);
  }

  return '';
}

function computeBranchFundingTotalFromRaw(raw: unknown): number {
  if (!raw || typeof raw !== 'object') {
    return 0;
  }

  const source = raw as Record<string, unknown>;
  if (!Array.isArray(source.fundingHistory)) {
    return 0;
  }

  return source.fundingHistory.reduce((sum, item) => {
    if (!item || typeof item !== 'object') {
      return sum;
    }

    const entry = item as Record<string, unknown>;
    const amount = typeof entry.amount === 'number' ? entry.amount : Number(entry.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function mapFundingHistory(raw: unknown): BranchData['fundingHistory'] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const amount =
        typeof source.amount === 'number'
          ? source.amount
          : typeof source.amount === 'string'
            ? parseInt(source.amount.replace(/[^0-9]/g, ''), 10)
            : 0;
      const date = typeof source.date === 'string' ? source.date : new Date().toISOString();

      return {
        id: typeof source.id === 'string' ? source.id : typeof source._id === 'string' ? source._id : `FH-${Date.now()}`,
        amount: formatFund(Number.isFinite(amount) ? amount : 0),
        date: new Date(date).toISOString().split('T')[0],
        reference: typeof source.reference === 'string' ? source.reference : '-',
        allocatedBy: typeof source.allocatedBy === 'string' ? source.allocatedBy : 'System',
        note: typeof source.note === 'string' ? source.note : '',
      };
    })
    .filter((item): item is BranchData['fundingHistory'][number] => item !== null);
}

function mapBankAccounts(raw: unknown): BranchData['bankAccounts'] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const dateAdded = typeof source.dateAdded === 'string' ? source.dateAdded : new Date().toISOString();
      return {
        id: typeof source.id === 'string' ? source.id : typeof source._id === 'string' ? source._id : `BA-${Date.now()}`,
        bankName: typeof source.bankName === 'string' ? source.bankName : '-',
        accountNumber: typeof source.accountNumber === 'string' ? source.accountNumber : '-',
        accountName: typeof source.accountName === 'string' ? source.accountName : '-',
        isCurrent: Boolean(source.isCurrent),
        dateAdded: new Date(dateAdded).toISOString().split('T')[0],
      };
    })
    .filter((item): item is BranchData['bankAccounts'][number] => item !== null);
}

function extractItem<T>(response: unknown): T | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const source = response as { data?: T; payload?: T; item?: T };

  if (source.data && !Array.isArray(source.data)) {
    return source.data;
  }

  if (source.payload && !Array.isArray(source.payload)) {
    return source.payload;
  }

  if (source.item && !Array.isArray(source.item)) {
    return source.item;
  }

  return null;
}

function resolveManagerDisplayName(rawManager: unknown, managers: BranchManagerLookup[]): string {
  if (rawManager && typeof rawManager === 'object') {
    const source = rawManager as Record<string, unknown>;
    const joined = `${typeof source.firstName === 'string' ? source.firstName : ''} ${typeof source.lastName === 'string' ? source.lastName : ''}`.trim();
    if (joined.length > 0) {
      return joined;
    }
    if (typeof source.name === 'string' && source.name.trim().length > 0) {
      return source.name;
    }
    if (typeof source.fullName === 'string' && source.fullName.trim().length > 0) {
      return source.fullName;
    }
  }

  if (typeof rawManager === 'string' && rawManager.trim().length > 0) {
    const matched = managers.find((item) => item.id === rawManager.trim());
    if (matched) {
      return matched.fullName;
    }
    return rawManager;
  }

  return 'Unassigned';
}

function mapBranchFromApi(raw: unknown, managers: BranchManagerLookup[]): BranchData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = source.id ?? source._id;
  const name = source.name;
  const code = source.code;
  const city = source.city;
  const state = source.state;
  const address = source.address;

  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    typeof name !== 'string' ||
    typeof city !== 'string' ||
    typeof state !== 'string' ||
    typeof address !== 'string'
  ) {
    return null;
  }

  const isActive = Boolean(source.isActive);
  const createdAt = typeof source.createdAt === 'string' ? source.createdAt : '';
  const dateCreated = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
  const walletBalance = toFiniteNumber(source.walletBalance);
  const totalFundAllocated =
    toFiniteNumber(source.totalFundAllocated) > 0
      ? toFiniteNumber(source.totalFundAllocated)
      : computeBranchFundingTotalFromRaw(source);
  const staffCount =
    toFiniteNumber(source.staffCount) > 0
      ? toFiniteNumber(source.staffCount)
      : toFiniteNumber(source.staff) > 0
        ? toFiniteNumber(source.staff)
        : 0;
  const activeLoansCount =
    toFiniteNumber(source.activeLoansCount) > 0
      ? toFiniteNumber(source.activeLoansCount)
      : toFiniteNumber(source.activeLoans) > 0
        ? toFiniteNumber(source.activeLoans)
        : 0;
  const resolvedManagerId = toStringId(source.managerId);

  return {
    id: String(id),
    name,
    code: typeof code === 'string' ? code : undefined,
    state,
    city,
    address,
    managerId: resolvedManagerId || undefined,
    organizationId: typeof source.organizationId === 'string' ? source.organizationId : undefined,
    location: `${city}, ${state}`,
    manager: resolveManagerDisplayName(source.managerId, managers),
    staff: staffCount,
    fund: formatFund(totalFundAllocated || walletBalance),
    activeLoans: activeLoansCount,
    status: isActive ? 'Active' : 'Inactive',
    phone: typeof source.phone === 'string' ? source.phone : '',
    email: typeof source.email === 'string' ? source.email : '',
    dateCreated,
    totalDisbursed: '₦0',
    repaymentRate: '-',
    bankAccounts: mapBankAccounts(source.bankAccounts),
    fundingHistory: mapFundingHistory(source.fundingHistory),
    totalFundAllocated,
  };
}

function upsertBranchData(items: BranchData[], incoming: BranchData): BranchData[] {
  const existingIndex = items.findIndex((item) => item.id === incoming.id);
  if (existingIndex === -1) {
    return [...items, incoming];
  }

  const next = [...items];
  next[existingIndex] = incoming;
  return next;
}

function mapBranchToLookupPayload(branch: BranchData) {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    phone: branch.phone,
    email: branch.email,
    managerId: branch.managerId,
    organizationId: branch.organizationId,
    isActive: branch.status === 'Active',
  };
}

type FundingHistoryItem = {
  id: string;
  branchId: string;
  branchName: string;
  amount: string;
  date: string;
  reference: string;
  allocatedBy: string;
  note: string;
};

export function BranchManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const lookupBranches = useAppSelector((state) => state.lookups.branches);
  const branchManagers = useAppSelector((state) => state.lookups.branchManagers);
  const organizationIdFromUser =
    typeof user?.organizationId === 'string' && user.organizationId.trim().length > 0
      ? user.organizationId.trim()
      : null;
  const [branches, setBranches] = useState<BranchData[]>(initialBranches);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeView, setActiveView] = useState<'branches' | 'funding-history'>('branches');
  const [fundingBranchFilter, setFundingBranchFilter] = useState<string>('all');
  const [fundingFromDate, setFundingFromDate] = useState<string>('');
  const [fundingToDate, setFundingToDate] = useState<string>('');
  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyLoading = false;
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
  const [hasLoadedFromApi, setHasLoadedFromApi] = useState(false);
  // Toast
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

  useEffect(() => {
    if (hasLoadedFromApi) {
      return;
    }

    if (lookupBranches.length > 0) {
      const normalized = lookupBranches
        .map((branch) =>
          mapBranchFromApi(
            {
              id: branch.id,
              name: branch.name,
              code: branch.code,
              city: branch.city,
              state: branch.state,
              address: branch.address,
              managerId: branch.managerId,
              organizationId: branch.organizationId,
              phone: branch.phone,
              email: branch.email,
              isActive: branch.isActive,
            },
            branchManagers,
          ),
        )
        .filter(Boolean) as BranchData[];

      if (normalized.length > 0) {
        setBranches(normalized);
        return;
      }
    }

    setBranches(initialBranches);
  }, [branchManagers, hasLoadedFromApi, lookupBranches]);

  useEffect(() => {
    let isMounted = true;

    const loadBranches = async () => {
      try {
        const response = await api.get('/admin/branches', {
          params: {
            includeInactive: true,
          },
        });

        const source = response as { data?: unknown; payload?: unknown; items?: unknown };
        const rawBranches =
          (Array.isArray(source.data) ? source.data : null) ||
          (Array.isArray(source.payload) ? source.payload : null) ||
          (Array.isArray(source.items) ? source.items : null) ||
          [];

        const mapped = rawBranches
          .map((entry) => mapBranchFromApi(entry, branchManagers))
          .filter((entry): entry is BranchData => entry !== null);

        if (!isMounted || mapped.length === 0) {
          return;
        }

        setBranches(mapped);
        setHasLoadedFromApi(true);
        mapped.forEach((branch) => {
          dispatch(upsertBranchScoped(mapBranchToLookupPayload(branch)));
        });
      } catch {
        // keep lookup/mock fallback
      }
    };

    void loadBranches();

    return () => {
      isMounted = false;
    };
  }, [branchManagers, dispatch]);
  // Dynamic KPIs
  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.status === 'Active').length;
  const totalFunded = branches.reduce((sum, b) => sum + (b.totalFundAllocated ?? parseFund(b.fund)), 0);
  const totalStaff = branches.reduce((sum, b) => sum + (b.staff ??  0), 0);
  // Filter
  const filtered = branches.filter((b) => {
    const matchesSearch =
    !searchQuery.trim() ||
    [b.name, b.id, b.location, b.manager].some((f) =>
    f.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fundingHistoryItems = useMemo<FundingHistoryItem[]>(() => {
    const flattened = branches.flatMap((branch) =>
      branch.fundingHistory.map((entry) => ({
        id: `${branch.id}-${entry.id}`,
        branchId: branch.id,
        branchName: branch.name,
        amount: entry.amount,
        date: entry.date,
        reference: entry.reference,
        allocatedBy: entry.allocatedBy,
        note: entry.note,
      })),
    );

    const fromTime = fundingFromDate ? new Date(fundingFromDate).getTime() : null;
    const toTime = fundingToDate ? new Date(fundingToDate).getTime() : null;

    return flattened
      .filter((item) => {
        if (fundingBranchFilter !== 'all' && item.branchId !== fundingBranchFilter) {
          return false;
        }

        const itemTime = new Date(item.date).getTime();
        if (fromTime !== null && itemTime < fromTime) {
          return false;
        }
        if (toTime !== null && itemTime > toTime) {
          return false;
        }

        return true;
      })
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
  }, [branches, fundingBranchFilter, fundingFromDate, fundingToDate]);

  const fundingHistoryTotal = useMemo(
    () => fundingHistoryItems.reduce((sum, item) => sum + parseFund(item.amount), 0),
    [fundingHistoryItems],
  );
  const isFundingFiltersDefault =
    fundingBranchFilter === 'all' &&
    fundingFromDate.length === 0 &&
    fundingToDate.length === 0;

  function exportFundingHistoryCsv() {
    if (fundingHistoryItems.length === 0) {
      showToast('No funding history rows to export');
      return;
    }

    const escapeCsvValue = (value: string) => {
      const normalized = value.replace(/\r?\n|\r/g, ' ').trim();
      return `"${normalized.replace(/"/g, '""')}"`;
    };

    const headers = ['Date', 'Branch', 'Amount', 'Reference', 'Allocated By', 'Note'];
    const rows = fundingHistoryItems.map((item) => [
      item.date,
      item.branchName,
      item.amount,
      item.reference,
      item.allocatedBy,
      item.note || '-',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(String(cell))).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const branchSegment =
      fundingBranchFilter === 'all'
        ? 'all-branches'
        : branches.find((branch) => branch.id === fundingBranchFilter)?.name.replace(/\s+/g, '-').toLowerCase() || 'filtered';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `funding-history-${branchSegment}-${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Funding history CSV exported');
  }

  function resetFundingFilters() {
    if (isFundingFiltersDefault) {
      return;
    }

    setFundingBranchFilter('all');
    setFundingFromDate('');
    setFundingToDate('');
  }

  async function handleCreate(data: CreateBranchPayload) {
    if (!organizationIdFromUser) {
      showToast('Organization ID is missing from your account');
      return;
    }

    try {
      const response = await api.post('/admin/branches', {
        ...data,
        organizationId: organizationIdFromUser,
      });
      const createdRaw = extractItem<unknown>(response);
      const createdBranch = mapBranchFromApi(createdRaw, branchManagers);

      if (createdBranch) {
        setBranches((prev) => upsertBranchData(prev, createdBranch));
        dispatch(upsertBranchScoped(mapBranchToLookupPayload(createdBranch)));
      }

      showToast(`Branch "${data.name}" created successfully`);
    } catch {
      const nextId = `BR-${String(branches.length + 1).padStart(3, '0')}`;
      const newBranch: BranchData = {
        id: nextId,
        name: data.name,
        code: data.code,
        state: data.state,
        city: data.city,
        address: data.address,
        location: `${data.city}, ${data.state}`,
        managerId: data.managerId,
        organizationId: organizationIdFromUser,
        manager: resolveManagerDisplayName(data.managerId, branchManagers),
        staff: 0,
        fund: '₦0',
        activeLoans: 0,
        status: data.managerId ? 'Active' : 'Pending',
        phone: data.phone ?? '',
        email: data.email ?? '',
        dateCreated: new Date().toISOString().split('T')[0],
        totalDisbursed: '₦0',
        repaymentRate: '-',
        bankAccounts: [],
        fundingHistory: []
      };

      setBranches((prev) => [...prev, newBranch]);
      dispatch(upsertBranchScoped(mapBranchToLookupPayload(newBranch)));
      showToast(`Branch "${data.name}" created locally (API unavailable)`);
    }
  }
  async function handleEdit(id: string, data: EditBranchPayload) {
    if (!organizationIdFromUser) {
      showToast('Organization ID is missing from your account');
      return;
    }

    const currentBranch = branches.find((branch) => branch.id === id);

    try {
      await api.patch(`/admin/branches/${id}`, {
        name: data.name,
        code: data.code,
        address: data.address,
        city: data.city,
        state: data.state,
        phone: data.phone,
        email: data.email,
        managerId: data.managerId,
        organizationId: organizationIdFromUser,
      });

      if (currentBranch && currentBranch.status !== data.status) {
        if (data.status === 'Active') {
          await api.patch(`/admin/branches/${id}/reactivate`);
        } else {
          await api.patch(`/admin/branches/${id}/deactivate`);
        }
      }

      const updatedBranch: BranchData = {
        ...(currentBranch ?? {
          id,
          name: data.name,
          code: data.code,
          state: data.state,
          city: data.city,
          address: data.address,
          managerId: data.managerId,
          organizationId: organizationIdFromUser,
          location: `${data.city}, ${data.state}`,
          manager: resolveManagerDisplayName(data.managerId, branchManagers),
          staff: 0,
          fund: '₦0',
          activeLoans: 0,
          status: data.status,
          phone: data.phone ?? '',
          email: data.email ?? '',
          dateCreated: '',
          totalDisbursed: '₦0',
          repaymentRate: '-',
          bankAccounts: [],
          fundingHistory: [],
        }),
        name: data.name,
        code: data.code,
        address: data.address,
        city: data.city,
        state: data.state,
        location: `${data.city}, ${data.state}`,
        managerId: data.managerId,
        organizationId: organizationIdFromUser,
        manager: resolveManagerDisplayName(data.managerId, branchManagers),
        phone: data.phone ?? '',
        email: data.email ?? '',
        status: data.status,
      };

      setBranches((prev) => upsertBranchData(prev, updatedBranch));
      dispatch(upsertBranchScoped(mapBranchToLookupPayload(updatedBranch)));
      showToast('Branch updated successfully');
      return;
    } catch {
      setBranches((prev) =>
        prev.map((branch) =>
          branch.id === id
            ? {
                ...branch,
                name: data.name,
                code: data.code,
                address: data.address,
                city: data.city,
                state: data.state,
                location: `${data.city}, ${data.state}`,
                managerId: data.managerId,
                organizationId: organizationIdFromUser,
                manager: resolveManagerDisplayName(data.managerId, branchManagers),
                phone: data.phone ?? '',
                email: data.email ?? '',
                status: data.status,
              }
            : branch,
        ),
      );
      showToast('Branch updated locally (API unavailable)');
    }
  }

  async function handleFund(id: string, amount: number, note: string) {
    try {
      const response = await api.post(`/admin/branches/${id}/funding`, {
        amount,
        note: note || undefined,
      });
      const updated = mapBranchFromApi(extractItem<unknown>(response), branchManagers);

      if (updated) {
        setBranches((prev) => upsertBranchData(prev, updated));
        dispatch(upsertBranchScoped(mapBranchToLookupPayload(updated)));
      }
      showToast(`₦${amount.toLocaleString()} allocated successfully`);
      return;
    } catch {
      setBranches((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const current = parseFund(b.fund);
          const newRecord = {
            id: `FH-${Date.now()}`,
            amount: formatFund(amount),
            date: new Date().toISOString().split('T')[0],
            reference: `FND-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
            allocatedBy: user?.email || 'System',
            note: note || 'Fund allocation'
          };
          return {
            ...b,
            fund: formatFund(current + amount),
            fundingHistory: [newRecord, ...b.fundingHistory]
          };
        })
      );
      const branch = branches.find((b) => b.id === id);
      showToast(`₦${amount.toLocaleString()} allocated to ${branch?.name || id} (local)`);
    }
  }
  return (
    <div className="space-y-6">
      {/* Toast */}
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

      {/* Modals */}
      <CreateBranchModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate} />
      
      <EditBranchModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        branch={selectedBranch}
        onSubmit={handleEdit} />
      
      <FundBranchModal
        isOpen={fundOpen}
        onClose={() => setFundOpen(false)}
        branch={selectedBranch}
        onSubmit={handleFund} />

      <AnimatePresence>
        {historyOpen && selectedBranch &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-heading font-bold text-gray-900">Funding History</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedBranch.name}</p>
              <div className="mt-4 space-y-3">
                {historyLoading && <p className="text-sm text-gray-500">Loading funding history...</p>}
                {!historyLoading && selectedBranch.fundingHistory.length === 0 && (
                  <p className="text-sm text-gray-500">No funding history available.</p>
                )}
                {!historyLoading && selectedBranch.fundingHistory.map((entry) => (
                  <div key={entry.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-heading font-bold text-gray-900">{entry.amount}</p>
                      <p className="text-xs text-gray-400">{entry.date}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Ref: {entry.reference}</p>
                    <p className="text-xs text-gray-500">By: {entry.allocatedBy}</p>
                    {entry.note && <p className="text-xs text-gray-600 mt-1">{entry.note}</p>}
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-heading font-bold text-gray-600 hover:bg-gray-50">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
      

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-primary">
            Branch Management
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage branches, allocate funds, and monitor performance
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-[#e64a19] transition-colors text-sm font-heading font-bold shadow-sm">
          
          <PlusIcon size={16} className="mr-2" />
          Create New Branch
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 mr-4">
            <BuildingIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Branches</p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {totalBranches}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 rounded-lg text-green-600 mr-4">
            <CheckCircle2Icon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Active Branches</p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {activeBranches}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 mr-4">
            <WalletIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Funded</p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {totalFunded >= 1000000 ?
              `₦${(totalFunded / 1000000).toFixed(0)}M` :
              formatFund(totalFunded)}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600 mr-4">
            <UsersIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">
              Total Field Staff
            </p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {totalStaff}
            </h3>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveView('branches')}
          className={`px-4 py-2 rounded-lg text-sm font-heading font-bold transition-colors ${activeView === 'branches' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Branches
        </button>
        <button
          onClick={() => setActiveView('funding-history')}
          className={`px-4 py-2 rounded-lg text-sm font-heading font-bold transition-colors ${activeView === 'funding-history' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Funding History
        </button>
      </div>

      {activeView === 'branches' &&
      <>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search branches..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />

            </div>
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium">

                <FilterIcon size={16} className="mr-2" /> Filter
                {statusFilter !== 'all' &&
                <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />
                }
              </button>
              {filterOpen &&
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-40">
                  {['all', 'Active', 'Pending', 'Inactive'].map((s) =>
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setFilterOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-body hover:bg-gray-50 transition-colors ${statusFilter === s ? 'text-primary font-bold bg-primary/5' : 'text-gray-600'}`}>

                      {s === 'all' ? 'All Statuses' : s}
                    </button>
                )}
                </div>
              }
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                    <th className="px-6 py-4 font-medium">Branch Name</th>
                    <th className="px-6 py-4 font-medium">Manager</th>
                    <th className="px-6 py-4 font-medium">Staff</th>
                    <th className="px-6 py-4 font-medium">Fund Allocated</th>
                    <th className="px-6 py-4 font-medium">Active Loans</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filtered.map((branch) =>
                  <tr
                    key={branch.id}
                    onClick={() => {
                      setSelectedBranch(branch);
                      navigate(`/branches/${branch.id}`);
                    }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer">

                      <td className="px-6 py-4">
                        <p className="font-heading font-medium text-primary">
                          {branch.name}
                        </p>
                        <p className="text-xs text-gray-400">{branch.location}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {branch.manager === 'Unassigned' ?
                      <span className="text-gray-400 italic">
                            Pending Assignment
                          </span> :

                      branch.manager
                      }
                      </td>
                      <td className="px-6 py-4 text-gray-600">{branch.staff ?? 0}</td>
                      <td className="px-6 py-4 font-medium text-gray-700">
                        {branch.totalFundAllocated ? formatFund(branch?.totalFundAllocated) : branch?.fund}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{branch.activeLoans ?? 0}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={branch.status as any} />
                      </td>
                    </tr>
                  )}
                  {filtered.length === 0 &&
                  <tr>
                      <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-400 text-sm font-body">

                        No branches match your search.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      }

      {activeView === 'funding-history' &&
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-heading">Total Amount</p>
                <p className="text-lg font-heading font-bold text-primary">{formatFund(fundingHistoryTotal)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isFundingFiltersDefault
                    ? 'No active filters. Showing all funding records.'
                    : 'Active filters applied. Results and totals reflect selected filters.'}
                </p>
              </div>
              <p className="text-xs text-gray-500">{fundingHistoryItems.length} record{fundingHistoryItems.length === 1 ? '' : 's'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              value={fundingBranchFilter}
              onChange={(event) => setFundingBranchFilter(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="all">All Branches</option>
              {branches.map((branch) =>
              <option key={branch.id} value={branch.id}>{branch.name}</option>
              )}
            </select>
            <input
              type="date"
              value={fundingFromDate}
              onChange={(event) => setFundingFromDate(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="date"
              value={fundingToDate}
              onChange={(event) => setFundingToDate(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={exportFundingHistoryCsv}
              className="px-3 py-2 border border-primary text-primary rounded-lg text-sm font-heading font-bold hover:bg-primary/5 transition-colors">
              Export CSV
            </button>
            <button
              onClick={resetFundingFilters}
              disabled={isFundingFiltersDefault}
              title={isFundingFiltersDefault ? 'No active filters' : 'Reset active filters'}
              className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-heading font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
              Reset Filters
            </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Branch</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Allocated By</th>
                  <th className="px-6 py-4 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {fundingHistoryItems.map((item) =>
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{item.date}</td>
                    <td className="px-6 py-4 text-primary font-medium">{item.branchName}</td>
                    <td className="px-6 py-4 font-heading font-bold text-gray-800">{item.amount}</td>
                    <td className="px-6 py-4 text-gray-600">{item.reference}</td>
                    <td className="px-6 py-4 text-gray-600">{item.allocatedBy}</td>
                    <td className="px-6 py-4 text-gray-500">{item.note || '—'}</td>
                  </tr>
                )}
                {fundingHistoryItems.length === 0 &&
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      No funding history found for selected filters.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>);

}