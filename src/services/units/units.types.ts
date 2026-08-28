/** `units` tag — backashbackend/src/modules/identity/units.controller.ts. */
export interface Unit {
  id: string;
  name: string;
  active: boolean;
  departmentId: string;
  departmentName: string;
  /** Every Staff record currently pointing at this unit — real, server-aggregated. */
  staffCount: number;
  createdAt: string;
}

export interface CreateUnitPayload {
  departmentId: string;
  name: string;
}

export interface UpdateUnitPayload {
  departmentId?: string;
  name?: string;
  active?: boolean;
}
