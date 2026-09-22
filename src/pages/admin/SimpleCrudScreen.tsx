import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, XIcon, AlertTriangleIcon } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { ConfirmationModal } from '../../components/ConfirmationModal';

export interface CrudField<T> {
  // Deliberately excludes 'id' — fields describe the editable form, which never includes
  // the primary key, and modalItem's type (T | Omit<T, 'id'>) only guarantees these keys.
  key: keyof Omit<T, 'id'>;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'textarea';
}

export interface CrudColumn<T> {
  key: keyof T;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface SimpleCrudScreenProps<T extends { id: number }> {
  title: string;
  description?: string;
  endpoint: string;
  columns: CrudColumn<T>[];
  fields: CrudField<T>[];
  emptyItem: Omit<T, 'id'>;
  canDelete?: boolean;
}

/**
 * Generic table+modal CRUD screen shared by the reference-data entities with no extra
 * business rules of their own (Currencies, Countries, Funds, Payment Types). Offices,
 * Charges, and Custom Fields have real behavior (hierarchy, validation, value capture)
 * and get their own screens instead of this one.
 */
export function SimpleCrudScreen<T extends { id: number }>({
  title,
  description,
  endpoint,
  columns,
  fields,
  emptyItem,
  canDelete = true,
}: SimpleCrudScreenProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState<T | Omit<T, 'id'> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<T[]>(endpoint);
      setItems(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const isEditing = modalItem !== null && 'id' in modalItem;

  const handleSave = async () => {
    if (!modalItem) {
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await apiClient.put(`${endpoint}/${(modalItem as T).id}`, modalItem);
        toast.success(`${title.replace(/s$/, '')} updated.`);
      } else {
        await apiClient.post(endpoint, modalItem);
        toast.success(`${title.replace(/s$/, '')} created.`);
      }
      setModalItem(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await apiClient.delete(`${endpoint}/${deleteTarget.id}`);
      toast.success(`${title.replace(/s$/, '')} deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">{title}</h1>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <button
          onClick={() => setModalItem(emptyItem)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="px-4 py-3 font-medium">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400">
                  Nothing here yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-gray-700">
                      {col.render ? col.render(item) : String(item[col.key] ?? '')}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setModalItem(item)} className="text-gray-400 hover:text-primary" aria-label="Edit">
                        <PencilIcon size={16} />
                      </button>
                      {canDelete && (
                        <button onClick={() => setDeleteTarget(item)} className="text-gray-400 hover:text-red-600" aria-label="Delete">
                          <TrashIcon size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">
                {isEditing ? `Edit ${title.replace(/s$/, '')}` : `Add ${title.replace(/s$/, '')}`}
              </h2>
              <button onClick={() => setModalItem(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field) => (
                <div key={String(field.key)}>
                  {field.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(modalItem[field.key])}
                        onChange={(e) => setModalItem({ ...modalItem, [field.key]: e.target.checked })}
                        className="rounded text-primary focus:ring-primary"
                      />
                      {field.label}
                    </label>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={String(modalItem[field.key] ?? '')}
                          onChange={(e) => setModalItem({ ...modalItem, [field.key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          rows={3}
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={String(modalItem[field.key] ?? '')}
                          onChange={(e) =>
                            setModalItem({
                              ...modalItem,
                              [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalItem(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={`Delete ${title.replace(/s$/, '')}?`}
        description="This cannot be undone."
        icon={<AlertTriangleIcon className="text-red-600" size={20} />}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
