import { api } from '../../app/api';
import type {
  CreateDepartmentPayload,
  Department,
  RawDepartment,
  UpdateDepartmentPayload,
} from './departments.types';

const normalizeDepartment = (raw: RawDepartment): Department => ({
  id: raw.id,
  name: raw.name,
  active: raw.active,
  staffCount: raw.staffCount,
  createdAt: raw.createdAt,
});

/**
 * `departments` tag. Gated server-side by the `org:manage` capability
 * (ADMIN/SUPERADMIN only, see default-role-capabilities.ts) — every method
 * here will 403 for MANAGER/APPROVER/MARKETER, so callers should check the
 * signed-in role before calling.
 */
export const departmentsService = {
  create: async (payload: CreateDepartmentPayload): Promise<Department> =>
    normalizeDepartment(await api.post<RawDepartment, CreateDepartmentPayload>('/departments', payload)),

  list: async (): Promise<Department[]> => {
    const raw = await api.get<RawDepartment[]>('/departments');
    return raw.map(normalizeDepartment);
  },

  getById: async (id: string): Promise<Department> =>
    normalizeDepartment(await api.get<RawDepartment>(`/departments/${id}`)),

  update: async (id: string, payload: UpdateDepartmentPayload): Promise<Department> =>
    normalizeDepartment(await api.patch<RawDepartment, UpdateDepartmentPayload>(`/departments/${id}`, payload)),

  /** Hard delete — the backend rejects this while any Staff or Unit still references the department. */
  remove: (id: string): Promise<{ deleted: true }> => api.delete<{ deleted: true }>(`/departments/${id}`),
};

export * from './departments.types';
