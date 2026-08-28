/**
 * `departments` tag — backashbackend/src/modules/identity/departments.controller.ts.
 * The controller returns `DepartmentResponseDto` (`id`, already normalized —
 * not the raw Mongoose `_id` shape) including a real, server-aggregated
 * `staffCount` (every Staff record currently pointing at this department).
 */
export interface RawDepartment {
  id: string;
  name: string;
  active: boolean;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  active: boolean;
  staffCount: number;
  createdAt: string;
}

export interface CreateDepartmentPayload {
  name: string;
}

export interface UpdateDepartmentPayload {
  name?: string;
  active?: boolean;
}
