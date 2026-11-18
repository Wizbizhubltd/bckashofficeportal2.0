import { useState } from 'react';
import toast from 'react-hot-toast';
import { DownloadIcon, LoaderIcon } from 'lucide-react';
import { downloadClientForm } from '../utils/clientPdf';

/** Saves the client's printable form straight to the device as a PDF — no new tab or print dialog. */
export function DownloadFormButton({ printPath, className }: { printPath: string; className: string }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await downloadClientForm(printPath);
      toast.success('Form downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The form could not be downloaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void download()} disabled={busy} className={`${className} disabled:opacity-50`}>
      {busy ? <LoaderIcon size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
      {busy ? 'Preparing PDF…' : 'Download form'}
    </button>
  );
}
