import { ReactNode } from 'react';
import { AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { ProfileHeaderCard } from './ProfileHeaderCard';
import { ProfileChangePasswordCard } from './ProfileChangePasswordCard';
import { ProfilePersonalInfoCard } from './ProfilePersonalInfoCard';
import { useOwnProfile } from './useOwnProfile';

/**
 * Common scaffold for every role's profile page: loads GET /staff/me, shows
 * the read-only header + the shared editable info/password cards, and lets
 * the caller slot in whatever's role-specific (see each ProfileXxx.tsx's
 * `extra` — the one part that's genuinely different per role).
 */
export function ProfilePageShell({ title, extra }: { title: string; extra?: ReactNode }) {
  const { profile, isLoading, error, setProfile } = useOwnProfile();
  const departments = useAppSelector((state) => state.lookups.departments);
  const units = useAppSelector((state) => state.lookups.roles);
  const branches = useAppSelector((state) => state.lookups.branches);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <LoaderIcon size={24} className="animate-spin mr-3" />
        Loading your profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <AlertCircleIcon size={18} className="flex-shrink-0" />
        {error ?? 'Could not load your profile.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-heading font-bold text-primary">{title}</h2>

      <ProfileHeaderCard
        profile={profile}
        departmentName={departments.find((d) => d.id === profile.departmentId)?.name}
        unitName={units.find((u) => u.id === profile.unitId)?.name}
        branchName={branches.find((b) => b.id === profile.branchId)?.name}
      />

      {extra}

      <ProfilePersonalInfoCard profile={profile} onUpdated={setProfile} />
      <ProfileChangePasswordCard />
    </div>
  );
}
