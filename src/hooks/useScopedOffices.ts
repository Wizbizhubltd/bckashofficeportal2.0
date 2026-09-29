import { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';

export interface OfficeOption {
  id: number;
  name: string | null;
  zoneName?: string | null;
}

/**
 * The offices the signed-in user works in — the API only returns those (a director's zones, or
 * everyone else's own office), so an office dropdown built from this is already limited correctly.
 */
export function useScopedOffices(): OfficeOption[] {
  const [offices, setOffices] = useState<OfficeOption[]>([]);

  useEffect(() => {
    void apiClient
      .get<OfficeOption[]>('/offices')
      .then((response) => setOffices(response.data))
      .catch(() => undefined);
  }, []);

  return offices;
}
