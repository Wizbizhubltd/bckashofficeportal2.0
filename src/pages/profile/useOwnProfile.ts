import { useCallback, useEffect, useState } from 'react';
import { staffService, type Staff } from '../../services/staff/staff.service';

/**
 * GET /staff/me — every profile page (see Profile.tsx and its five
 * role-specific pages) loads through this same hook, so "my own record" is
 * fetched and refreshed the same way regardless of which role is looking at it.
 */
export function useOwnProfile() {
  const [profile, setProfile] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await staffService.getMe();
      setProfile(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, isLoading, error, reload, setProfile };
}
