import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2Icon, LoaderIcon, XCircleIcon, XIcon } from 'lucide-react';
import { clientsApi, type BvnCheck } from '../api/clientsApi';

/**
 * "Verify now" for a client onboarded before BVN checks: looks up the BVN on file (or one typed in when they
 * have none) and checks it against the client's name and phone. A match is verified straight away; otherwise,
 * as at onboarding, choose whose details to keep — keeping the client's needs a reason and flags them high risk.
 */
export function VerifyBvnModal({
  clientId,
  bvnOnFile,
  onClose,
  onVerified,
}: {
  clientId: number;
  bvnOnFile: string | null;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [bvn, setBvn] = useState('');
  const [check, setCheck] = useState<BvnCheck | null>(null);
  const [source, setSource] = useState<'bvn' | 'client' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const needsBvn = !bvnOnFile;

  const verify = async (lookup: BvnCheck, detailsSource: 'bvn' | 'client' | null, overrideReason: string | null) => {
    await clientsApi.verifyExistingBvn(clientId, lookup.verificationId, detailsSource, overrideReason);
    toast.success(detailsSource === 'client' ? 'BVN verified. The client is flagged high risk until a super admin marks them safe.' : 'BVN verified.');
    onVerified();
    onClose();
  };

  const runCheck = async () => {
    setBusy(true);
    try {
      const lookup = await clientsApi.checkExistingBvn(clientId, needsBvn ? bvn : null);
      if (lookup.matches) {
        await verify(lookup, null, null);
      } else {
        setCheck(lookup);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The BVN could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!check || !source) return;
    setBusy(true);
    try {
      await verify(check, source, source === 'client' ? reason.trim() : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The BVN could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  const canCheck = !needsBvn || /^\d{11}$/.test(bvn);
  const canConfirm = !!source && (source === 'bvn' || reason.trim().length > 0);
  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <button onClick={onClose} disabled={busy} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <XIcon size={18} />
        </button>
        <h3 className="text-lg font-heading font-bold text-gray-900">Verify BVN</h3>

        {!check ? (
          <>
            <p className="text-sm font-body text-gray-500 mt-1 mb-4">
              {needsBvn
                ? "This client has no BVN on file. Enter it to check it against the client's name and phone."
                : `BVN ${bvnOnFile} will be checked against the client's name and phone.`}
            </p>
            {needsBvn && (
              <>
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">BVN</label>
                <input
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  inputMode="numeric"
                  placeholder="11 digits"
                  className={inputClass}
                />
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-body text-gray-500 mt-1 mb-4">The BVN record doesn't match the client's details. Choose whose details to keep.</p>
            <div className="overflow-hidden rounded-lg border border-gray-100 mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">On file</th>
                    <th className="px-3 py-2 font-medium">BVN record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {check.comparisons.map((c) => (
                    <tr key={c.field}>
                      <td className="px-3 py-2 text-gray-500">{c.field}</td>
                      <td className="px-3 py-2 text-gray-800">{c.given || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 ${c.matches ? 'text-emerald-700' : 'text-red-600'}`}>
                          {c.matches ? <CheckCircle2Icon size={13} /> : <XCircleIcon size={13} />}
                          {c.fromBvn || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="bvn-source" checked={source === 'bvn'} onChange={() => setSource('bvn')} className="mt-1" />
                <span>Use the BVN record's details — the client's name, phone and date of birth are updated to match it.</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="bvn-source" checked={source === 'client'} onChange={() => setSource('client')} className="mt-1" />
                <span>Keep the client's details — they're flagged high risk until a super admin marks them safe.</span>
              </label>
            </div>
            {source === 'client' && (
              <>
                <label className="block text-xs font-body font-medium text-gray-600 mt-4 mb-1.5">Reason for keeping the client's details</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void (check ? confirm() : runCheck())}
            disabled={busy || (check ? !canConfirm : !canCheck)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-heading font-bold rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <LoaderIcon size={14} className="animate-spin" />}
            {check ? 'Verify' : 'Check BVN'}
          </button>
        </div>
      </div>
    </div>
  );
}
