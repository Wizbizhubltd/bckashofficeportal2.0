import { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';

export interface Option {
  id: number;
  name: string;
}

/**
 * Options for the cascading State → LGA → City dropdowns, plus zones. States and LGAs are fixed;
 * cities and zones are managed by super admins in the control portal.
 */
export function useLocationOptions(stateId: number | null, lgaId: number | null) {
  const [states, setStates] = useState<Option[]>([]);
  const [zones, setZones] = useState<Option[]>([]);
  const [lgas, setLgas] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);

  useEffect(() => {
    void apiClient.get<Option[]>('/locations/states').then((r) => setStates(r.data)).catch(() => undefined);
    void apiClient.get<Option[]>('/zones').then((r) => setZones(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!stateId) {
      setLgas([]);
      return;
    }
    void apiClient.get<Option[]>('/locations/lgas', { params: { stateId } }).then((r) => setLgas(r.data)).catch(() => undefined);
  }, [stateId]);

  useEffect(() => {
    if (!lgaId) {
      setCities([]);
      return;
    }
    void apiClient.get<Option[]>('/locations/cities', { params: { lgaId } }).then((r) => setCities(r.data)).catch(() => undefined);
  }, [lgaId]);

  return { states, lgas, cities, zones };
}
