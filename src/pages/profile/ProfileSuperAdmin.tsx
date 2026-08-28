import { Building2Icon } from 'lucide-react';
import { ProfilePageShell } from './ProfilePageShell';
import { ProfileQuickLinkCard } from './ProfileQuickLinkCard';

/**
 * SuperAdmin is the only role that manages organization details (see
 * Settings.tsx's own note — "the only organisation that should exist should
 * be when a super admin is updating organization details") — that's the one
 * operation this profile page surfaces that no other role's does.
 */
export function ProfileSuperAdmin() {
  return (
    <ProfilePageShell
      title="My Profile"
      extra={
        <ProfileQuickLinkCard
          icon={Building2Icon}
          title="Organization Settings"
          description="Update the organization's own details — name, contact info, branding."
          to="/settings"
          cta="Manage"
        />
      }
    />
  );
}
