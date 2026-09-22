import { SimpleCrudScreen } from './SimpleCrudScreen';

interface ClientIdentificationType {
  id: number;
  name: string | null;
}

export function ClientIdentificationTypesAdmin() {
  return (
    <SimpleCrudScreen<ClientIdentificationType>
      title="Identification Types"
      description="Document types (e.g. Passport, National ID) available on a client's identification records (FR-CLI-3)."
      endpoint="/client-identification-types"
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ key: 'name', label: 'Name', type: 'text' }]}
      emptyItem={{ name: '' }}
    />
  );
}
