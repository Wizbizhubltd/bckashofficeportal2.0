import { SimpleCrudScreen } from './SimpleCrudScreen';

interface LoanPurpose {
  id: number;
  name: string | null;
}

export function LoanPurposesAdmin() {
  return (
    <SimpleCrudScreen<LoanPurpose>
      title="Loan Purposes"
      description="Purpose options available on a loan application (BR-LN-2)."
      endpoint="/loan-purposes"
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ key: 'name', label: 'Name', type: 'text' }]}
      emptyItem={{ name: '' }}
    />
  );
}
