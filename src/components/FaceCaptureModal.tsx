import { useEffect, useState } from 'react';
import { FaceLivenessDetectorCore, type AwsCredentialProvider } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';
import { CheckCircle2Icon, LoaderIcon, RefreshCwIcon, ScanFaceIcon, XCircleIcon, XIcon } from 'lucide-react';
import { biometricsApi, type FaceCapture } from '../api/clientsApi';

/** Fetches the server's short-lived, liveness-only AWS credentials for the camera component. */
const credentialProvider: AwsCredentialProvider = async () => {
  const credentials = await biometricsApi.credentials();
  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
    expiration: new Date(credentials.expiration),
  };
};

type Stage = { kind: 'starting' } | { kind: 'capturing'; sessionId: string; region: string } | { kind: 'checking' } | { kind: 'done'; capture: FaceCapture } | { kind: 'error'; message: string };

/**
 * A face capture with AWS Rekognition Face Liveness: the client follows the on-screen prompts
 * (moving into the oval while the screen flashes colours), which proves a live person is there
 * rather than a photo, screen or mask. The server then checks the result — and for a loan, compares
 * the face with the client's enrolled one.
 */
export function FaceCaptureModal({
  clientId,
  clientName,
  purpose,
  loanId = null,
  onClose,
  onFinished,
}: {
  clientId: number;
  clientName: string;
  purpose: 'enrollment' | 'loan';
  loanId?: number | null;
  onClose: () => void;
  /** Called with every completed capture, passed or failed. */
  onFinished: (capture: FaceCapture) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStage({ kind: 'starting' });
    biometricsApi
      .start(clientId, purpose, loanId)
      .then((session) => !cancelled && setStage({ kind: 'capturing', sessionId: session.sessionId, region: session.region }))
      .catch((error) => !cancelled && setStage({ kind: 'error', message: error instanceof Error ? error.message : 'The face capture could not start.' }));
    return () => {
      cancelled = true;
    };
  }, [clientId, purpose, loanId, attempt]);

  const finish = async (sessionId: string) => {
    setStage({ kind: 'checking' });
    try {
      const capture = await biometricsApi.complete(clientId, sessionId);
      setStage({ kind: 'done', capture });
      onFinished(capture);
    } catch (error) {
      setStage({ kind: 'error', message: error instanceof Error ? error.message : 'The capture could not be checked.' });
    }
  };

  const title = purpose === 'enrollment' ? 'Capture client’s face' : 'Face match before disbursement';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScanFaceIcon size={18} />
            </span>
            <div>
              <h2 className="font-heading text-base font-bold text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500">{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {(stage.kind === 'starting' || stage.kind === 'checking') && (
            <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-500">
              <LoaderIcon size={24} className="animate-spin text-primary" />
              {stage.kind === 'starting' ? 'Preparing the camera check…' : purpose === 'loan' ? 'Checking liveness and comparing with the enrolled face…' : 'Checking liveness…'}
            </div>
          )}

          {stage.kind === 'capturing' && (
            <>
              <p className="mb-4 rounded-lg bg-primary/5 px-4 py-3 text-sm text-gray-600">
                Ask {clientName.split(' ')[0]} to face the camera in good light, without glasses, a hat or a face covering, and follow the prompts. The screen will flash colours — keep
                still until it finishes.
              </p>
              <FaceLivenessDetectorCore
                key={stage.sessionId}
                sessionId={stage.sessionId}
                region={stage.region}
                config={{ credentialProvider }}
                onAnalysisComplete={() => finish(stage.sessionId)}
                onUserCancel={onClose}
                onError={(error) => setStage({ kind: 'error', message: error.error?.message || `The camera check stopped (${error.state}).` })}
              />
            </>
          )}

          {stage.kind === 'done' && <Result capture={stage.capture} purpose={purpose} />}

          {stage.kind === 'error' && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <XCircleIcon size={36} className="text-red-500" />
              <p className="max-w-md text-sm text-gray-700">{stage.message}</p>
            </div>
          )}
        </div>

        {(stage.kind === 'done' || stage.kind === 'error') && (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            {stage.kind === 'error' || stage.capture.status === 'failed' ? (
              <>
                <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Close
                </button>
                {/* A failed capture is never accepted — the only way forward is a new one. */}
                <button
                  onClick={() => setAttempt((a) => a + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-heading font-bold text-white hover:bg-accent/90"
                >
                  <RefreshCwIcon size={14} /> Recapture
                </button>
              </>
            ) : (
              <button onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-sm font-heading font-bold text-white hover:bg-primary/90">
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Result({ capture, purpose }: { capture: FaceCapture; purpose: 'enrollment' | 'loan' }) {
  const passed = capture.status === 'passed';
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {passed ? <CheckCircle2Icon size={40} className="text-emerald-500" /> : <XCircleIcon size={40} className="text-red-500" />}
      <p className="font-heading text-lg font-bold text-gray-900">
        {passed ? (purpose === 'enrollment' ? 'Face enrolled' : 'Face match passed') : purpose === 'enrollment' ? 'Face not enrolled' : 'No face match'}
      </p>
      <p className="max-w-md text-sm text-gray-600">
        {passed
          ? purpose === 'enrollment'
            ? 'This face is now the client’s biometric record and profile picture.'
            : 'The loan can now be disbursed to this client.'
          : `${capture.failureReason ?? 'The capture wasn’t accepted.'} Nothing was saved — recapture to try again.`}
      </p>
      <dl className="mt-2 flex gap-6 text-sm">
        {capture.livenessConfidence !== null && (
          <div>
            <dt className="text-xs text-gray-400">Liveness</dt>
            <dd className="font-semibold text-gray-800">{capture.livenessConfidence.toFixed(1)}%</dd>
          </div>
        )}
        {capture.similarity !== null && (
          <div>
            <dt className="text-xs text-gray-400">Face match</dt>
            <dd className="font-semibold text-gray-800">{capture.similarity.toFixed(1)}%</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
