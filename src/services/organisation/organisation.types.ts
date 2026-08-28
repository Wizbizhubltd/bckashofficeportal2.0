/** `organisation` tag — backashbackend/src/modules/organisation. A platform-level singleton: exactly one profile can ever exist. */
export interface OrganisationAccountDetail {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface Organisation {
  id: string;
  nameOfOrg: string;
  address: string;
  phoneNumbers: string[];
  organisationAccountDetails: OrganisationAccountDetail[];
  briefHistory: string;
  businessRegNumber: string;
  cbnLicenseNumber: string | null;
  contactEmail: string | null;
  /** The CAC document itself is never returned inline — see GET /organisation/cac-doc/signed-url. */
  cacDocUploaded: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /organisation — SuperAdmin/Admin only. Fails if a profile already exists (see remove()). Every field required except cbnLicenseNumber/contactEmail. */
export interface CreateOrganisationPayload {
  nameOfOrg: string;
  address: string;
  phoneNumbers: string[];
  organisationAccountDetails: OrganisationAccountDetail[];
  briefHistory: string;
  businessRegNumber: string;
  cbnLicenseNumber?: string;
  contactEmail?: string;
}

/** PATCH /organisation — every field optional; organisationAccountDetails/phoneNumbers, when present, replace the whole array. */
export type UpdateOrganisationPayload = Partial<CreateOrganisationPayload>;
