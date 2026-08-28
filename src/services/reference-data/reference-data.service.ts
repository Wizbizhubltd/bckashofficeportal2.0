import { api } from '../../app/api';
import type { NigeriaCity, NigeriaState } from './reference-data.types';

/**
 * `reference-data` tag. Static Nigeria states/cities lookup — gated only by
 * JwtAuthGuard, no capability required, any signed-in staff member can read it.
 */
export const referenceDataService = {
  listStates: (): Promise<NigeriaState[]> => api.get<NigeriaState[]>('/reference-data/states'),

  listCitiesByState: (stateId: string): Promise<NigeriaCity[]> =>
    api.get<NigeriaCity[]>(`/reference-data/states/${encodeURIComponent(stateId)}/cities`),
};

export * from './reference-data.types';
