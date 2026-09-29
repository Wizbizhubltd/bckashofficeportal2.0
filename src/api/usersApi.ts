import apiClient from './apiClient';
import type { ModuleKey } from '../config/roles';

export type UserClass = 'Initiator' | 'Authorizer' | 'Reviewer';
export type OnboardingStatus = 'Approved' | 'Pending' | 'Declined';
export type Gender = 'Unspecified' | 'Male' | 'Female' | 'Other';

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** A staff account as the API returns it — the signed-in user's own record comes back in the same shape. */
export interface StaffUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  officeId: number | null;
  officeName: string | null;
  userType: string | null;
  userClass: UserClass | null;
  blocked: boolean;
  onboardingStatus: OnboardingStatus;
  onboardingApprovedDate: string | null;
  onboardingDeclinedReason: string | null;
  lastLogin: string | null;
  gender: Gender;
  address: string | null;
  notes: string | null;
  createdAt: string | null;
  createdByName: string | null;
  onboardingApprovedByName: string | null;
  dateOfBirth: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  /** Zones a director oversees (assigned by a super admin in the control portal). */
  zones: { id: number; name: string }[];
  /** Office-portal modules the super admin ticked for this user's role. */
  modules: ModuleKey[];
  missingProfileFields: string[];
  profileComplete: boolean;
}

export interface StaffListFilters {
  officeId?: number;
  userType?: string;
  onboardingStatus?: OnboardingStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  officeId: number | null;
  userTypeSlug: string;
  userClass: UserClass;
  gender: Gender;
  address: string | null;
  notes: string | null;
}

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: Gender;
  address: string | null;
  dateOfBirth: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelationship: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}

export interface Bank {
  name: string;
  category: string;
}

/**
 * Staff and profile calls. The API limits every staff call to the caller's own office(s) and to
 * staff ranked below them, so these screens never need to filter for that themselves.
 */
export const usersApi = {
  async me(): Promise<StaffUser> {
    return (await apiClient.get<StaffUser>('/users/me')).data;
  },

  async updateMyProfile(input: UpdateProfileInput): Promise<StaffUser> {
    return (await apiClient.put<StaffUser>('/users/me/profile', input)).data;
  },

  async banks(): Promise<Bank[]> {
    return (await apiClient.get<Bank[]>('/banks')).data;
  },

  async list(filters: StaffListFilters): Promise<PagedResult<StaffUser>> {
    return (await apiClient.get<PagedResult<StaffUser>>('/users', { params: { page: 1, pageSize: 20, ...filters } })).data;
  },

  async get(id: number): Promise<StaffUser> {
    return (await apiClient.get<StaffUser>(`/users/${id}`)).data;
  },

  async create(input: CreateStaffInput): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>('/users', input)).data;
  },

  async approveOnboarding(id: number): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/approve-onboarding`)).data;
  },

  async declineOnboarding(id: number, reason: string): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/decline-onboarding`, { reason })).data;
  },

  async assignOffice(id: number, officeId: number): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/assign-office`, { officeId })).data;
  },

  async changeUserClass(id: number, userClass: UserClass): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/change-user-class`, { userClass })).data;
  },

  async block(id: number): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/block`)).data;
  },

  async unblock(id: number): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/unblock`)).data;
  },

  async resetPassword(id: number): Promise<StaffUser> {
    return (await apiClient.post<StaffUser>(`/users/${id}/reset-password`)).data;
  },
};

/** "Ada Obi", falling back to the email when no name is on record. */
export function staffName(user: Pick<StaffUser, 'firstName' | 'lastName' | 'email'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}
