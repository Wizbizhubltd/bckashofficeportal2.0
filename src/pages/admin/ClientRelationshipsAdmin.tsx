import { SimpleCrudScreen } from './SimpleCrudScreen';

interface ClientRelationship {
  id: number;
  name: string | null;
}

export function ClientRelationshipsAdmin() {
  return (
    <SimpleCrudScreen<ClientRelationship>
      title="Relationship Types"
      description="Configurable relationship types used by next-of-kin and next-of-guardian records (BR-CLI-3)."
      endpoint="/client-relationships"
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ key: 'name', label: 'Name', type: 'text' }]}
      emptyItem={{ name: '' }}
    />
  );
}
