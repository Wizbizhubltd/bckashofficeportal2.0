import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usersApi, type StaffUser } from '../api/usersApi';
import type { ModuleKey } from '../config/roles';
import { useAuth } from './AuthContext';

interface MeContextType {
  /** The signed-in user's own record, including the modules their role may open. Null until loaded. */
  me: StaffUser | null;
  loading: boolean;
  failed: boolean;
  hasModule: (module: ModuleKey) => boolean;
  reload: () => Promise<void>;
  /** Swap in a record the API just returned (e.g. after saving the profile) without refetching. */
  replace: (me: StaffUser) => void;
}

const MeContext = createContext<MeContextType | undefined>(undefined);

export function MeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const [me, setMe] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setMe(await usersApi.me());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The API rejects everything but a password change while a temporary password is in use.
    if (isAuthenticated && !mustChangePassword) {
      void reload();
    } else {
      setMe(null);
      setLoading(false);
    }
  }, [isAuthenticated, mustChangePassword, reload]);

  return (
    <MeContext.Provider
      value={{
        me,
        loading,
        failed,
        hasModule: (module) => !!me?.modules.includes(module),
        reload,
        replace: setMe,
      }}
    >
      {children}
    </MeContext.Provider>
  );
}

export function useMe() {
  const context = useContext(MeContext);
  if (context === undefined) {
    throw new Error('useMe must be used within a MeProvider');
  }
  return context;
}
