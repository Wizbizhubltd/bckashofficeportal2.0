import { api } from '../../app/api';
import type {
  AddRoleCapabilityPayload,
  ReplaceRoleCapabilitiesPayload,
  RoleCapabilities,
  StaffModuleAccess,
  UpdateStaffModuleAccessPayload,
} from './rbac.types';

/** `rbac` tag — backashbackend/src/platform/rbac/rbac.controller.ts. SuperAdmin only. */
export const rbacService = {
  listRoleCapabilities: (): Promise<RoleCapabilities[]> => api.get<RoleCapabilities[]>('/rbac/role-capabilities'),

  /** Overwrites the role's entire capability list — omit a capability to revoke it. */
  replaceRoleCapabilities: (role: string, payload: ReplaceRoleCapabilitiesPayload): Promise<RoleCapabilities> =>
    api.put<RoleCapabilities, ReplaceRoleCapabilitiesPayload>(`/rbac/role-capabilities/${role}`, payload),

  /** Incremental grant — idempotent, doesn't disturb the role's other capabilities. */
  addRoleCapability: (role: string, payload: AddRoleCapabilityPayload): Promise<RoleCapabilities> =>
    api.post<RoleCapabilities, AddRoleCapabilityPayload>(`/rbac/role-capabilities/${role}/capabilities`, payload),

  /** Incremental revoke — idempotent either way. */
  removeRoleCapability: (role: string, capability: string): Promise<RoleCapabilities> =>
    api.delete<RoleCapabilities>(`/rbac/role-capabilities/${role}/capabilities/${encodeURIComponent(capability)}`),

  /** Module access (LOANS/ACCOUNTING/HR) is a separate dimension from role/capability. */
  updateStaffModuleAccess: (staffId: string, payload: UpdateStaffModuleAccessPayload): Promise<StaffModuleAccess> =>
    api.put<StaffModuleAccess, UpdateStaffModuleAccessPayload>(`/rbac/staff-module-access/${staffId}`, payload),
};

export * from './rbac.types';
