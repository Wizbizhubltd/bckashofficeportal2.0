import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  ChevronLeftIcon,
  PlusIcon,
  Trash2Icon,
  FingerprintIcon,
  IdCardIcon,
  ShieldCheckIcon,
  Loader2Icon,
  CheckCircleIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  UsersIcon,
  UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import { customersService, type Customer, type IdDocumentType, type MismatchFlag } from '../../services/customers/customers.service';
import { groupsService, type Group } from '../../services/groups/groups.service';
import { BiometricCaptureModal } from '../customers/BiometricCaptureModal';
import { VerifyBvnModal } from './VerifyBvnModal';

const MIN_GROUP_MEMBERS = 3;

type OnboardingFlow = 'choice' | 'group' | 'single';

type MemberRow = {
  localId: string;
  fullName: string;
  phoneNumber: string;
  bvn: string;
  idType: IdDocumentType;
  customer: Customer | null;
  mismatchFlags: MismatchFlag[];
  biometricCaptured: boolean;
  idDocumentCaptured: boolean;
};

function makeEmptyRow(): MemberRow {
  return {
    localId: `member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: '',
    phoneNumber: '',
    bvn: '',
    idType: 'NIN',
    customer: null,
    mismatchFlags: [],
    biometricCaptured: false,
    idDocumentCaptured: false,
  };
}

const GROUP_STEPS = [
  { id: 1, title: 'Group Info' },
  { id: 2, title: 'Add Members' },
  { id: 3, title: 'KYC & Biometrics' },
  { id: 4, title: 'Review' },
];

const MEETING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Both a Manager and a Marketer land here first — Managers hold the same
 * initiateCapability(CUSTOMER)/(GROUP) as Marketers (see
 * default-role-capabilities.ts's own MAKER_ENTITY_TYPES comment), so this
 * page doesn't branch on role at all, only on which of the two flows below
 * the staff member picks.
 */
export function CustomerOnboarding() {
  const [flow, setFlow] = useState<OnboardingFlow>('choice');

  if (flow === 'group') {
    return <GroupOnboardingWizard onBack={() => setFlow('choice')} />;
  }
  if (flow === 'single') {
    return <SingleCustomerOnboardingWizard onBack={() => setFlow('choice')} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold text-primary">Customer / Group Onboarding</h2>
        <p className="text-gray-500 text-sm mt-1">Choose what you're registering today</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          onClick={() => setFlow('group')}
          className="text-left bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
            <UsersIcon size={24} />
          </div>
          <h3 className="text-lg font-heading font-bold text-gray-900">Group Onboarding</h3>
          <p className="text-sm text-gray-500 mt-1.5">
            Register a new borrowing group and its members — at least {MIN_GROUP_MEMBERS} members, each verified and captured.
          </p>
        </button>

        <button
          onClick={() => setFlow('single')}
          className="text-left bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-white transition-colors">
            <UserIcon size={24} />
          </div>
          <h3 className="text-lg font-heading font-bold text-gray-900">Single Customer Onboarding</h3>
          <p className="text-sm text-gray-500 mt-1.5">
            Register one customer on their own, then optionally propose adding them to one of your existing active groups.
          </p>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Group Onboarding — register a new group + at least MIN_GROUP_MEMBERS members
// =============================================================================

function GroupOnboardingWizard({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branches = useAppSelector((state) => state.lookups.branches);

  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingDay, setMeetingDay] = useState('Monday');
  const [expectedMemberCount, setExpectedMemberCount] = useState('');
  // Always the logged-in staff member's own branch — never a free choice.
  // See the no-branch guard below for staff with no branch assigned at all.
  const branchId = user?.branchId ?? '';
  const branchName = branches.find((b) => b.id === branchId)?.name ?? user?.branch ?? '';
  const [members, setMembers] = useState<MemberRow[]>([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);

  const [verifyingMemberId, setVerifyingMemberId] = useState<string | null>(null);
  const [biometricMemberId, setBiometricMemberId] = useState<string | null>(null);
  const [idDocumentMemberId, setIdDocumentMemberId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSummary, setCompletedSummary] = useState<{ submitted: number; failed: number } | null>(null);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const verifiedMembers = members.filter((m) => m.customer !== null);
  // Same "reached step 3" filter used to render the KYC list below — every
  // member with complete intake data must have their BVN verified before
  // moving on, not just at-least-3 of them.
  const eligibleMembers = members.filter((m) => m.fullName.trim() && m.bvn.trim().length === 11);
  const canLeaveStep2 = members.filter((m) => m.fullName.trim() && m.phoneNumber.trim() && m.bvn.trim().length === 11).length >= MIN_GROUP_MEMBERS;
  const canLeaveStep3 = eligibleMembers.length >= MIN_GROUP_MEMBERS && eligibleMembers.every((m) => m.customer !== null);
  // Facial biometric capture — not the ID document — is what disbursement
  // verification later compares the customer against, so every member
  // proposed into the group must have it before the group can be raised.
  const allBiometricsCaptured = eligibleMembers.length > 0 && eligibleMembers.every((m) => m.biometricCaptured);
  const canCompleteOnboarding =
    groupName.trim().length > 0 &&
    branchId.trim().length > 0 &&
    eligibleMembers.length >= MIN_GROUP_MEMBERS &&
    eligibleMembers.every((m) => m.customer !== null) &&
    allBiometricsCaptured;

  function nextStep() {
    if (step === 1 && !groupName.trim()) {
      showToast('Group name is required');
      return;
    }
    if (step === 2 && !canLeaveStep2) {
      showToast(`Fill in at least ${MIN_GROUP_MEMBERS} members with full name, phone, and an 11-digit BVN before continuing`);
      return;
    }
    if (step === 3 && !canLeaveStep3) {
      showToast(`Every member's BVN must be verified before continuing`);
      return;
    }
    setStep((prev) => Math.min(prev + 1, 4));
  }
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  function addMemberRow() {
    setMembers((prev) => [...prev, makeEmptyRow()]);
  }

  function removeMemberRow(localId: string) {
    setMembers((prev) => (prev.length <= MIN_GROUP_MEMBERS ? prev : prev.filter((m) => m.localId !== localId)));
  }

  function updateMemberField(localId: string, field: 'fullName' | 'phoneNumber' | 'bvn' | 'idType', value: string) {
    setMembers((prev) => prev.map((m) => (m.localId === localId ? { ...m, [field]: value } : m)));
  }

  function handleBvnVerified(localId: string, customer: Customer, mismatchFlags: MismatchFlag[]) {
    setMembers((prev) => prev.map((m) => (m.localId === localId ? { ...m, customer, mismatchFlags } : m)));
    if (mismatchFlags.length > 0) {
      showToast(`${customer.firstName} ${customer.lastName} — BVN verified, but flagged for review`);
    } else {
      showToast(`${customer.firstName} ${customer.lastName} — BVN verified`);
    }
  }

  async function handleBiometricUpload(localId: string, file: File) {
    const member = members.find((m) => m.localId === localId);
    if (!member?.customer) return;
    try {
      await customersService.captureBiometric(member.customer.id, file);
      setMembers((prev) => prev.map((m) => (m.localId === localId ? { ...m, biometricCaptured: true } : m)));
      showToast('Biometric capture uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload biometric capture');
      throw error;
    }
  }

  async function handleIdDocumentUpload(localId: string, file: File) {
    const member = members.find((m) => m.localId === localId);
    if (!member?.customer) return;
    try {
      await customersService.captureIdDocument(member.customer.id, file, member.idType);
      setMembers((prev) => prev.map((m) => (m.localId === localId ? { ...m, idDocumentCaptured: true } : m)));
      showToast('ID document uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload ID document');
      throw error;
    }
  }

  async function handleCompleteOnboarding() {
    if (!canCompleteOnboarding) {
      showToast(`A group name and at least ${MIN_GROUP_MEMBERS} members, all BVN-verified with facial capture uploaded, are required`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Best-effort: a member with a captured biometric gets submitted for
    // Admin/Approver review now; one without simply stays PENDING_APPROVAL
    // and un-submitted — nothing here blocks the group proposal itself,
    // since group membership has no KYC/approval gate on the backend.
    let submittedCount = 0;
    let failedCount = 0;
    for (const member of verifiedMembers) {
      if (!member.customer || !member.biometricCaptured) {
        continue;
      }
      try {
        await customersService.submitForApproval(member.customer.id);
        submittedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    try {
      await groupsService.create({
        name: groupName.trim(),
        branchId,
        proposedMemberCustomerIds: verifiedMembers.map((m) => m.customer!.id),
        proposedLeaderName: leaderName.trim() || undefined,
        meetingDay: meetingDay || undefined,
        meetingLocation: meetingLocation.trim() || undefined,
        expectedMemberCount: expectedMemberCount ? Number(expectedMemberCount) : undefined,
      });
      setCompletedSummary({ submitted: submittedCount, failed: failedCount });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to propose the group');
    } finally {
      setIsSubmitting(false);
    }
  }

  const biometricMember = members.find((m) => m.localId === biometricMemberId);
  const idDocumentMember = members.find((m) => m.localId === idDocumentMemberId);
  const verifyingMember = members.find((m) => m.localId === verifyingMemberId);
  const totalMismatchFlags = verifiedMembers.reduce((sum, m) => sum + m.mismatchFlags.length, 0);

  if (completedSummary) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2Icon size={32} />
          </div>
          <h3 className="text-xl font-heading font-bold text-primary">Group Proposed Successfully</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            "{groupName}" has been proposed with {verifiedMembers.length} members and is now awaiting approval.
            {completedSummary.submitted > 0 && ` ${completedSummary.submitted} member(s) were also submitted for KYC approval.`}
            {completedSummary.failed > 0 && ` ${completedSummary.failed} member(s) could not be submitted for approval — complete their biometric capture and submit from their profile.`}
          </p>
          <button
            onClick={() => navigate('/customers')}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-heading font-bold hover:bg-primary/90 transition-colors"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircleIcon size={32} />
          </div>
          <h3 className="text-xl font-heading font-bold text-primary">No Branch Assigned</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Your account isn't assigned to a branch, so you can't onboard customers or groups. Contact an Admin/SuperAdmin to have a branch assigned to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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

      {verifyingMember && (
        <VerifyBvnModal
          isOpen={verifyingMemberId !== null}
          onClose={() => setVerifyingMemberId(null)}
          branchId={branchId}
          initialBvn={verifyingMember.bvn}
          submittedFullName={verifyingMember.fullName}
          submittedPhoneNumber={verifyingMember.phoneNumber}
          onVerified={(customer, mismatchFlags) => handleBvnVerified(verifyingMember.localId, customer, mismatchFlags)}
          onError={(message) => showToast(message)}
        />
      )}

      {biometricMember && (
        <BiometricCaptureModal
          isOpen={biometricMemberId !== null}
          onClose={() => setBiometricMemberId(null)}
          onUpload={(file) => handleBiometricUpload(biometricMember.localId, file)}
          mode="webcam"
          subjectName={biometricMember.fullName}
          hint="Have the member look at the camera — this is what disbursement verification later compares them against."
        />
      )}

      {idDocumentMember && (
        <BiometricCaptureModal
          isOpen={idDocumentMemberId !== null}
          onClose={() => setIdDocumentMemberId(null)}
          onUpload={(file) => handleIdDocumentUpload(idDocumentMember.localId, file)}
          title={`ID Document Capture — ${idDocumentMember.idType === 'NIN' ? 'NIN Slip' : "Voter's Card"}`}
          hint="A photo of the document selected in the ID Type column for this member."
        />
      )}

      <div className="flex justify-between items-end mb-8">
        <div>
          <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-primary transition-colors mb-2">
            <ChevronLeftIcon size={16} className="mr-1" /> Change onboarding type
          </button>
          <h2 className="text-2xl font-heading font-bold text-primary">Group Onboarding</h2>
          <p className="text-gray-500 text-sm mt-1">Register a new borrowing group and its members</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          ></div>
          {GROUP_STEPS.map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s.id ? <CheckCircle2Icon size={16} /> : s.id}
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= s.id ? 'text-primary' : 'text-gray-400'}`}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">Group Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Iya Oloja Market Women"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Leader Name</label>
                  <input
                    type="text"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="e.g. Alhaja Aminat"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market / Location</label>
                  <input
                    type="text"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    placeholder="e.g. Oshodi Market"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Number of Members</label>
                  <input
                    type="number"
                    min={1}
                    value={expectedMemberCount}
                    onChange={(e) => setExpectedMemberCount(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Day</label>
                  <select
                    value={meetingDay}
                    onChange={(e) => setMeetingDay(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    {MEETING_DAYS.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-body">
                "Group Leader Name" is a note for your own reference — actual leadership (Group Head / Assistant / Coordinator) is assigned automatically from the first three verified members, in the order they're added below.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-heading font-bold text-primary">Add Group Members</h3>
                <button onClick={addMemberRow} className="flex items-center text-sm text-accent font-medium hover:text-[#e64a19]">
                  <PlusIcon size={16} className="mr-1" /> Add Member
                </button>
              </div>
              <p className="text-xs text-gray-400 font-body">A group needs at least {MIN_GROUP_MEMBERS} members. Full Name/Phone Number are what you submit against the BVN provider in the next step — a mismatch gets flagged for the approver, it won't silently overwrite what you typed.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                      <th className="px-4 py-3 font-medium">Full Name</th>
                      <th className="px-4 py-3 font-medium">Phone Number</th>
                      <th className="px-4 py-3 font-medium">BVN</th>
                      <th className="px-4 py-3 font-medium">ID Type</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {members.map((member) => (
                      <tr key={member.localId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={member.fullName}
                            onChange={(e) => updateMemberField(member.localId, 'fullName', e.target.value)}
                            placeholder="Full name"
                            disabled={member.customer !== null}
                            className="w-full bg-transparent border-b border-gray-200 focus:border-primary outline-none disabled:text-gray-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={member.phoneNumber}
                            onChange={(e) => updateMemberField(member.localId, 'phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="08012345678"
                            disabled={member.customer !== null}
                            className="w-full bg-transparent border-b border-gray-200 focus:border-primary outline-none disabled:text-gray-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={member.bvn}
                            onChange={(e) => updateMemberField(member.localId, 'bvn', e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="11-digit BVN"
                            disabled={member.customer !== null}
                            className="w-full bg-transparent border-b border-gray-200 focus:border-primary outline-none disabled:text-gray-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={member.idType}
                            onChange={(e) => updateMemberField(member.localId, 'idType', e.target.value)}
                            disabled={member.customer !== null}
                            className="w-full bg-transparent border-b border-gray-200 focus:border-primary outline-none disabled:text-gray-400"
                          >
                            <option value="NIN">NIN</option>
                            <option value="VOTERS_CARD">Voter's Card</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeMemberRow(member.localId)}
                            disabled={members.length <= MIN_GROUP_MEMBERS || member.customer !== null}
                            className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                          >
                            <Trash2Icon size={14} /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">KYC &amp; Biometric Verification</h3>
              <p className="text-sm text-gray-500">Verify each member's BVN, then capture their ID document and facial biometric.</p>

              <div className="space-y-4 mt-4">
                {members.filter((m) => m.fullName.trim() && m.bvn.trim().length === 11).map((member) => (
                  <div key={member.localId} className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="font-heading font-bold text-primary">{member.fullName}</p>
                      <p className="text-xs text-gray-500">{member.customer?.phoneNumber ?? member.phoneNumber ?? '-'}</p>
                      {member.mismatchFlags.length > 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                          <AlertTriangleIcon size={12} /> Flagged for review ({member.mismatchFlags.length})
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!member.customer ? (
                        <button
                          onClick={() => setVerifyingMemberId(member.localId)}
                          className="flex items-center px-3 py-1 rounded border text-xs font-medium bg-white text-primary border-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                        >
                          <ShieldCheckIcon size={14} className="mr-1" /> Verify BVN
                        </button>
                      ) : (
                        <>
                          <div className={`flex items-center px-3 py-1 rounded border text-xs font-medium ${member.mismatchFlags.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            <ShieldCheckIcon size={14} className="mr-1" /> BVN: {member.mismatchFlags.length > 0 ? 'Flagged' : 'Verified'}
                          </div>
                          <button
                            onClick={() => setIdDocumentMemberId(member.localId)}
                            className={`flex items-center px-3 py-1 rounded border text-xs font-medium transition-colors ${member.idDocumentCaptured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-primary border-primary hover:bg-primary hover:text-white cursor-pointer'}`}
                          >
                            <IdCardIcon size={14} className="mr-1" /> ID ({member.idType === 'NIN' ? 'NIN' : "Voter's Card"}): {member.idDocumentCaptured ? 'Captured' : 'Pending'}
                          </button>
                          <button
                            onClick={() => setBiometricMemberId(member.localId)}
                            className={`flex items-center px-3 py-1 rounded border text-xs font-medium transition-colors ${member.biometricCaptured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-primary border-primary hover:bg-primary hover:text-white cursor-pointer'}`}
                          >
                            <FingerprintIcon size={14} className="mr-1" /> Facial Capture: {member.biometricCaptured ? 'Captured' : 'Pending'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2Icon size={32} />
                </div>
                <h3 className="text-xl font-heading font-bold text-primary mb-2">Review &amp; Submit</h3>
                <p className="text-gray-500 max-w-md mx-auto text-sm">
                  Proposing this group requires approval from a different Admin/SuperAdmin/Approver before it becomes active.
                </p>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-700">
                  <AlertCircleIcon size={16} /> {submitError}
                </div>
              )}

              {totalMismatchFlags > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
                  <AlertTriangleIcon size={16} /> {totalMismatchFlags} mismatch flag(s) across the verified members — visible to whoever approves them, no action needed here.
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                <p className="font-medium text-gray-700 mb-2">Group Summary:</p>
                <ul className="space-y-2 text-gray-600">
                  <li><span className="font-medium">Group Name:</span> {groupName || '—'}</li>
                  <li><span className="font-medium">Leader:</span> {leaderName || '—'}</li>
                  <li><span className="font-medium">Market / Location:</span> {meetingLocation || '—'}</li>
                  <li><span className="font-medium">Meeting Day:</span> {meetingDay}</li>
                  <li><span className="font-medium">Branch:</span> {branchName || '—'}</li>
                  <li>
                    <span className="font-medium">Total Members:</span> {verifiedMembers.length} verified
                    {expectedMemberCount && ` (expected ${expectedMemberCount})`}
                  </li>
                  <li>
                    <span className="font-medium">Biometric Captured:</span>{' '}
                    {verifiedMembers.filter((m) => m.biometricCaptured).length} of {verifiedMembers.length}
                  </li>
                </ul>
                {!canCompleteOnboarding && (
                  <p className="text-xs text-amber-600 mt-3">
                    A group name and at least {MIN_GROUP_MEMBERS} members, all BVN-verified, are required
                    {!allBiometricsCaptured && ' — every member must also have their facial capture uploaded'}.
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={nextStep}
              className="flex items-center px-6 py-2 bg-primary text-white rounded-lg hover:bg-[#123e31] font-medium transition-colors shadow-sm"
            >
              Continue <ChevronRightIcon size={18} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={() => void handleCompleteOnboarding()}
              disabled={isSubmitting || !canCompleteOnboarding}
              className="flex items-center px-8 py-2 bg-accent text-white rounded-lg hover:bg-[#e64a19] font-heading font-bold transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2Icon size={16} className="animate-spin mr-2" />}
              Complete Onboarding
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Single Customer Onboarding — one customer, optionally proposed into an
// existing active group afterward (see GroupsService.initiateMemberAddition's
// own doc comment on the backend — this is exactly the same "propose a
// member addition" mechanic BranchDetail/GroupDetail already expose, just
// reachable from here too for a customer who was just onboarded standalone).
// =============================================================================

const SINGLE_STEPS = [
  { id: 1, title: 'Customer Info' },
  { id: 2, title: 'KYC & Biometrics' },
  { id: 3, title: 'Review' },
];

function SingleCustomerOnboardingWizard({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branchId = user?.branchId ?? '';

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bvn, setBvn] = useState('');
  const [idType, setIdType] = useState<IdDocumentType>('NIN');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [mismatchFlags, setMismatchFlags] = useState<MismatchFlag[]>([]);
  const [biometricCaptured, setBiometricCaptured] = useState(false);
  const [idDocumentCaptured, setIdDocumentCaptured] = useState(false);

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [idDocumentModalOpen, setIdDocumentModalOpen] = useState(false);

  // Every active group this staff member can see (row-scoped server-side —
  // a Manager sees their whole branch's, a Marketer only groups they
  // themselves created — see GroupsService.findAllForActor's own doc
  // comment). Fetched once branchId is known; a Marketer with none yet just
  // sees an empty dropdown and can still onboard the customer standalone.
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSummary, setCompletedSummary] = useState<{
    submittedForApproval: boolean;
    groupName: string | null;
    groupAddError: string | null;
  } | null>(null);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  useEffect(() => {
    if (!branchId || step !== 3) return;
    let isMounted = true;
    setIsLoadingGroups(true);
    groupsService
      .list()
      .then((items) => {
        if (isMounted) setGroups(items);
      })
      .catch(() => {
        if (isMounted) setGroups([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingGroups(false);
      });
    return () => {
      isMounted = false;
    };
  }, [branchId, step]);

  const canLeaveStep1 = fullName.trim().length > 0 && phoneNumber.trim().length > 0 && bvn.trim().length === 11;
  // Same "facial capture is required before completion" rule as the group flow.
  const canCompleteOnboarding = customer !== null && biometricCaptured;

  function nextStep() {
    if (step === 1 && !canLeaveStep1) {
      showToast('Full name, phone number, and an 11-digit BVN are required before continuing');
      return;
    }
    if (step === 2 && !customer) {
      showToast(`The customer's BVN must be verified before continuing`);
      return;
    }
    setStep((prev) => Math.min(prev + 1, 3));
  }
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  function handleBvnVerified(verifiedCustomer: Customer, flags: MismatchFlag[]) {
    setCustomer(verifiedCustomer);
    setMismatchFlags(flags);
    if (flags.length > 0) {
      showToast(`${verifiedCustomer.firstName} ${verifiedCustomer.lastName} — BVN verified, but flagged for review`);
    } else {
      showToast(`${verifiedCustomer.firstName} ${verifiedCustomer.lastName} — BVN verified`);
    }
  }

  async function handleBiometricUpload(file: File) {
    if (!customer) return;
    try {
      await customersService.captureBiometric(customer.id, file);
      setBiometricCaptured(true);
      showToast('Biometric capture uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload biometric capture');
      throw error;
    }
  }

  async function handleIdDocumentUpload(file: File) {
    if (!customer) return;
    try {
      await customersService.captureIdDocument(customer.id, file, idType);
      setIdDocumentCaptured(true);
      showToast('ID document uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload ID document');
      throw error;
    }
  }

  async function handleCompleteOnboarding() {
    if (!customer || !canCompleteOnboarding) {
      showToast('The customer must be BVN-verified with facial capture uploaded before completing');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    let submittedForApproval = false;
    try {
      await customersService.submitForApproval(customer.id);
      submittedForApproval = true;
    } catch {
      // Same best-effort story as the group flow — the customer record
      // itself already exists either way; submitting for approval can
      // always be retried later from their profile.
    }

    let groupAddError: string | null = null;
    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    if (selectedGroup) {
      try {
        await groupsService.addMember(selectedGroup.id, { customerId: customer.id });
      } catch (error) {
        groupAddError = error instanceof Error ? error.message : 'Failed to propose adding this customer to the group';
      }
    }

    setCompletedSummary({
      submittedForApproval,
      groupName: selectedGroup?.name ?? null,
      groupAddError,
    });
    setIsSubmitting(false);
  }

  if (completedSummary) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2Icon size={32} />
          </div>
          <h3 className="text-xl font-heading font-bold text-primary">Customer Onboarded Successfully</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            "{fullName}" has been registered.
            {completedSummary.submittedForApproval
              ? ' They have been submitted for KYC approval.'
              : ' They could not be submitted for approval — complete this from their profile.'}
            {completedSummary.groupName &&
              !completedSummary.groupAddError &&
              ` A request to add them to "${completedSummary.groupName}" has been proposed — it still needs both a reviewer/approver's sign-off and the customer's own KYC approval before they actually join.`}
          </p>
          {completedSummary.groupAddError && (
            <p className="text-sm text-red-600 max-w-md mx-auto">
              Could not propose adding them to "{completedSummary.groupName}": {completedSummary.groupAddError}. You can try again from the group's own page.
            </p>
          )}
          <button
            onClick={() => navigate('/customers')}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-heading font-bold hover:bg-primary/90 transition-colors"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircleIcon size={32} />
          </div>
          <h3 className="text-xl font-heading font-bold text-primary">No Branch Assigned</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Your account isn't assigned to a branch, so you can't onboard customers. Contact an Admin/SuperAdmin to have a branch assigned to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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

      <VerifyBvnModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        branchId={branchId}
        initialBvn={bvn}
        submittedFullName={fullName}
        submittedPhoneNumber={phoneNumber}
        onVerified={(verifiedCustomer, flags) => handleBvnVerified(verifiedCustomer, flags)}
        onError={(message) => showToast(message)}
      />

      <BiometricCaptureModal
        isOpen={biometricModalOpen}
        onClose={() => setBiometricModalOpen(false)}
        onUpload={handleBiometricUpload}
        mode="webcam"
        subjectName={fullName}
        hint="Have the customer look at the camera — this is what disbursement verification later compares them against."
      />

      <BiometricCaptureModal
        isOpen={idDocumentModalOpen}
        onClose={() => setIdDocumentModalOpen(false)}
        onUpload={handleIdDocumentUpload}
        title={`ID Document Capture — ${idType === 'NIN' ? 'NIN Slip' : "Voter's Card"}`}
        hint="A photo of the document selected below."
      />

      <div>
        <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-primary transition-colors mb-2">
          <ChevronLeftIcon size={16} className="mr-1" /> Change onboarding type
        </button>
        <h2 className="text-2xl font-heading font-bold text-primary">Single Customer Onboarding</h2>
        <p className="text-gray-500 text-sm mt-1">Register one customer, then optionally propose adding them to an existing group</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          ></div>
          {SINGLE_STEPS.map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s.id ? <CheckCircle2Icon size={16} /> : s.id}
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= s.id ? 'text-primary' : 'text-gray-400'}`}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={customer !== null}
                    placeholder="e.g. Aminat Yusuf"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    disabled={customer !== null}
                    placeholder="08012345678"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BVN</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bvn}
                    onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    disabled={customer !== null}
                    placeholder="11-digit BVN"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as IdDocumentType)}
                    disabled={customer !== null}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="NIN">NIN</option>
                    <option value="VOTERS_CARD">Voter's Card</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-body">
                Full Name/Phone Number are what you submit against the BVN provider in the next step — a mismatch gets flagged for the approver, it won't silently overwrite what you typed.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">KYC &amp; Biometric Verification</h3>
              <p className="text-sm text-gray-500">Verify the customer's BVN, then capture their ID document and facial biometric.</p>

              <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="font-heading font-bold text-primary">{fullName}</p>
                  <p className="text-xs text-gray-500">{customer?.phoneNumber ?? phoneNumber ?? '-'}</p>
                  {mismatchFlags.length > 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangleIcon size={12} /> Flagged for review ({mismatchFlags.length})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!customer ? (
                    <button
                      onClick={() => setVerifyModalOpen(true)}
                      className="flex items-center px-3 py-1 rounded border text-xs font-medium bg-white text-primary border-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                    >
                      <ShieldCheckIcon size={14} className="mr-1" /> Verify BVN
                    </button>
                  ) : (
                    <>
                      <div className={`flex items-center px-3 py-1 rounded border text-xs font-medium ${mismatchFlags.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        <ShieldCheckIcon size={14} className="mr-1" /> BVN: {mismatchFlags.length > 0 ? 'Flagged' : 'Verified'}
                      </div>
                      <button
                        onClick={() => setIdDocumentModalOpen(true)}
                        className={`flex items-center px-3 py-1 rounded border text-xs font-medium transition-colors ${idDocumentCaptured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-primary border-primary hover:bg-primary hover:text-white cursor-pointer'}`}
                      >
                        <IdCardIcon size={14} className="mr-1" /> ID ({idType === 'NIN' ? 'NIN' : "Voter's Card"}): {idDocumentCaptured ? 'Captured' : 'Pending'}
                      </button>
                      <button
                        onClick={() => setBiometricModalOpen(true)}
                        className={`flex items-center px-3 py-1 rounded border text-xs font-medium transition-colors ${biometricCaptured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-primary border-primary hover:bg-primary hover:text-white cursor-pointer'}`}
                      >
                        <FingerprintIcon size={14} className="mr-1" /> Facial Capture: {biometricCaptured ? 'Captured' : 'Pending'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2Icon size={32} />
                </div>
                <h3 className="text-xl font-heading font-bold text-primary mb-2">Review &amp; Submit</h3>
                <p className="text-gray-500 max-w-md mx-auto text-sm">
                  The customer record is created as soon as their BVN is verified — this step just submits them for KYC approval and (optionally) proposes adding them to a group.
                </p>
              </div>

              {mismatchFlags.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
                  <AlertTriangleIcon size={16} /> {mismatchFlags.length} mismatch flag(s) — visible to whoever approves this customer, no action needed here.
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                <p className="font-medium text-gray-700 mb-2">Customer Summary:</p>
                <ul className="space-y-2 text-gray-600">
                  <li><span className="font-medium">Full Name:</span> {fullName || '—'}</li>
                  <li><span className="font-medium">Phone Number:</span> {customer?.phoneNumber ?? phoneNumber ?? '—'}</li>
                  <li><span className="font-medium">BVN Verified:</span> {customer ? 'Yes' : 'No'}</li>
                  <li><span className="font-medium">Facial Capture:</span> {biometricCaptured ? 'Captured' : 'Pending'}</li>
                </ul>
                {!canCompleteOnboarding && (
                  <p className="text-xs text-amber-600 mt-3">
                    The customer must be BVN-verified with facial capture uploaded before completing.
                  </p>
                )}
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1">Add to an Existing Group (optional)</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  disabled={isLoadingGroups}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white disabled:bg-gray-50"
                >
                  <option value="">— None, onboard as standalone —</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 font-body mt-2">
                  {isLoadingGroups
                    ? 'Loading your active groups...'
                    : groups.length === 0
                      ? "You don't have any active groups yet — you can add this customer to one later from the group's own page."
                      : "This proposes the addition — it still needs a reviewer/approver's sign-off, and the customer's own KYC approval, before they actually join."}
                </p>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-700">
                  <AlertCircleIcon size={16} /> {submitError}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={nextStep}
              className="flex items-center px-6 py-2 bg-primary text-white rounded-lg hover:bg-[#123e31] font-medium transition-colors shadow-sm"
            >
              Continue <ChevronRightIcon size={18} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={() => void handleCompleteOnboarding()}
              disabled={isSubmitting || !canCompleteOnboarding}
              className="flex items-center px-8 py-2 bg-accent text-white rounded-lg hover:bg-[#e64a19] font-heading font-bold transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2Icon size={16} className="animate-spin mr-2" />}
              Complete Onboarding
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
