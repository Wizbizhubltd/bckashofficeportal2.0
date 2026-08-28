import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FingerprintIcon, XIcon, CheckCircleIcon, UploadIcon, FileIcon, Loader2Icon, CameraIcon, VideoOffIcon, ScanFaceIcon, AlertTriangleIcon } from 'lucide-react';

// Liveness check (webcam mode only) — no server-side face-liveness provider
// exists here (see this file's own doc comment on why capture is upload-
// only), so this is a lightweight in-browser action challenge instead: pick
// a random prompt, sample a "before" frame, give the person a few seconds to
// actually perform it, then sample an "after" frame and require the two to
// differ by more than LIVENESS_DIFF_THRESHOLD. Catches the common case (a
// static photo held up to the camera, which can't blink/turn/smile on cue)
// without needing a dedicated liveness API — not defeat-proof against a
// video replay, but that's a materially harder attack to pull off at a
// branch counter.
const LIVENESS_ACTIONS = ['Blink both eyes', 'Turn your head slightly, then back', 'Smile'];
const LIVENESS_COUNTDOWN_SECONDS = 3;
// Mean absolute luminance difference (0-255 scale) between the before/after
// sample grids required to count as "something moved" — picked to comfortably
// clear normal camera/lighting noise (a couple of levels) while still
// tripping on a genuine blink/head-turn/smile. Tune here if real-world use
// shows too many false passes/fails.
const LIVENESS_DIFF_THRESHOLD = 6;
const LIVENESS_SAMPLE_WIDTH = 32;
const LIVENESS_SAMPLE_HEIGHT = 24;

type LivenessPhase = 'idle' | 'counting' | 'checking' | 'failed';

/** Downsampled grayscale luminance grid for one video frame — cheap enough to diff every capture without any ML model. */
function sampleLuminanceGrid(video: HTMLVideoElement, canvas: HTMLCanvasElement): Float32Array | null {
  if (video.videoWidth === 0) return null;
  canvas.width = LIVENESS_SAMPLE_WIDTH;
  canvas.height = LIVENESS_SAMPLE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, LIVENESS_SAMPLE_WIDTH, LIVENESS_SAMPLE_HEIGHT);
  const { data } = ctx.getImageData(0, 0, LIVENESS_SAMPLE_WIDTH, LIVENESS_SAMPLE_HEIGHT);
  const grid = new Float32Array(LIVENESS_SAMPLE_WIDTH * LIVENESS_SAMPLE_HEIGHT);
  for (let i = 0; i < grid.length; i += 1) {
    const offset = i * 4;
    grid[i] = 0.299 * data[offset]! + 0.587 * data[offset + 1]! + 0.114 * data[offset + 2]!;
  }
  return grid;
}

function meanAbsoluteDiff(a: Float32Array, b: Float32Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i]! - b[i]!);
  }
  return total / a.length;
}

interface BiometricCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Uploads the file via POST /customers/:id/biometric (or .../id-document, see `title`/`hint`) — there is no live-camera-capture endpoint, this is upload-only either way; `mode: 'webcam'` just changes how the File gets produced client-side. */
  onUpload: (file: File) => Promise<void> | void;
  title?: string;
  hint?: string;
  /**
   * 'upload' (default) — drag-and-drop/browse a file, for capturing a photo
   * of a physical document (ID document, etc.).
   * 'webcam' — opens the device camera and captures a live still frame, so
   * the person being onboarded is actually the one photographed rather than
   * whatever image file happens to be picked. Same getUserMedia/canvas
   * capture pattern as LoanDetail.tsx's own pre-disbursement facial capture.
   */
  mode?: 'upload' | 'webcam';
  subjectName?: string;
}

/**
 * Real backend support is just "upload one image" (multipart, field `image`)
 * — no live-scan provider, no match score. Generic enough to back both
 * biometric and ID document capture (same shape, different S3 key/field) —
 * see `title`/`hint`/`mode`.
 */
export function BiometricCaptureModal({
  isOpen,
  onClose,
  onUpload,
  title = 'Biometric Capture',
  hint = 'Compared against the BVN photo during disbursement verification.',
  mode = 'upload',
  subjectName,
}: BiometricCaptureModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Liveness check state (webcam mode only) — see this file's own top-level
  // doc comment for the approach.
  const [livenessAction, setLivenessAction] = useState<string>(LIVENESS_ACTIONS[0]!);
  const [livenessPhase, setLivenessPhase] = useState<LivenessPhase>('idle');
  const [livenessCountdown, setLivenessCountdown] = useState(LIVENESS_COUNTDOWN_SECONDS);
  const baselineGridRef = useRef<Float32Array | null>(null);
  const livenessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearLivenessTimer() {
    if (livenessTimerRef.current !== null) {
      clearInterval(livenessTimerRef.current);
      livenessTimerRef.current = null;
    }
  }

  function resetLiveness() {
    clearLivenessTimer();
    baselineGridRef.current = null;
    setLivenessPhase('idle');
    setLivenessCountdown(LIVENESS_COUNTDOWN_SECONDS);
    setLivenessAction(LIVENESS_ACTIONS[Math.floor(Math.random() * LIVENESS_ACTIONS.length)]!);
  }

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
      setIsDragOver(false);
      setIsUploading(false);
      setCameraError(null);
      resetLiveness();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => clearLivenessTimer, []);

  // Webcam mode only: request the camera as soon as the modal opens, and
  // release it again on close/unmount — never left running in the
  // background.
  useEffect(() => {
    if (!isOpen || mode !== 'webcam') return;

    let isMounted = true;
    let activeStream: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot access a camera. Try a different device or browser.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => setCameraError('Could not access the camera — check the browser permission prompt and try again.'));

    return () => {
      isMounted = false;
      activeStream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen, mode]);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      return;
    }
    setSelectedFile(file);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
  }

  function handleCaptureFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        handleFile(new File([blob], `biometric-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }

  function finishLivenessCheck() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const baseline = baselineGridRef.current;
    if (!video || !canvas || !baseline) {
      setLivenessPhase('failed');
      return;
    }
    const after = sampleLuminanceGrid(video, canvas);
    if (!after || meanAbsoluteDiff(baseline, after) < LIVENESS_DIFF_THRESHOLD) {
      setLivenessPhase('failed');
      return;
    }
    // Passed — the "after" frame (the one taken mid-action) is the captured
    // photo, no separate manual capture step needed.
    handleCaptureFromCamera();
    resetLiveness();
  }

  function handleStartLivenessCheck() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const baseline = sampleLuminanceGrid(video, canvas);
    if (!baseline) return;
    baselineGridRef.current = baseline;
    setLivenessPhase('counting');
    setLivenessCountdown(LIVENESS_COUNTDOWN_SECONDS);

    clearLivenessTimer();
    livenessTimerRef.current = setInterval(() => {
      setLivenessCountdown((prev) => {
        if (prev <= 1) {
          clearLivenessTimer();
          setLivenessPhase('checking');
          // One tick so the final second's video frame has actually painted
          // before we sample it.
          setTimeout(finishLivenessCheck, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleRetake() {
    setSelectedFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    resetLiveness();
  }

  async function handleConfirmUpload() {
    if (!selectedFile) {
      return;
    }
    try {
      setIsUploading(true);
      await onUpload(selectedFile);
      onClose();
    } finally {
      setIsUploading(false);
    }
  }

  if (!isOpen) return null;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-heading font-bold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="flex items-center gap-2 text-xs font-body text-gray-500">
                <FingerprintIcon size={14} className="text-primary" />
                {hint}
              </div>

              {mode === 'webcam' ? (
                <>
                  {cameraError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                      <VideoOffIcon size={28} className="mx-auto text-red-400 mb-2" />
                      <p className="text-sm text-red-600">{cameraError}</p>
                    </div>
                  ) : previewUrl ? (
                    <img src={previewUrl} alt={subjectName ? `Captured frame of ${subjectName}` : 'Captured frame'} className="w-full rounded-lg border border-gray-200 aspect-video object-cover" />
                  ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border border-gray-200 bg-black aspect-video object-cover" />
                  )}
                  <canvas ref={canvasRef} className="hidden" />

                  {!cameraError && !previewUrl && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <p className="text-xs font-heading font-bold text-primary uppercase tracking-wide flex items-center gap-1.5 mb-1">
                          <ScanFaceIcon size={14} /> Liveness Check
                        </p>
                        {livenessPhase === 'idle' && (
                          <p className="text-sm text-gray-700 font-body">
                            To confirm this is a live person, not a photo, you'll be asked to <strong>{livenessAction.toLowerCase()}</strong> when the check starts.
                          </p>
                        )}
                        {livenessPhase === 'counting' && (
                          <p className="text-sm text-gray-700 font-body">
                            Now: <strong>{livenessAction}</strong> — capturing in {livenessCountdown}...
                          </p>
                        )}
                        {livenessPhase === 'checking' && (
                          <p className="text-sm text-gray-700 font-body flex items-center gap-2">
                            <Loader2Icon size={14} className="animate-spin" /> Checking...
                          </p>
                        )}
                        {livenessPhase === 'failed' && (
                          <p className="text-sm text-red-600 font-body flex items-start gap-1.5">
                            <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
                            We couldn't detect any movement — make sure you're in front of a live camera, not a photo, and try again.
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => (livenessPhase === 'failed' ? resetLiveness() : handleStartLivenessCheck())}
                        disabled={livenessPhase === 'counting' || livenessPhase === 'checking'}
                        className="w-full px-5 py-3 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <CameraIcon size={16} />
                        {livenessPhase === 'failed' ? 'Try Again' : livenessPhase === 'idle' ? 'Start Liveness Check' : 'Checking...'}
                      </button>
                    </div>
                  )}
                  {previewUrl && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleRetake}
                        disabled={isUploading}
                        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        Retake
                      </button>
                      <button
                        onClick={() => void handleConfirmUpload()}
                        disabled={isUploading}
                        className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUploading && <Loader2Icon size={14} className="animate-spin" />}
                        {isUploading ? 'Uploading...' : 'Confirm Capture'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragOver ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50 hover:bg-primary/5 hover:border-primary/30'}`}
                  >
                    <UploadIcon size={32} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-sm font-body font-medium text-gray-700">Drag &amp; drop an image here</p>
                    <p className="text-xs font-body text-gray-400 mt-1">or click to browse — JPG, PNG</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) handleFile(file);
                      }}
                    />
                  </div>

                  {selectedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg"
                    >
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <FileIcon size={18} className="text-green-600" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium text-green-800 truncate">{selectedFile.name}</p>
                        <p className="text-xs font-body text-green-600">Ready to upload</p>
                      </div>
                      <CheckCircleIcon size={18} className="text-green-600" />
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleConfirmUpload()}
                      disabled={!selectedFile || isUploading}
                      className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isUploading && <Loader2Icon size={14} className="animate-spin" />}
                      {isUploading ? 'Uploading...' : 'Confirm Upload'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
