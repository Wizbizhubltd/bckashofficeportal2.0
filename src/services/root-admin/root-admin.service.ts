import { api } from '../../app/api';

export interface RootAdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isRootAdmin: boolean;
}

export interface RootAdminLoginPayload {
  email: string;
  password: string;
}

export interface RootAdminLoginResponse {
  token: string;
  user: RootAdminUser;
}

interface RootAdminLoginApiResponse {
  token?: string;
  user?: RootAdminUser;
  payload?: {
    token?: string;
    user?: RootAdminUser;
  };
}

type ApiEnvelope<T> = T & {
  payload?: T;
};

export interface CreateOrganizationPayload {
  name: string;
  address: string;
  companyRegistrationNumber: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  taxId?: string;
  temporaryPassword?: string;
  superAdmin: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface OrganizationRecord {
  id: string;
  name: string;
  address: string;
  companyRegistrationNumber: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  taxId?: string;
  isSetupComplete: boolean;
  isActive: boolean;
  createdAt: string;
}

interface GetOrganizationsResponse {
  data: OrganizationRecord[];
  count: number;
}

export interface OrganizationDetailsResponse {
 payload: {
  organization: OrganizationRecord;
  superAdmins: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    isActive: boolean;

  }>;
 };
 success: boolean;
}

interface NotifyOrganizationPayload {
  subject: string;
  message: string;
}

interface NotifyOrganizationResponse {
  message: string;
  recipients: string[];
}

interface DisableOrganizationResponse {
  message: string;
  data: OrganizationRecord;
}

interface CreateOrganizationResponse {
  message: string;
  data: {
    organization: OrganizationRecord;
    superAdmin: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      userLevel: string;
      mustChangePassword: boolean;
    };
  };
}

export const ROOT_ADMIN_TOKEN_KEY = 'root_admin_token';
export const ROOT_ADMIN_OPERATION_KEY_STORAGE = 'root_admin_operation_key';

export const getRootAdminToken = (): string | null => localStorage.getItem(ROOT_ADMIN_TOKEN_KEY);
export const clearRootAdminSession = (): void => {
  localStorage.removeItem(ROOT_ADMIN_TOKEN_KEY);
};

const rootAdminAuthHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const rootAdminService = {
  login: async (payload: RootAdminLoginPayload): Promise<RootAdminLoginResponse> => {
    const response = await api.post<RootAdminLoginApiResponse, RootAdminLoginPayload>('/root-admin/login', payload);
    const token = response.token ?? response.payload?.token;
    const user = response.user ?? response.payload?.user;

    if (!token || !user) {
      throw new Error('Invalid root admin login response');
    }

    return { token, user };
  },

  getOrganizations: async (token: string): Promise<GetOrganizationsResponse> => {
    const response = await api.get<ApiEnvelope<GetOrganizationsResponse>>('/root-admin/organizations', {
      headers: rootAdminAuthHeader(token),
    });

    const normalized = response.data ? response : response.payload;
    if (!normalized?.data) {
      throw new Error('Invalid organizations response');
    }

    return {
      data: normalized.data,
      count: normalized.count ?? normalized.data.length,
    };
  },

  createOrganization: async (
    token: string,
    operationKey: string,
    payload: CreateOrganizationPayload,
  ): Promise<CreateOrganizationResponse> => {
    const response = await api.post<ApiEnvelope<CreateOrganizationResponse>, CreateOrganizationPayload>(
      '/root-admin/organizations',
      payload,
      {
        headers: {
          ...rootAdminAuthHeader(token),
          'x-root-admin-key': operationKey,
        },
      },
    );

    const normalized = response.data ? response : response.payload;
    if (!normalized?.data) {
      throw new Error('Invalid create organization response');
    }

    return normalized;
  },

  getOrganizationById: async (token: string, organizationId: string): Promise<OrganizationDetailsResponse> => {
    const response = await api.get<ApiEnvelope<OrganizationDetailsResponse>>(
      `/root-admin/organizations/${organizationId}`,
      {
        headers: rootAdminAuthHeader(token),
      },
    );

    const normalized = response.payload ? response : response.payload;
    if (!normalized) {
      throw new Error('Invalid organization details response');
    }

    return normalized;
  },

  disableOrganization: async (
    token: string,
    operationKey: string,
    organizationId: string,
  ): Promise<DisableOrganizationResponse> => {
    const response = await api.patch<ApiEnvelope<DisableOrganizationResponse>>(
      `/root-admin/organizations/${organizationId}/disable`,
      undefined,
      {
        headers: {
          ...rootAdminAuthHeader(token),
          'x-root-admin-key': operationKey,
        },
      },
    );

    const normalized = response.data ? response : response.payload;
    if (!normalized?.message) {
      throw new Error('Invalid disable organization response');
    }

    return normalized;
  },

  notifyOrganization: async (
    token: string,
    operationKey: string,
    organizationId: string,
    payload: NotifyOrganizationPayload,
  ): Promise<NotifyOrganizationResponse> => {
    const response = await api.post<ApiEnvelope<NotifyOrganizationResponse>, NotifyOrganizationPayload>(
      `/root-admin/organizations/${organizationId}/notifications`,
      payload,
      {
        headers: {
          ...rootAdminAuthHeader(token),
          'x-root-admin-key': operationKey,
        },
      },
    );

    const normalized = response.recipients ? response : response.payload;
    if (!normalized?.message) {
      throw new Error('Invalid notification response');
    }

    return {
      message: normalized.message,
      recipients: normalized.recipients ?? [],
    };
  },
};
