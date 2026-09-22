import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { UploadIcon, DownloadIcon, TrashIcon, FileIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { ConfirmationModal } from '../../../../components/ConfirmationModal';

interface DocumentItem {
  id: number;
  name: string | null;
  size: string | null;
  notes: string | null;
  createdAt: string | null;
}

interface DocumentsSectionProps {
  clientId: number;
}

export function DocumentsSection({ clientId }: DocumentsSectionProps) {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<DocumentItem[]>(`/clients/${clientId}/documents`);
      setItems(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/clients/${clientId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document uploaded.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (item: DocumentItem) => {
    try {
      const response = await apiClient.get(`/clients/${clientId}/documents/${item.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name ?? 'document';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await apiClient.delete(`/clients/${clientId}/documents/${deleteTarget.id}`);
      toast.success('Document deleted.');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide">Documents</h3>
        <label className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer">
          <UploadIcon size={16} />
          {uploading ? 'Uploading…' : 'Upload'}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
            }}
          />
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Size (bytes)</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No documents yet.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 flex items-center gap-2">
                    <FileIcon size={14} className="text-gray-400" />
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.size}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => void handleDownload(item)} className="text-gray-400 hover:text-primary" aria-label="Download">
                        <DownloadIcon size={16} />
                      </button>
                      <button onClick={() => setDeleteTarget(item)} className="text-gray-400 hover:text-red-600" aria-label="Delete">
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete document?"
        description="This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
