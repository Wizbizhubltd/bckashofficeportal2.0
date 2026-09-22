import { SimpleCrudScreen } from './SimpleCrudScreen';

interface Currency {
  id: number;
  name: string | null;
  code: string | null;
  symbol: string | null;
  decimals: string | null;
  xrate: number | null;
  internationalCode: string | null;
  active: boolean;
}

export function CurrenciesAdmin() {
  return (
    <SimpleCrudScreen<Currency>
      title="Currencies"
      description="Supported currencies, exchange rates, and decimal precision (BR-ORG-2)."
      endpoint="/currencies"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'symbol', label: 'Symbol' },
        { key: 'xrate', label: 'Exchange Rate' },
        { key: 'active', label: 'Active', render: (c) => (c.active ? 'Yes' : 'No') },
      ]}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'code', label: 'Code (e.g. NGN)', type: 'text' },
        { key: 'symbol', label: 'Symbol', type: 'text' },
        { key: 'decimals', label: 'Decimal Places', type: 'text' },
        { key: 'xrate', label: 'Exchange Rate', type: 'number' },
        { key: 'internationalCode', label: 'International Code', type: 'text' },
        { key: 'active', label: 'Active', type: 'checkbox' },
      ]}
      emptyItem={{ name: '', code: '', symbol: '', decimals: '2', xrate: null, internationalCode: '', active: true }}
    />
  );
}
