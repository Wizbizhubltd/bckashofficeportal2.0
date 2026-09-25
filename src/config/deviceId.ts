import { DEVICE_ID_KEY } from './storageKeys';

/** This browser's stable device id, created on first use. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (e.g. some private modes) — still sign in, just without a remembered id.
    return crypto.randomUUID();
  }
}
