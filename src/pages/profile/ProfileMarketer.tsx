import { UserPlusIcon } from 'lucide-react';
import { ProfilePageShell } from './ProfilePageShell';
import { ProfileQuickLinkCard } from './ProfileQuickLinkCard';

/** Marketers are the ones onboarding customers day-to-day (see the Loans module in Sidebar.tsx). */
export function ProfileMarketer() {
  return (
    <ProfilePageShell
      title="My Profile"
      extra={
        <ProfileQuickLinkCard
          icon={UserPlusIcon}
          title="Customer Onboarding"
          description="Start onboarding a new customer."
          to="/onboarding/customer"
          cta="Onboard"
        />
      }
    />
  );
}
