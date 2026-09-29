import { useEffect, useState } from 'react';
import { CheckCircle2Icon, RefreshCwIcon, ScanFaceIcon, ShieldAlertIcon, XCircleIcon } from 'lucide-react';
import { biometricsApi, type LoanFaceCheck } from '../../../../api/clientsApi';
import { FaceCaptureModal } from '../../../../components/FaceCaptureModal';

/**
 * Before a loan is disbursed, everyone receiving money must pass a live face capture that matches
 * their enrolled face. A failed match never counts — the client shows "No face match" with a
 * recapture button until they pass. Reports back whether everyone has, so the page can enable disbursement.
 */
export function FaceChecksPanel({ loanId, onChange }: { loanId: number; onChange: (allVerified: boolean) => void }) {
  const [checks, setChecks] = useState<LoanFaceCheck[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [capturing, setCapturing] = useState<LoanFaceCheck | null>(null);

  const load = () =>
    biometricsApi
      .loanChecks(loanId)
      .then((result) => {
        setChecks(result);
        // Face capture switched off in the control portal: the match is optional, so it never holds up disbursement.
        onChange(result.every((c) => c.verified || !c.required));
      })
      .catch(() => {
        setFailed(true);
        onChange(false);
      });

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  if (failed) return <p className="mb-6 text-sm text-red-600">Couldn't load the face checks for this loan.</p>;
  if (!checks || checks.length === 0) return null;

  const done = checks.filter((c) => c.verified).length;
  const required = checks.some((c) => c.required);

  return (
    <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-sm font-bold text-gray-800">Face match before disbursement{required ? '' : ' (optional)'}</h2>
          <p className="text-xs text-gray-500">
            {required
              ? 'Each client receiving money takes a live face capture, matched against their enrolled face.'
              : 'Face capture isn’t mandatory, so the loan can be disbursed without it — you can still run the match.'}{' '}
            {done} of {checks.length} done.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {checks.map((check) => (
          <li key={check.clientId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{check.clientName ?? `Client #${check.clientId}`}</p>
              {check.verified ? (
                <p className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2Icon size={12} /> Matched {check.similarity?.toFixed(1)}%
                </p>
              ) : !check.enrolled ? (
                <p className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <ShieldAlertIcon size={12} /> No enrolled face — whoever onboarded them must capture it first
                </p>
              ) : check.lastFailedAt ? (
                <p className="max-w-md text-xs text-red-600">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <XCircleIcon size={12} /> No face match{check.lastFailureSimilarity !== null ? ` (${check.lastFailureSimilarity.toFixed(1)}% similar)` : ''}
                  </span>
                  {check.lastFailureReason && <span className="block text-gray-500">{check.lastFailureReason}</span>}
                </p>
              ) : (
                <p className="text-xs text-gray-500">Not verified yet</p>
              )}
            </div>
            {!check.verified && check.enrolled && !check.canVerify && <p className="text-xs text-gray-400">Your role can't run this face match.</p>}
            {!check.verified && check.enrolled && check.canVerify && (
              <button
                onClick={() => setCapturing(check)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                  check.lastFailedAt ? 'bg-accent hover:bg-accent/90' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {check.lastFailedAt ? (
                  <>
                    <RefreshCwIcon size={16} /> Recapture face
                  </>
                ) : (
                  <>
                    <ScanFaceIcon size={16} /> Verify face
                  </>
                )}
              </button>
            )}
          </li>
        ))}
      </ul>

      {capturing && (
        <FaceCaptureModal
          clientId={capturing.clientId}
          clientName={capturing.clientName ?? `Client #${capturing.clientId}`}
          purpose="loan"
          loanId={loanId}
          onClose={() => setCapturing(null)}
          onFinished={() => void load()}
        />
      )}
    </section>
  );
}
