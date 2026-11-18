import { useEffect, useState } from 'react';
import apiClient from '../../../../api/apiClient';
import { SimpleCrudScreen } from '../../SimpleCrudScreen';

type NextOfKin = { id: number; clientRelationshipId: number | null; firstName: string | null; lastName: string | null; mobile: string | null; email: string | null; notes: string | null };

/**
 * A client's next of kin. The relationship is picked from the configured relationship types (Settings →
 * client relationships) — staff used to be asked for a raw "Relationship Type ID", and any number that
 * wasn't one made the save fail.
 */
export function NextOfKinSection({ clientId, readOnly }: { clientId: number; readOnly: boolean }) {
  const [relationships, setRelationships] = useState<{ id: number; name: string | null }[]>([]);

  useEffect(() => {
    void apiClient
      .get<{ id: number; name: string | null }[]>('/client-relationships')
      .then((response) => setRelationships([...response.data].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))))
      .catch(() => setRelationships([]));
  }, []);

  const relationshipName = (id: number | null) => relationships.find((r) => r.id === id)?.name ?? '—';

  return (
    <SimpleCrudScreen<NextOfKin>
      title="Next of kin"
      endpoint={`/clients/${clientId}/next-of-kin`}
      readOnly={readOnly}
      columns={[
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'clientRelationshipId', label: 'Relationship', render: (item) => relationshipName(item.clientRelationshipId) },
        { key: 'mobile', label: 'Mobile' },
      ]}
      fields={[
        {
          key: 'clientRelationshipId',
          label: 'Relationship to client',
          type: 'select',
          placeholder: 'Choose a relationship',
          options: relationships.map((r) => ({ value: r.id, label: r.name ?? `#${r.id}` })),
        },
        { key: 'firstName', label: 'First Name', type: 'text' },
        { key: 'lastName', label: 'Last Name', type: 'text' },
        { key: 'mobile', label: 'Mobile', type: 'tel' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyItem={{ clientRelationshipId: null, firstName: '', lastName: '', mobile: '', email: '', notes: '' }}
    />
  );
}
