import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, XIcon, FlaskConicalIcon } from 'lucide-react';
import apiClient from '../../api/apiClient';

const FIELD_TYPES = ['Number', 'Textfield', 'Date', 'Decimal', 'Textarea', 'Checkbox', 'Radiobox', 'Select'] as const;
const OPTION_TYPES = new Set(['Checkbox', 'Radiobox', 'Select']);

interface CustomField {
  id: number;
  category: string | null;
  name: string | null;
  fieldType: (typeof FIELD_TYPES)[number];
  required: boolean;
  radioBoxValues: string | null;
  checkboxValues: string | null;
  selectValues: string | null;
}

interface CustomFieldValue {
  id: number;
  customFieldId: number;
  entityType: string;
  entityId: number;
  value: string | null;
}

const EMPTY_FORM = { category: 'client', name: '', fieldType: 'Textfield' as (typeof FIELD_TYPES)[number], required: false, options: '' };

/**
 * Define custom fields of every type, plus a "capture a value against a test record"
 * panel — this is what actually exercises the Phase 1 acceptance criterion directly in
 * the UI, since custom field values (CustomFieldValue) aren't wired into any real
 * module's screens yet (those land as clients/loans/etc. are built in later phases).
 */
export function CustomFieldsAdmin() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);

  const [testField, setTestField] = useState<CustomField | null>(null);
  const [testEntityId, setTestEntityId] = useState('1001');
  const [testValue, setTestValue] = useState('');
  const [capturedValues, setCapturedValues] = useState<CustomFieldValue[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<CustomField[]>('/custom-fields');
      setFields(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load custom fields.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      const options = OPTION_TYPES.has(form.fieldType) ? form.options : null;
      await apiClient.post('/custom-fields', {
        category: form.category,
        name: form.name,
        fieldType: form.fieldType,
        required: form.required,
        radioBoxValues: options,
        checkboxValues: options,
        selectValues: options,
      });
      toast.success('Custom field created.');
      setForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/custom-fields/${id}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  const loadCapturedValues = async (field: CustomField, entityId: string) => {
    if (!entityId) {
      setCapturedValues([]);
      return;
    }
    const response = await apiClient.get<CustomFieldValue[]>('/custom-fields/values', {
      params: { entityType: 'TestRecord', entityId },
    });
    setCapturedValues(response.data.filter((v: CustomFieldValue) => v.customFieldId === field.id));
  };

  const openTestPanel = async (field: CustomField) => {
    setTestField(field);
    setTestValue('');
    await loadCapturedValues(field, testEntityId);
  };

  const captureValue = async () => {
    if (!testField) {
      return;
    }
    try {
      await apiClient.post('/custom-fields/values', {
        customFieldId: testField.id,
        entityType: 'TestRecord',
        entityId: Number(testEntityId),
        value: testValue,
      });
      toast.success('Value captured.');
      await loadCapturedValues(testField, testEntityId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Capture failed — check the value matches the field type.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Custom Fields</h1>
          <p className="text-sm text-gray-500 mt-1">
            Admin-defined fields for data not covered by standard columns (BR-ORG-6). Use the flask icon to capture a
            test value and confirm the field type validates correctly.
          </p>
        </div>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add Field
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Required</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : fields.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No custom fields yet.</td></tr>
            ) : (
              fields.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{f.name}</td>
                  <td className="px-4 py-3 text-gray-700">{f.category}</td>
                  <td className="px-4 py-3 text-gray-700">{f.fieldType}</td>
                  <td className="px-4 py-3 text-gray-700">{f.required ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => void openTestPanel(f)} className="text-gray-400 hover:text-primary" aria-label="Capture a test value">
                        <FlaskConicalIcon size={16} />
                      </button>
                      <button onClick={() => void handleDelete(f.id)} className="text-gray-400 hover:text-red-600" aria-label="Delete">
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

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">Add Custom Field</h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="client, loan, group…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                <select
                  value={form.fieldType}
                  onChange={(e) => setForm({ ...form, fieldType: e.target.value as (typeof FIELD_TYPES)[number] })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {OPTION_TYPES.has(form.fieldType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options (comma-separated)</label>
                  <input
                    type="text"
                    value={form.options}
                    onChange={(e) => setForm({ ...form, options: e.target.value })}
                    placeholder="Red, Green, Blue"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                Required
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {testField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">Capture a Test Value — {testField.name}</h2>
              <button onClick={() => setTestField(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Values are captured against a synthetic "TestRecord" — real modules (clients, loans…) call the same
              endpoint once their own screens land in later phases.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Record ID</label>
                <input
                  type="number"
                  value={testEntityId}
                  onChange={(e) => {
                    setTestEntityId(e.target.value);
                    void loadCapturedValues(testField, e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="text"
                  value={testValue}
                  onChange={(e) => setTestValue(e.target.value)}
                  placeholder={testField.fieldType === 'Date' ? 'YYYY-MM-DD' : ''}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              {capturedValues.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  Current value for record {testEntityId}: <span className="font-medium">{capturedValues[0].value}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setTestField(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Close
              </button>
              <button
                onClick={() => void captureValue()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Capture Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
