import { lazy, Suspense, type ComponentProps } from 'react';
import { LoaderIcon } from 'lucide-react';
import type { FaceCaptureModal as FaceCaptureModalComponent } from './FaceCaptureModal';

// The face-liveness SDK (AWS Amplify + its TensorFlow face model) is by far the largest part of the
// portal's code, yet only needed while capturing a face. Loading it on demand keeps it out of the
// download every staff member makes on first visit — which matters on slow mobile data.
const FaceCaptureModalImpl = lazy(() => import('./FaceCaptureModal').then((m) => ({ default: m.FaceCaptureModal })));

export function FaceCaptureModal(props: ComponentProps<typeof FaceCaptureModalComponent>) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-gray-700 shadow">
            <LoaderIcon size={16} className="animate-spin" /> Loading face capture…
          </div>
        </div>
      }
    >
      <FaceCaptureModalImpl {...props} />
    </Suspense>
  );
}
