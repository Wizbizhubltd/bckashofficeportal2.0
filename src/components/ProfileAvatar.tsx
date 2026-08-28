import { useEffect, useMemo, useState } from 'react';
import { UserIcon } from 'lucide-react';
import { env } from '../config/env';

type ProfileAvatarProps = {
  src?: string | null;
  name?: string;
  alt?: string;
  className?: string;
  iconSize?: number;
};

const FALLBACK_GRADIENTS = [
  'from-fuchsia-500 via-purple-500 to-indigo-500',
  'from-cyan-500 via-sky-500 to-blue-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-violet-500 via-purple-500 to-pink-500',
  'from-lime-500 via-emerald-500 to-teal-500',
] as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Exported for anything else that needs to turn a relative `/uploads/...` path (see backend's `toPublicUploadUrl`) into an absolute URL — e.g. StaffDetail's "View ID Document" link. */
export function resolveUploadUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  let normalized = trimmed;
  const uploadsSegmentIndex = normalized.indexOf('/uploads/');
  if (uploadsSegmentIndex > 0) {
    normalized = normalized.slice(uploadsSegmentIndex);
  }

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized.replace(/^\/+/, '')}`;
  }

  try {
    const apiUrl = new URL(env.apiBaseUrl);
    return `${apiUrl.origin}${normalized}`;
  } catch {
    return normalized;
  }
}

export function ProfileAvatar({
  src,
  name,
  alt,
  className = 'w-10 h-10 rounded-full',
  iconSize = 18,
}: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const normalizedSrc = typeof src === 'string' ? resolveUploadUrl(src) : '';
  const hasImage = normalizedSrc.length > 0 && !imageFailed;

  const gradientClass = useMemo(() => {
    const seed = (name || normalizedSrc || 'profile-avatar').trim().toLowerCase();
    const index = hashSeed(seed) % FALLBACK_GRADIENTS.length;
    return FALLBACK_GRADIENTS[index];
  }, [name, normalizedSrc]);

  if (hasImage) {
    return (
      <img
        src={normalizedSrc}
        alt={alt || name || 'Profile'}
        onError={() => setImageFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div
      aria-label={alt || name || 'Profile placeholder'}
      className={`${className} bg-gradient-to-br ${gradientClass} text-white flex items-center justify-center`}>
      <UserIcon size={iconSize} />
    </div>
  );
}
