import { ShieldCheckIcon } from 'lucide-react';
import { ProfilePageShell } from './ProfilePageShell';
import { ProfileQuickLinkCard } from './ProfileQuickLinkCard';

/** Clearing the approval queue is the Approver's entire job (see roleHomeRoute in role.util.ts). */
export function ProfileApprover() {
  return (
    <ProfilePageShell
      title="My Profile"
      extra={
        <ProfileQuickLinkCard
          icon={ShieldCheckIcon}
          title="Approval Queue"
          description="Jump back into the requests waiting on your decision."
          to="/loan-manager/approvals"
          cta="Review"
        />
      }
    />
  );
}
