import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImageUpIcon, LoaderIcon } from 'lucide-react';
import { clientsApi } from '../api/clientsApi';
import { compressImage, PHOTO_MAX_DIMENSION } from '../utils/compressImage';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a passport photo for the client's record — offered only while face capture is switched off
 * (the API says so with `canUploadPhoto`). It's their profile picture, not a face check.
 */
export function PassportPhotoUploadButton({ clientId, hasPhoto, onUploaded }: { clientId: number; hasPhoto: boolean; onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    if (!/\.(jpe?g|png)$/i.test(picked.name)) {
      toast.error('Upload the passport photo as a JPG or PNG.');
      return;
    }
    // Shrunk on the device first: smaller uploads, and a big phone photo still fits the limit.
    const file = await compressImage(picked, PHOTO_MAX_DIMENSION);
    if (file.size > MAX_BYTES) {
      toast.error(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 2 MB.`);
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
        <span className="text-xs font-normal text-gray-400">JPG/PNG · max 2 MB</span>
      </button>
    </>
  );
}
