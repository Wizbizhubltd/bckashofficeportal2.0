import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, ArrowRightIcon, LoaderIcon, UserPlusIcon } from 'lucide-react';
import { clientsApi, onboardingErrors } from '../../api/clientsApi';
import { useRolePath } from '../../hooks/useRolePath';
import { useScopedOffices } from '../../hooks/useScopedOffices';
import { BvnVerificationCard, ClientDetailsFields, Stepper, detailsProblem, isReady, toInput } from './OnboardingParts';
import { useOnboardingDrafts } from './useOnboardingDrafts';
import { OfficeField } from './OfficeField';

const STEPS = ['Client details', 'Verification'];

/** Single-client onboarding, for managers and marketers: the client's details, then their BVN verified. */
export function SingleOnboardingPage() {
  const navigate = useNavigate();
  const rolePath = useRolePath();
  const offices = useScopedOffices();
  const clients = useOnboardingDrafts(1);
  const draft = clients.drafts[0];
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [officeId, setOfficeId] = useState('');

  useEffect(() => {
    if (offices.length === 1) setOfficeId(String(offices[0].id));
  }, [offices]);

  useEffect(() => {
    if (step === 1) void clients.verifyPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const officeMissing = offices.length > 1 && !officeId;

  const next = () => {
    setAttempted(true);
    if (detailsProblem(draft) || officeMissing) return;
    setAttempted(false);
    setStep(1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await clientsApi.onboardClient(officeId ? Number(officeId) : null, toInput(draft));
      const client = result.clients[0];
      toast.success(
        client.isHighRisk
          ? `${client.displayName} onboarded and flagged high risk until a super admin marks them safe.`
          : `${client.displayName} onboarded — awaiting a controller's approval.`,
      );
      navigate(rolePath(`/clients/${client.id}`));
    } catch (error) {
      const errors = onboardingErrors(error);
      clients.setServerErrors(errors['members[0]'] ? { 0: errors['members[0]'] } : {});
      toast.error(error instanceof Error ? error.message : 'The client could not be onboarded.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlusIcon size={20} />
        </span>
        <div>
          <h1 className="font-heading text-xl font-bold text-primary">Onboard a client</h1>
          <p className="text-sm text-gray-500">Their BVN is verified before they're added. You'll add documents from their client page afterwards.</p>
        </div>
      </div>

      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-4">
          <OfficeField offices={offices} value={officeId} onChange={setOfficeId} error={attempted && officeMissing ? 'Choose the office the client joins.' : undefined} />
          <ClientDetailsFields draft={draft} heading="Client details" showProblem={attempted} onChange={(changes) => clients.edit(draft.key, changes)} />
        </div>
      )}

      {step === 1 && (
        <BvnVerificationCard
          draft={draft}
          heading="BVN verification"
          onRetry={() => void clients.verify(draft)}
          onChoose={(source) => clients.choose(draft.key, source)}
          onReason={(reason) => clients.setReason(draft.key, reason)}
        />
      )}

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate(rolePath('/clients')) : setStep(0))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-heading font-bold text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeftIcon size={16} />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step === 0 ? (
          <button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-heading font-bold text-white hover:bg-primary/90">
            Continue
            <ArrowRightIcon size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!isReady(draft) || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-heading font-bold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting && <LoaderIcon size={16} className="animate-spin" />}
            Onboard client
          </button>
        )}
      </div>
    </div>
  );
}
