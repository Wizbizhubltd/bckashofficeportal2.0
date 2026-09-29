import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, ArrowRightIcon, LoaderIcon, PlusIcon, UsersRoundIcon } from 'lucide-react';
import { clientsApi, onboardingErrors, GROUP_ROLE_LABELS } from '../../api/clientsApi';
import { useRolePath } from '../../hooks/useRolePath';
import { useScopedOffices } from '../../hooks/useScopedOffices';
import { BvnVerificationCard, ClientDetailsFields, Stepper, detailsProblem, isReady, toInput } from './OnboardingParts';
import { useOnboardingDrafts } from './useOnboardingDrafts';
import { OfficeField } from './OfficeField';

const MIN_MEMBERS = 3;
const STEPS = ['Group details', 'Client details', 'Verification'];
const ROLES = ['leader', 'assistant', 'organizer'];

const roleFor = (index: number) => GROUP_ROLE_LABELS[ROLES[index] ?? 'member'];

/**
 * Group onboarding, for managers and marketers: the group's details, then its clients (at least
 * three — the first three are its leader, assistant and organizer), then each client's BVN verified.
 */
export function GroupOnboardingPage() {
  const navigate = useNavigate();
  const rolePath = useRolePath();
  const offices = useScopedOffices();
  const clients = useOnboardingDrafts(MIN_MEMBERS);
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [group, setGroup] = useState({ name: '', phone: '', email: '', address: '', officeId: '' });

  useEffect(() => {
    if (offices.length === 1) setGroup((prev) => ({ ...prev, officeId: String(offices[0].id) }));
  }, [offices]);

  // Entering the verification step checks every client not yet checked.
  useEffect(() => {
    if (step === 2) void clients.verifyPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const groupProblem = !group.name.trim() ? 'The group needs a name.' : offices.length > 1 && !group.officeId ? 'Choose the office the group joins.' : null;
  const detailsOk = clients.drafts.length >= MIN_MEMBERS && clients.drafts.every((d) => !detailsProblem(d));
  const duplicateBvn = new Set(clients.drafts.map((d) => d.bvn)).size !== clients.drafts.length;
  const allReady = clients.drafts.every(isReady);

  const next = () => {
    setAttempted(true);
    if (step === 0 && groupProblem) return;
    if (step === 1 && (!detailsOk || duplicateBvn)) {
      if (duplicateBvn) toast.error('Each client needs their own BVN.');
      return;
    }
    setAttempted(false);
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await clientsApi.onboardGroup(
        group.officeId ? Number(group.officeId) : null,
        { name: group.name.trim(), phone: group.phone || null, email: group.email.trim() || null, address: group.address.trim() || null },
        clients.drafts.map(toInput),
      );
      const flagged = result.clients.filter((c) => c.isHighRisk).length;
      toast.success(
        `${group.name.trim()} onboarded with ${result.clients.length} clients${flagged ? ` — ${flagged} flagged high risk` : ''}. They're awaiting a controller's approval.`,
      );
      navigate(rolePath(`/groups/${result.groupId}`));
    } catch (error) {
      const errors = onboardingErrors(error);
      const perClient: Record<number, string> = {};
      Object.entries(errors).forEach(([key, message]) => {
        const match = /^members\[(\d+)\]$/.exec(key);
        if (match) perClient[Number(match[1])] = message;
      });
      clients.setServerErrors(perClient);
      toast.error(error instanceof Error ? error.message : 'The group could not be onboarded.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UsersRoundIcon size={20} />
        </span>
        <div>
          <h1 className="font-heading text-xl font-bold text-primary">Onboard a group</h1>
          <p className="text-sm text-gray-500">At least {MIN_MEMBERS} clients. The first three are the group's leader, assistant and organizer.</p>
        </div>
      </div>

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-6">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-gray-600">
              Group name <span className="text-red-500">*</span>
            </span>
            <input className={inputClass} value={group.name} onChange={(e) => setGroup({ ...group, name: e.target.value })} placeholder="e.g. Unity Market Traders" />
          </label>
          <OfficeField offices={offices} value={group.officeId} onChange={(officeId) => setGroup({ ...group, officeId })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-gray-600">Group phone</span>
              <input className={inputClass} inputMode="numeric" maxLength={11} value={group.phone} onChange={(e) => setGroup({ ...group, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="08031234567" />
            </label>
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-gray-600">Group email</span>
              <input className={inputClass} type="email" value={group.email} onChange={(e) => setGroup({ ...group, email: e.target.value })} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-gray-600">Meeting address</span>
            <textarea className={inputClass} rows={2} value={group.address} onChange={(e) => setGroup({ ...group, address: e.target.value })} />
          </label>
          {attempted && groupProblem && <p className="text-sm text-red-600">{groupProblem}</p>}
        </section>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {clients.drafts.map((draft, index) => (
            <ClientDetailsFields
              key={draft.key}
              draft={draft}
              heading={`Client ${index + 1}`}
              badge={roleFor(index)}
              showProblem={attempted}
              onChange={(changes) => clients.edit(draft.key, changes)}
              onRemove={clients.drafts.length > MIN_MEMBERS ? () => clients.remove(draft.key) : undefined}
            />
          ))}
          <button
            type="button"
            onClick={clients.add}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500 hover:border-primary/40 hover:text-primary"
          >
            <PlusIcon size={16} />
            Add another client
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Each client's BVN is checked with the verification provider. Where the BVN record differs from what you entered, choose whose details to keep.
          </p>
          {clients.drafts.map((draft, index) => (
            <BvnVerificationCard
              key={draft.key}
              draft={draft}
              heading={`Client ${index + 1}`}
              badge={roleFor(index)}
              onRetry={() => void clients.verify(draft)}
              onChoose={(source) => clients.choose(draft.key, source)}
              onReason={(reason) => clients.setReason(draft.key, reason)}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate(rolePath('/groups')) : setStep((s) => s - 1))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-heading font-bold text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeftIcon size={16} />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < 2 ? (
          <button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-heading font-bold text-white hover:bg-primary/90">
            Continue
            <ArrowRightIcon size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!allReady || submitting}
            title={allReady ? undefined : 'Every client needs a verified BVN, and a choice where their details differ.'}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-heading font-bold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting && <LoaderIcon size={16} className="animate-spin" />}
            Onboard group ({clients.drafts.length} clients)
          </button>
        )}
      </div>
    </div>
  );
}
