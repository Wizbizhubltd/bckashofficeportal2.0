import { UserCogIcon } from 'lucide-react';
import { ProfilePageShell } from './ProfilePageShell';
import { ProfileQuickLinkCard } from './ProfileQuickLinkCard';

/** Managers onboard Marketers and oversee their branch's staff (see STAFF_MANAGERS in App.tsx). */
export function ProfileManager() {
  return (
    <ProfilePageShell
      title="My Profile"
      extra={
        <ProfileQuickLinkCard
          icon={UserCogIcon}
          title="Staff Management"
          description="View and manage the staff in your branch."
          to="/staff-management"
          cta="View Team"
        />
      }
    />
  );
}
