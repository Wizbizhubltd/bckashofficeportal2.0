import { SimpleCrudScreen } from './SimpleCrudScreen';

interface PaymentType {
  id: number;
  name: string | null;
  notes: string | null;
  isCash: boolean;
}

export function PaymentTypesAdmin() {
  return (
    <SimpleCrudScreen<PaymentType>
      title="Payment Types"
      description="Cash, cheque, bank transfer, etc. (BR-ORG-4). Non-cash transactions capture payment detail records (account/cheque/routing/receipt) at the point of entry in later phases."
      endpoint="/payment-types"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'isCash', label: 'Is Cash', render: (p) => (p.isCash ? 'Yes' : 'No') },
        { key: 'notes', label: 'Notes' },
      ]}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'isCash', label: 'Is Cash', type: 'checkbox' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyItem={{ name: '', notes: '', isCash: false }}
    />
  );
}
