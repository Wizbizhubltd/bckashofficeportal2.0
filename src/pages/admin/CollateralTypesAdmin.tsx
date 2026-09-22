import { SimpleCrudScreen } from './SimpleCrudScreen';

interface CollateralType {
  id: number;
  name: string | null;
}

export function CollateralTypesAdmin() {
  return (
    <SimpleCrudScreen<CollateralType>
      title="Collateral Types"
      description="Collateral type options available when securing a loan (FR-LN-22)."
      endpoint="/collateral-types"
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ key: 'name', label: 'Name', type: 'text' }]}
      emptyItem={{ name: '' }}
    />
  );
}
