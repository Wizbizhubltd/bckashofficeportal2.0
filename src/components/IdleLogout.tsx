import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockIcon, LogOutIcon } from 'lucide-react';
import { env } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { LAST_ACTIVITY_KEY, SIGNED_OUT_REASON_KEY } from '../config/storageKeys';

/** From this portal's .env: VITE_IDLE_TIMEOUT_SECONDS and VITE_IDLE_WARNING_SECONDS. */
const policy = { idleTimeoutSeconds: env.idleTimeoutSeconds, warningSeconds: env.idleWarningSeconds };

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** The latest activity any tab recorded; 0 when none is stored (this tab's own record then decides). */
function readLastActivity(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastActivity(at: number) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Storage unavailable — this tab still tracks its own activity.
  }
}

function describe(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
  return `${seconds} seconds`;
}

/**
 * Signs the user out after VITE_IDLE_TIMEOUT_SECONDS of inactivity (this portal's .env).
 * For the last VITE_IDLE_WARNING_SECONDS a modal counts down, and the user chooses to stay signed in or
 * sign out now — moving the mouse alone doesn't dismiss it. Activity is shared across open tabs.
 */
export function IdleLogout() {
  const { logout } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());
  const warning = secondsLeft !== null;
  const warningRef = useRef(false);
  warningRef.current = warning;

  const markActive = useCallback(() => {
    const now = Date.now();
    lastActivity.current = now;
    writeLastActivity(now);
  }, []);

  const signOut = useCallback(
    (automatic: boolean) => {
      if (automatic) {
        sessionStorage.setItem(SIGNED_OUT_REASON_KEY, `You were signed out after ${describe(policy.idleTimeoutSeconds)} of inactivity.`);
      }
      setSecondsLeft(null);
      logout();
    },
    [logout],
  );

  // Record activity (throttled), ignoring it while the warning is up — the user must choose.
  useEffect(() => {
    markActive();
    let lastWrite = 0;
    const onActivity = () => {
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      markActive();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
  }, [markActive]);

  // Check once a second: count down in the warning window, sign out when time is up.
  useEffect(() => {
    if (policy.idleTimeoutSeconds <= 0) return;
    const timeoutMs = policy.idleTimeoutSeconds * 1000;
    const warningMs = Math.min(policy.warningSeconds, policy.idleTimeoutSeconds) * 1000;
    const tick = () => {
      // Another tab may have seen more recent activity.
      const last = Math.max(lastActivity.current, readLastActivity());
      lastActivity.current = last;
      const remaining = timeoutMs - (Date.now() - last);
      if (remaining <= 0) {
        signOut(true);
      } else if (remaining <= warningMs) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warningRef.current) {
        setSecondsLeft(null); // activity in another tab
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [signOut]);

  if (!warning) return null;

  const stay = () => {
    markActive();
    setSecondsLeft(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-logout-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ClockIcon size={24} />
        </span>
        <h2 id="idle-logout-title" className="mt-4 font-heading text-lg font-bold text-gray-900">
          Are you still there?
        </h2>
        <p className="mt-1 text-sm text-gray-500">You've been inactive for a while. For your security you'll be signed out in</p>
        <p className="mt-3 font-heading text-4xl font-bold tabular-nums text-primary" aria-live="polite">
          {secondsLeft}s
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => signOut(false)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <LogOutIcon size={16} /> Sign out
          </button>
          <button
            type="button"
            autoFocus
            onClick={stay}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-heading font-bold text-white hover:bg-primary/90"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
