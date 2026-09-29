import type { OfficeOption } from '../../hooks/useScopedOffices';

/** Which office the clients join — only asked when the staff member works in more than one (a director never onboards). */
export function OfficeField({ offices, value, onChange, error }: { offices: OfficeOption[]; value: string; onChange: (value: string) => void; error?: string }) {
  if (offices.length <= 1) return null;
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-gray-600">
        Office <span className="text-red-500">*</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${error ? 'border-red-300' : 'border-gray-200'}`}
      >
        <option value="">Select an office</option>
        {offices.map((office) => (
          <option key={office.id} value={office.id}>
            {office.name ?? `Office #${office.id}`}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </label>
  );
}
