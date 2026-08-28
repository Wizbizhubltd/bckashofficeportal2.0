import { api } from '../../app/api';
import { compressImageFile } from '../../utils/image-compression';
import type { CreateOrganisationPayload, Organisation, UpdateOrganisationPayload } from './organisation.types';

/**
 * `organisation` tag — backashbackend/src/modules/organisation. Singleton:
 * `get()` 404s until `create()` has been called once; `create()` 409s if
 * one already exists — use `update()` instead, or `remove()` first to
 * start over (e.g. to change the unique `businessRegNumber`).
 */
export const organisationService = {
  /**
   * 404s until `create()` has been called once — that's an expected,
   * routine state ("not set up yet"), not a failure, so the toast that
   * `api.get` would otherwise fire is suppressed here; callers should
   * check `error.status === 404` themselves to distinguish "not set up"
   * from a real load failure.
   */
  get: (): Promise<Organisation> => api.get<Organisation>('/organisation', { suppressErrorToast: true }),

  /** SuperAdmin/Admin only. */
  create: (payload: CreateOrganisationPayload): Promise<Organisation> =>
    api.post<Organisation, CreateOrganisationPayload>('/organisation', payload),

  /** SuperAdmin/Admin only. Only the fields present are changed. */
  update: (payload: UpdateOrganisationPayload): Promise<Organisation> =>
    api.patch<Organisation, UpdateOrganisationPayload>('/organisation', payload),

  /** SuperAdmin/Admin only — the only way to start over on the singleton. */
  remove: (): Promise<void> => api.delete<void>('/organisation'),

  /** SuperAdmin/Admin only. Compressed client-side before upload when it's an image — a PDF passes through untouched, see utils/image-compression. */
  uploadCacDoc: async (file: File): Promise<Organisation> => {
    const formData = new FormData();
    formData.append('cacDoc', await compressImageFile(file));
    return api.post<Organisation, FormData>('/organisation/cac-doc', formData);
  },

  /** Any authenticated staff member. Null if none has been uploaded yet. */
  getCacDocSignedUrl: (expiresInSeconds?: number): Promise<{ url: string | null }> =>
    api.get<{ url: string | null }>('/organisation/cac-doc/signed-url', expiresInSeconds ? { params: { expiresInSeconds } } : undefined),
};

export * from './organisation.types';
