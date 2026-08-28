import { Fragment, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import { customersService, type Customer, type CustomerKycCaptureStatus } from '../../services/customers/customers.service';
import { groupsService, type Group, type GroupMemberRole } from '../../services/groups/groups.service';
import { toTitleCase } from '../../utils/staff-display';

function toDisplayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
}

function maskTail(value: string): string {
  const digits = value.trim();
  return digits.length < 4 ? '—' : `••••••${digits.slice(-4)}`;
}

const CUSTOMER_STATUS_LABEL: Record<Customer['status'], string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  ACTIVE: 'Approved',
  REJECTED: 'Rejected',
  DISABLED: 'Suspended',
};

function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-300 px-3 py-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 font-medium mt-0.5">{value || '—'}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-gray-100 border border-gray-300 px-3 py-2 mt-6 first:mt-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{title}</h3>
    </div>
  );
}

/**
 * A hard-copy biodata form — every field pulled live from the real
 * Customer/Group/KYC-status APIs (this used to read a mocked shape with
 * dob/gender/lga/state, none of which exist on the real Customer record —
 * see PHASE_5_NOTES.md). "Generate" means "render + browser print-to-PDF"
 * (window.print), same as every other printable page in this app — no new
 * PDF dependency needed.
 */
export function CustomerPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const branches = useAppSelector((state) => state.lookups.branches);
  const isApproveTier = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [kycStatus, setKycStatus] = useState<CustomerKycCaptureStatus | null>(null);
  const [mismatchFlagged, setMismatchFlagged] = useState(false);
  const [customerGroup, setCustomerGroup] = useState<{ group: Group; role: GroupMemberRole } | null>(null);
  const [bvnTail, setBvnTail] = useState<string | null>(null);
  const [ninTail, setNinTail] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setLoadError('Invalid customer id.');
      return;
    }
    let isMounted = true;
    setIsLoading(true);

    (async () => {
      try {
        const detail = await customersService.getById(id);
        if (!isMounted) return;
        setCustomer(detail);

        const [status, groups] = await Promise.all([
          customersService.getKycCaptureStatus(id).catch(() => null),
          detail.status === 'ACTIVE' ? groupsService.list().catch(() => []) : Promise.resolve([]),
        ]);
        if (isMounted) setKycStatus(status);

        if (isMounted && groups.length > 0) {
          for (const group of groups) {
            try {
              const members = await groupsService.getMembers(group.id);
              const membership = members.find((m) => m.customerId === id && !m.leftAt);
              if (membership) {
                setCustomerGroup({ group, role: membership.role });
                break;
              }
            } catch {
              // Outside the viewer's row-level scope — skip, not fatal.
            }
          }
        }

        customersService
          .getMismatchFlags(id)
          .then((result) => {
            if (isMounted) setMismatchFlagged(result.mismatchFlags.length > 0);
          })
          .catch(() => {});

        if (status?.biometricCaptured) {
          customersService
            .getBiometricSignedUrl(id)
            .then((result) => {
              if (isMounted) setPhotoUrl(result.url);
            })
            .catch(() => {});
        }

        // The actual BVN/NIN digits are Admin/SuperAdmin/Approver-only
        // everywhere else in this app (see customer.controller.ts) — same
        // rule here, masked to the last 4 either way. Anyone else printing
        // this form only sees verification status, never the number.
        if (isApproveTier) {
          customersService
            .getDecryptedBvn(id)
            .then((result) => {
              if (isMounted) setBvnTail(maskTail(result.bvn));
            })
            .catch(() => {});
          if (status?.ninRecorded) {
            customersService
              .getDecryptedNin(id)
              .then((result) => {
                if (isMounted && result.nin) setNinTail(maskTail(result.nin));
              })
              .catch(() => {});
          }
        }
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : 'Failed to load customer');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id, isApproveTier]);

  const branchName = useMemo(
    () => (customer ? branches.find((b) => b.id === customer.branchId)?.name ?? '—' : '—'),
    [customer, branches],
  );

  const today = new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
  const fullName = customer ? toTitleCase(`${customer.firstName} ${customer.lastName}`.trim()) || 'Unknown Customer' : '';
  const canPrint = !isLoading && customer !== null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400 font-body">Loading customer data...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500 font-body">{loadError || 'Customer not found.'}</p>
        <button onClick={() => navigate('/customers')} className="text-sm text-primary hover:underline">Back to Customers</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Action Bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 lg:px-8 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(`/customers/${customer.id}`)}
          className="flex items-center gap-2 text-sm font-body text-gray-500 hover:text-primary transition-colors"
        >
          <ArrowLeftIcon size={16} />
          Back to Customer Profile
        </button>
        <button
          onClick={() => window.print()}
          disabled={!canPrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          <PrinterIcon size={16} />
          {canPrint ? 'Print / Save as PDF' : 'Loading...'}
        </button>
      </div>

      {/* Printable Content */}
      <div className="max-w-4xl mx-auto bg-white p-8 lg:p-12 my-6 print:my-0 print:shadow-none shadow-sm">
        {/* Document Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-shrink-0 flex items-start pt-1">
              <Logo width={80} height={80} />
            </div>

            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">BCKash Microfinance Bank</h1>
              <p className="text-xs text-gray-500 mt-1">15 Broad Street, Lagos Island, Lagos, Nigeria</p>
              <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800 mt-3">Customer Data Form</h2>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Form No: CDF-{customer.id.slice(-8)}</span>
                <span>Date Generated: {today}</span>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-center">
              {photoUrl ? (
                <img src={photoUrl} alt={fullName} className="w-[100px] h-[128px] object-cover border-2 border-gray-400" />
              ) : (
                <div className="w-[100px] h-[128px] border-2 border-dashed border-gray-400 flex items-center justify-center bg-gray-50">
                  <span className="text-[9px] text-gray-400 text-center px-1 leading-tight">
                    No Biometric
                    <br />
                    Photo Captured
                  </span>
                </div>
              )}
              <p className="text-[9px] text-gray-500 mt-1.5 font-medium uppercase tracking-wide">Passport Photograph</p>
            </div>
          </div>
        </div>

        {mismatchFlagged && (
          <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide">⚑ BVN Flagged — submitted details did not match the provider's record at onboarding</p>
          </div>
        )}

        {/* Section 1: Personal Information */}
        <SectionHeader title="Section 1 — Personal Information" />
        <div className="grid grid-cols-2">
          <FormField label="Full Name" value={fullName} />
          <FormField label="Customer ID" value={customer.id} />
          <FormField label="Phone Number" value={customer.phoneNumber} />
          <FormField label="Email Address" value={customer.email || ''} />
          <div className="col-span-2">
            <FormField label="Residential Address" value={customer.address || ''} />
          </div>
          <FormField label="Branch" value={branchName} />
          <FormField label="Status" value={CUSTOMER_STATUS_LABEL[customer.status]} />
          <FormField label="Date Joined" value={toDisplayDate(customer.createdAt)} />
        </div>

        {/* Section 2: Next of Kin */}
        <SectionHeader title="Section 2 — Next of Kin" />
        <div className="grid grid-cols-2">
          <FormField label="Full Name" value={customer.nextOfKin?.fullName || ''} />
          <FormField label="Phone Number" value={customer.nextOfKin?.phoneNumber || ''} />
          <FormField label="Relationship" value={customer.nextOfKin?.relationship || ''} />
          <FormField label="" value="" />
        </div>

        {/* Section 3+: Guarantors */}
        {customer.guarantors.map((g, idx) => (
          <Fragment key={idx}>
            <SectionHeader title={`Section ${idx + 3} — Guarantor ${idx + 1}`} />
            <div className="grid grid-cols-2">
              <FormField label="Full Name" value={g.fullName} />
              <FormField label="Phone Number" value={g.phoneNumber} />
              <div className="col-span-2">
                <FormField label="Address" value={g.address || ''} />
              </div>
              <FormField label="Relationship to Customer" value={g.relationship || ''} />
              <FormField label="Occupation" value={g.occupation || ''} />
            </div>
          </Fragment>
        ))}

        {/* Reference */}
        <SectionHeader title={`Section ${customer.guarantors.length + 3} — Reference Information`} />
        <div className="grid grid-cols-2">
          <FormField label="Full Name" value={customer.reference?.fullName || ''} />
          <FormField label="Phone Number" value={customer.reference?.phoneNumber || ''} />
          <div className="col-span-2">
            <FormField label="Address" value={customer.reference?.address || ''} />
          </div>
          <FormField label="Relationship" value={customer.reference?.relationship || ''} />
          <FormField label="Occupation" value={customer.reference?.occupation || ''} />
          <FormField label="Years Known" value={customer.reference?.yearsKnown || ''} />
        </div>

        {/* KYC Status */}
        <SectionHeader title={`Section ${customer.guarantors.length + 4} — KYC & Verification Status`} />
        <div className="grid grid-cols-2">
          <FormField label="BVN" value={bvnTail ?? (kycStatus?.bvnVerifiedAt ? 'Verified' : 'Not Verified')} />
          <FormField label="BVN Status" value={kycStatus?.bvnVerifiedAt ? `Verified ${toDisplayDate(kycStatus.bvnVerifiedAt)}` : 'Not Verified'} />
          <FormField label="NIN" value={ninTail ?? (kycStatus?.ninRecorded ? (kycStatus.ninVerified ? 'Verified' : 'Recorded') : 'Not Recorded')} />
          <FormField label="NIN Status" value={kycStatus?.ninRecorded ? (kycStatus.ninVerified ? 'Manually Verified' : 'Recorded, Unverified') : 'Not Recorded'} />
          <FormField label="Biometric Capture" value={kycStatus?.biometricCaptured ? 'Captured' : 'Not Captured'} />
          <FormField label="ID Document" value={kycStatus?.idDocumentCaptured ? `Captured (${kycStatus.idDocumentType ?? 'ID'})` : 'Not Captured'} />
        </div>

        {/* Group Membership */}
        <SectionHeader title={`Section ${customer.guarantors.length + 5} — Group Membership`} />
        <div className="grid grid-cols-2">
          <FormField label="Group Name" value={customerGroup?.group.name || 'Not a member of any group'} />
          <FormField label="Role in Group" value={customerGroup ? toTitleCase(customerGroup.role.replace(/_/g, ' ')) : ''} />
        </div>

        {/* Signature Section — exactly two, at opposite ends of the page */}
        <div className="mt-10 pt-6 border-t border-gray-300">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-6">Signatures & Authorization</p>
          <div className="flex justify-between gap-12">
            <div className="w-64">
              <div className="border-b border-gray-400 h-16"></div>
              <p className="text-xs text-gray-600 mt-2 font-medium">Customer Signature</p>
              <p className="text-[10px] text-gray-400 mt-1">Date: _______________</p>
            </div>
            <div className="w-64 text-right">
              <div className="border-b border-gray-400 h-16"></div>
              <p className="text-xs text-gray-600 mt-2 font-medium">Management Signature</p>
              <p className="text-[10px] text-gray-400 mt-1">Date: _______________</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-[10px] text-gray-400">
            This is a computer-generated document from BCKash MFB Portal, reflecting the customer's data as of the
            moment it was generated. Form CDF-{customer.id.slice(-8)} generated on {today}.
          </p>
        </div>
      </div>
    </div>
  );
}
