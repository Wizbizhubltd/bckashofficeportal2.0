import { SimpleCrudScreen } from './SimpleCrudScreen';

interface ClientProfession {
  id: number;
  name: string | null;
}

export function ClientProfessionsAdmin() {
  return (
    <SimpleCrudScreen<ClientProfession>
      title="Professions"
      description="Client occupation/profession lookup values (FR-CLI-1)."
      endpoint="/client-professions"
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ key: 'name', label: 'Name', type: 'text' }]}
      emptyItem={{ name: '' }}
    />
  );
}
