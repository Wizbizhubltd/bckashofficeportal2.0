import { api } from '../../app/api';
import type { CreateUnitPayload, Unit, UpdateUnitPayload } from './units.types';

/**
 * `units` tag. Same `org:manage` capability gate as `departments` — a unit
 * always belongs to exactly one department (see `departmentId`).
 */
export const unitsService = {
  create: (payload: CreateUnitPayload): Promise<Unit> =>
    api.post<Unit, CreateUnitPayload>('/units', payload),

  /** Optionally scoped to a single department. */
  list: (departmentId?: string): Promise<Unit[]> =>
    api.get<Unit[]>('/units', departmentId ? { params: { departmentId } } : undefined),

  getById: (id: string): Promise<Unit> => api.get<Unit>(`/units/${id}`),

  update: (id: string, payload: UpdateUnitPayload): Promise<Unit> =>
    api.patch<Unit, UpdateUnitPayload>(`/units/${id}`, payload),

  /** Hard delete — the backend rejects this while any Staff record still references the unit. */
  remove: (id: string): Promise<{ deleted: true }> => api.delete<{ deleted: true }>(`/units/${id}`),
};

export * from './units.types';
