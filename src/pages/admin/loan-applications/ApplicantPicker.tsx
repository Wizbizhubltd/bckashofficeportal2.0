import { useEffect, useRef, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';

interface Option {
  id: number;
  label: string;
  detail: string | null;
  /** Why this applicant can't be chosen (e.g. their face isn't captured); null when they can. */
  blocked: string | null;
}

interface PagedResult<T> {
  items: T[];
}

/**
 * Picks the applicant for a loan application — only approved clients or groups can apply, so only
 * those are offered. A client whose face hasn't been captured is shown but can't be chosen. Clients
 * are searched by name; groups are listed.
 */
export function ApplicantPicker({ kind, value, onChange }: { kind: 'Client' | 'Group'; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option | null>(null);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelected(null);
    setQuery('');
  }, [kind]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const request =
        kind === 'Client'
          ? apiClient
              .get<PagedResult<{ id: number; displayName: string | null; firstName: string | null; lastName: string | null; accountNo: string | null; faceEnrolled: boolean }>>('/clients', {
                  params: { status: 'Active', search: query.trim() || undefined, page: 1, pageSize: 15 },
                })
              .then((r) =>
                r.data.items.map((c) => ({
                  id: c.id,
                  label: c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' ') || `Client #${c.id}`,
                  detail: c.accountNo,
                  blocked: c.faceEnrolled ? null : 'Face not captured — capture it on the client’s page first',
                })),
              )
          : apiClient
              .get<PagedResult<{ id: number; name: string | null; accountNo: string | null }>>('/groups', { params: { status: 'Active', page: 1, pageSize: 100 } })
              .then((r) =>
                r.data.items
                  .filter((g) => !query.trim() || (g.name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
                  .map((g) => ({ id: g.id, label: g.name ?? `Group #${g.id}`, detail: g.accountNo, blocked: null })),
              );
      void request.then(setOptions).catch(() => setOptions([]));
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [kind, query]);

  const choose = (option: Option) => {
    setSelected(option);
    setOpen(false);
    setQuery('');
    onChange(String(option.id));
  };

  if (value && selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
        <span className="truncate text-gray-800">
          {selected.label}
          {selected.detail && <span className="text-gray-400"> · A/C {selected.detail}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            onChange('');
          }}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Change applicant"
        >
          <XIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={kind === 'Client' ? 'Search approved clients by name' : 'Search approved groups'}
        className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">No approved {kind === 'Client' ? 'clients' : 'groups'} found.</li>
          ) : (
            options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={!!option.blocked}
                  onMouseDown={() => !option.blocked && choose(option)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <span className={option.blocked ? 'text-gray-400' : 'text-gray-800'}>{option.label}</span>
                  {option.detail && <span className="text-gray-400"> · A/C {option.detail}</span>}
                  {option.blocked && <span className="block text-xs text-amber-700">{option.blocked}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
