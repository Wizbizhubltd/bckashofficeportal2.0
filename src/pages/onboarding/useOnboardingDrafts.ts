import { useState } from 'react';
import { clientsApi } from '../../api/clientsApi';
import { applyEdit, detailsProblem, newDraft, type DraftClient } from './OnboardingParts';

/** The clients being onboarded, and running each one's BVN check against the provider. */
export function useOnboardingDrafts(initialCount: number) {
  const [drafts, setDrafts] = useState<DraftClient[]>(() => Array.from({ length: initialCount }, newDraft));

  const update = (key: string, change: (draft: DraftClient) => DraftClient) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? change(d) : d)));

  const edit = (key: string, changes: Parameters<typeof applyEdit>[1]) => update(key, (d) => applyEdit(d, changes));

  const verify = async (draft: DraftClient) => {
    if (detailsProblem(draft)) return;
    update(draft.key, (d) => ({ ...d, checking: true, checkError: null, serverError: null }));
    try {
      const check = await clientsApi.checkBvn(draft.bvn, draft.fullName.trim(), draft.phone || null);
      update(draft.key, (d) => ({ ...d, checking: false, check, source: check.matches ? null : d.source }));
    } catch (error) {
      update(draft.key, (d) => ({ ...d, checking: false, check: null, checkError: error instanceof Error ? error.message : 'The BVN could not be checked.' }));
    }
  };

  /** Checks every client not yet checked, one after another so the provider isn't hit all at once. */
  const verifyPending = async () => {
    for (const draft of drafts) {
      if (!draft.check && !draft.checking) {
        await verify(draft);
      }
    }
  };

  return {
    drafts,
    setDrafts,
    add: () => setDrafts((prev) => [...prev, newDraft()]),
    remove: (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key)),
    edit,
    verify,
    verifyPending,
    choose: (key: string, source: 'bvn' | 'client') => update(key, (d) => ({ ...d, source, serverError: null })),
    setReason: (key: string, reason: string) => update(key, (d) => ({ ...d, reason, serverError: null })),
    setServerErrors: (errors: Record<number, string>) =>
      setDrafts((prev) => prev.map((d, index) => ({ ...d, serverError: errors[index] ?? null }))),
  };
}
