import { BadgeCheckIcon, ClockIcon } from 'lucide-react';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import type { Staff } from '../../services/staff/staff.service';
import { toTitleCase } from '../../utils/staff-display';

const ROLE_LABEL: Record<Staff['role'], string> = {
  MARKETER: 'Marketer',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
  SUPERADMIN: 'Super Admin',
  APPROVER: 'Approver',
};

/**
 * Read-only summary shared by every role's profile page — name, role,
 * status, and (if set) the passport photo already on file. Org-managed
 * fields (department/unit/branch/email) are shown here but never editable
 * from this page — see ProfilePersonalInfoCard for what actually is.
 */
export function ProfileHeaderCard({
  profile,
  departmentName,
  unitName,
  branchName,
}: {
  profile: Staff;
  departmentName?: string;
  unitName?: string;
  branchName?: string;
}) {
  const fullName = toTitleCase(`${profile.firstName} ${profile.lastName}`.trim());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
      <ProfileAvatar
        src={profile.passportPhotoUrl ?? undefined}
        name={fullName}
        alt="Profile photo"
        className="w-20 h-20 rounded-full border-2 border-gray-100 flex-shrink-0"
        iconSize={32}
      />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-heading font-bold text-primary truncate">{fullName}</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-heading font-medium bg-primary/10 text-primary">
            {ROLE_LABEL[profile.role] ?? profile.role}
          </span>
          {profile.bvnVerified && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-heading font-medium bg-green-100 text-green-800">
              <BadgeCheckIcon size={12} /> BVN Verified
            </span>
          )}
          {profile.mustChangePassword && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-heading font-medium bg-yellow-100 text-yellow-800">
              <ClockIcon size={12} /> Password change pending
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">{profile.email}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-sm">
          <p className="text-gray-500">
            Department: <span className="text-gray-700 font-medium">{departmentName ?? '—'}</span>
          </p>
          <p className="text-gray-500">
            Unit: <span className="text-gray-700 font-medium">{unitName ?? '—'}</span>
          </p>
          <p className="text-gray-500">
            Branch: <span className="text-gray-700 font-medium">{branchName ?? '—'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
