import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2Icon, MapIcon, UsersIcon } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useRolePath } from '../../hooks/useRolePath';
import type { OfficeSummary } from '../dashboard/DirectorDashboard';

interface ZoneSummary {
  id: number;
  name: string;
  description: string | null;
  officeCount: number;
  staffCount: number;
}

/** The zones a super admin assigned to this director, each with every office in it. */
export function MyOfficesPage() {
  const rolePath = useRolePath();
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [offices, setOffices] = useState<OfficeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.get<ZoneSummary[]>('/zones'), apiClient.get<OfficeSummary[]>('/offices')])
      .then(([zoneResponse, officeResponse]) => {
        setZones(zoneResponse.data);
        setOffices(officeResponse.data);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load your zones.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-primary">My Zones & Offices</h1>
        <p className="text-sm text-gray-500 mt-1">
          {zones.length} zone{zones.length === 1 ? '' : 's'} and {offices.length} office{offices.length === 1 ? '' : 's'} under you. Zones are assigned by a super admin.
        </p>
      </div>

      {zones.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No zones have been assigned to you yet. A super admin assigns directors their zones from the Control Portal.
        </div>
      )}

      {zones.map((zone) => {
        const zoneOffices = offices.filter((o) => o.zoneId === zone.id);
        return (
          <section key={zone.id} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapIcon size={18} />
                </span>
                <div>
                  <h2 className="font-heading text-base font-bold text-slate-800">{zone.name}</h2>
                  {zone.description && <p className="text-xs text-slate-400">{zone.description}</p>}
                </div>
              </div>
              <div className="flex gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Building2Icon size={14} /> {zone.officeCount} offices
                </span>
                <span className="flex items-center gap-1.5">
                  <UsersIcon size={14} /> {zone.staffCount} staff
                </span>
              </div>
            </div>

            {zoneOffices.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No offices in this zone yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {zoneOffices.map((office) => (
                  <Link
                    key={office.id}
                    to={rolePath(`/offices/${office.id}`)}
                    className="group rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-heading font-semibold text-slate-800 group-hover:text-primary">{office.name ?? `Office #${office.id}`}</p>
                      {!office.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{office.officeCode ?? '—'}</p>
                    <p className="mt-3 text-sm text-slate-500">{[office.cityName, office.stateName].filter(Boolean).join(', ') || 'No location'}</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {office.staffCount} staff member{office.staffCount === 1 ? '' : 's'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
