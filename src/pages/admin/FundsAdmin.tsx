import { SimpleCrudScreen } from './SimpleCrudScreen';

interface Fund {
  id: number;
  name: string | null;
}

export function FundsAdmin() {
  return (
    <SimpleCrudScreen<Fund>
      title="Funds"
      description="Sources of lending capital that can be attached to loans and loan products (BR-ORG-3)."
      endpoint="/funds"
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ key: 'name', label: 'Name', type: 'text' }]}
      emptyItem={{ name: '' }}
    />
  );
}
