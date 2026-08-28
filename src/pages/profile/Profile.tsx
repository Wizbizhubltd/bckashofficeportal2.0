import { useAuth } from '../../context/AuthContext';
import { ProfileAdmin } from './ProfileAdmin';
import { ProfileApprover } from './ProfileApprover';
import { ProfileManager } from './ProfileManager';
import { ProfileMarketer } from './ProfileMarketer';
import { ProfileSuperAdmin } from './ProfileSuperAdmin';

/**
 * /profile — one route, five different pages behind it. Every role lands
 * here through the same "My Profile" sidebar link (see Sidebar.tsx), but
 * what they can actually do once there differs by role (see each
 * ProfileXxx.tsx's own doc comment for what makes it distinct), so this
 * just dispatches to the right one rather than trying to be one
 * one-size-fits-all form.
 */
export function Profile() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'super_admin':
      return <ProfileSuperAdmin />;
    case 'admin':
      return <ProfileAdmin />;
    case 'manager':
      return <ProfileManager />;
    case 'approver':
      return <ProfileApprover />;
    case 'marketer':
    default:
      return <ProfileMarketer />;
  }
}
