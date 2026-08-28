import { ShieldCheckIcon } from 'lucide-react';
import { ProfilePageShell } from './ProfilePageShell';
import { ProfileQuickLinkCard } from './ProfileQuickLinkCard';

/** Admin is a maker-checker approval role (see APPROVAL_ROLES in App.tsx) — surface that shortcut here. */
export function ProfileAdmin() {
  return (
    <ProfilePageShell
      title="My Profile"
      extra={
        <ProfileQuickLinkCard
          icon={ShieldCheckIcon}
          title="Loan Approvals"
          description="Review loan requests awaiting your approval."
          to="/loan-manager/approvals"
          cta="Review"
        />
      }
    />
  );
}
