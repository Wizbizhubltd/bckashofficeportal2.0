import { useEffect, useState } from 'react';
import { CheckCircle2Icon, ScanFaceIcon, ShieldCheckIcon, XCircleIcon } from 'lucide-react';
import { biometricsApi, type ClientBiometrics, type FaceCapture } from '../../../../api/clientsApi';
import { PassportPhoto } from '../../../../components/PassportPhoto';
import { FaceCaptureModal } from '../../../../components/FaceCaptureModal';

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

/**
 * The client's biometrics: their enrolled face (a liveness-checked capture that is also their profile
 * picture and what every loan face match is compared against), the button to capture it, and every
 * capture so far.
 */
export function BiometricsSection({ clientId, clientName, onEnrolled }: { clientId: number; clientName: string; onEnrolled: () => void }) {
  const [biometrics, setBiometrics] = useState<ClientBiometrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);

  const load = () =>
    biometricsApi
      .get(clientId)
      .then(setBiometrics)
      .catch(() => setFailed(true));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const finished = (capture: FaceCapture) => {
    void load();
    if (capture.status === 'passed' && capture.purpose === 'enrollment') {
      setPhotoVersion((v) => v + 1);
      onEnrolled();
    }
  };

  if (failed) return <p className="py-10 text-center text-sm text-gray-400">Couldn't load the client's biometrics.</p>;
  if (!biometrics) return <p className="py-10 text-center text-sm text-gray-400">Loading…</p>;

  // The latest enrollment attempt that failed, when the client still isn't enrolled — shown so staff know to recapture.
  const lastFailedEnrollment = biometrics.enrolled
    ? null
    : biometrics.captures.find((c) => c.purpose === 'enrollment' && c.status !== 'pending') ?? null;
  const showFailure = lastFailedEnrollment?.status === 'failed';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-xl border border-gray-100 p-5 sm:flex-row sm:items-center">
        <PassportPhoto clientId={clientId} name={clientName} hasPhoto={biometrics.enrolled} version={photoVersion} className="h-32 w-28" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {biometrics.enrolled ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <ShieldCheckIcon size={12} /> Face enrolled
              </span>
            ) : (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Not enrolled</span>
            )}
          </div>
          {biometrics.enrollment ? (
            <p className="text-sm text-gray-600">
              Captured {formatDateTime(biometrics.enrollment.completedAt)} by {biometrics.enrollment.capturedByName ?? 'unknown'} · liveness{' '}
              {biometrics.enrollment.livenessConfidence?.toFixed(1)}%
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              {biometrics.required
                ? `Capture the client's face with a live camera check — it's needed before they can be approved or take a loan. It becomes their profile picture, and before any loan is disbursed their face is matched against it (${biometrics.faceMatchThreshold}% similarity needed).`
                : `Face capture is optional. A live camera check becomes the client's profile picture, and their face can be matched against it before a loan is disbursed (${biometrics.faceMatchThreshold}% similarity needed).`}
            </p>
          )}
          {showFailure && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircleIcon size={15} className="mt-0.5 flex-shrink-0" />
              <span>
                Last capture wasn't accepted, so the face isn't enrolled. {lastFailedEnrollment?.failureReason}
              </span>
            </p>
          )}
          {!biometrics.canEnroll && biometrics.enrollBlockedReason && <p className="text-xs text-gray-400">{biometrics.enrollBlockedReason}</p>}
        </div>
        {biometrics.canEnroll && (
          <button
            onClick={() => setCapturing(true)}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-heading font-bold text-white hover:bg-accent/90 sm:self-center"
          >
            <ScanFaceIcon size={18} />
            {biometrics.enrolled || showFailure ? 'Recapture face' : 'Start face capture'}
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-heading font-bold uppercase tracking-widest text-gray-400">Capture history</h3>
        {biometrics.captures.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No face captures yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium text-right">Liveness</th>
                  <th className="px-4 py-3 font-medium text-right">Face match</th>
                  <th className="px-4 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {biometrics.captures.map((capture) => (
                  <tr key={capture.id} className="align-top">
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(capture.completedAt ?? capture.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{capture.purpose === 'enrollment' ? 'Enrollment' : `Loan #${capture.loanId}`}</td>
                    <td className="px-4 py-3">
                      {capture.status === 'passed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2Icon size={14} /> Passed
                        </span>
                      ) : capture.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-red-600" title={capture.failureReason ?? undefined}>
                          <XCircleIcon size={14} /> Failed
                        </span>
                      ) : (
                        <span className="text-gray-400">Not finished</span>
                      )}
                      {capture.status === 'failed' && capture.failureReason && <span className="mt-0.5 block max-w-xs text-xs text-gray-500">{capture.failureReason}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{capture.livenessConfidence === null ? '—' : `${capture.livenessConfidence.toFixed(1)}%`}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{capture.similarity === null ? '—' : `${capture.similarity.toFixed(1)}%`}</td>
                    <td className="px-4 py-3 text-gray-700">{capture.capturedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {capturing && (
        <FaceCaptureModal clientId={clientId} clientName={clientName} purpose="enrollment" onClose={() => setCapturing(false)} onFinished={finished} />
      )}
    </div>
  );
}
