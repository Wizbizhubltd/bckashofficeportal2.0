import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImageUpIcon, LoaderIcon } from 'lucide-react';
import { clientsApi } from '../api/clientsApi';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a passport photo for the client's record — offered only while face capture is switched off
 * (the API says so with `canUploadPhoto`). It's their profile picture, not a face check.
 */
export function PassportPhotoUploadButton({ clientId, hasPhoto, onUploaded }: { clientId: number; hasPhoto: boolean; onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(jpe?g|png)$/i.test(file.name)) {
      toast.error('Upload the passport photo as a JPG or PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('The photo must be 2 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      await clientsApi.uploadPassportPhoto(clientId, file);
      toast.success(hasPhoto ? 'Passport photo replaced.' : 'Passport photo uploaded.');
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The photo could not be uploaded.');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-heading font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:self-center"
      >
        {uploading ? <LoaderIcon size={18} className="animate-spin" /> : <ImageUpIcon size={18} />}
        {hasPhoto ? 'Replace passport photo' : 'Upload passport photo'}
      </button>
    </>
  );
}
