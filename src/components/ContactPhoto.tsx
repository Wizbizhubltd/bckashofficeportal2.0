import { useEffect, useState } from 'react';
import { clientsApi } from '../api/clientsApi';
import { initials } from '../utils/format';

/**
 * A guarantor's or reference's passport photograph, or an initials avatar when none was uploaded.
 * `version` changes whenever a new photo is uploaded, so the image reloads.
 */
export function ContactPhoto({
  clientId,
  kind,
  contactId,
  name,
  hasPhoto,
  version = 0,
  className = 'h-16 w-14',
}: {
  clientId: number;
  kind: 'guarantors' | 'references';
  contactId: number;
  name: string;
  hasPhoto: boolean;
  version?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    void clientsApi.contactPhotoUrl(clientId, kind, contactId).then((loaded) => {
      objectUrl = loaded;
      if (!cancelled) setUrl(loaded);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clientId, kind, contactId, hasPhoto, version]);

  if (url) {
    return <img src={url} alt={`Passport photograph of ${name}`} className={`${className} flex-shrink-0 rounded-lg border border-gray-200 object-cover`} />;
  }

  return (
    <div
      className={`${className} flex flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 font-heading text-sm font-bold text-primary ring-1 ring-primary/10`}
      aria-label={`${name} — no passport photograph yet`}
    >
      {initials(name) || '?'}
    </div>
  );
}
