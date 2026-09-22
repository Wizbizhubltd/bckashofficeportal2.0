import { SimpleCrudScreen } from './SimpleCrudScreen';

interface Country {
  id: number;
  sortname: string;
  name: string;
}

export function CountriesAdmin() {
  return (
    <SimpleCrudScreen<Country>
      title="Countries"
      description="Seeded from the ISO 3166-1 country list — no legacy production data existed to migrate for this table (see Phase 1 notes)."
      endpoint="/countries"
      columns={[
        { key: 'sortname', label: 'Code' },
        { key: 'name', label: 'Name' },
      ]}
      fields={[
        { key: 'sortname', label: 'Code', type: 'text' },
        { key: 'name', label: 'Name', type: 'text' },
      ]}
      emptyItem={{ sortname: '', name: '' }}
    />
  );
}
