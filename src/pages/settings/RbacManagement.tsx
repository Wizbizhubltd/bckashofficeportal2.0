import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { PlusIcon, XIcon, PencilIcon, Loader2Icon, ShieldIcon, UsersIcon, SearchIcon } from 'lucide-react';
import { rbacService, KNOWN_CAPABILITIES, type ModuleName, type RoleCapabilities } from '../../services/rbac/rbac.service';
import { staffService } from '../../services/staff/staff.service';
import type { Staff } from '../../services/staff/staff.types';
import type { StaffRole } from '../../services/auth/auth.types';

// Same local pattern as DepartmentsRoles.tsx/LoanProductsCrud.tsx/etc — this
// codebase keeps one small ModalWrapper per settings page rather than a
// shared component.
function ModalWrapper({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Fixed display order, independent of whatever order GET /rbac/role-capabilities
// happens to return — every role is seeded on boot (see RbacService.onModuleInit)
// so all five are always expected to be present.
const ROLE_ORDER: readonly StaffRole[] = ['SUPERADMIN', 'ADMIN', 'APPROVER', 'MANAGER', 'MARKETER'];

const MODULE_OPTIONS: { value: ModuleName; label: string }[] = [
  { value: 'LOANS', label: 'Loans' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'HR', label: 'HR' },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** `role:capability` — a stable per-chip busy key while a revoke is in flight. */
function chipKey(role: string, capability: string): string {
  return `${role}::${capability}`;
}

export function RbacManagement() {
  const [roleCapabilities, setRoleCapabilities] = useState<RoleCapabilities[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [grantingRole, setGrantingRole] = useState<StaffRole | null>(null);
  const [removingChip, setRemovingChip] = useState<string | null>(null);

  // Bulk edit modal — the distinct "replace the whole capability set" operation
  // (PUT /rbac/role-capabilities/:role), separate from the incremental
  // grant/revoke above.
  const [bulkEditRole, setBulkEditRole] = useState<StaffRole | null>(null);
  const [bulkEditList, setBulkEditList] = useState<string[]>([]);
  const [bulkEditInput, setBulkEditInput] = useState('');
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<ModuleName>>(new Set());
  const [isSavingModules, setIsSavingModules] = useState(false);

  async function loadRoleCapabilities() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await rbacService.listRoleCapabilities();
      setRoleCapabilities(result);
    } catch (error) {
      setLoadError(errorMessage(error, 'Failed to load role capabilities'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRoleCapabilities();
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoadingStaff(true);
      setStaffLoadError(null);
      try {
        const result = await staffService.list();
        if (isMounted) setStaff(result);
      } catch (error) {
        if (isMounted) setStaffLoadError(errorMessage(error, 'Failed to load staff'));
      } finally {
        if (isMounted) setIsLoadingStaff(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const capabilitiesByRole = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of roleCapabilities ?? []) {
      map.set(entry.role, entry.capabilities);
    }
    return map;
  }, [roleCapabilities]);

  const capabilitySuggestions = useMemo(() => KNOWN_CAPABILITIES, []);

  const staffOptions = useMemo(
    () =>
      (staff ?? []).map((member) => ({
        value: member.id,
        label: `${member.firstName} ${member.lastName} — ${member.email} (${member.role})`,
      })),
    [staff],
  );
  const selectedStaff = useMemo(
    () => (staff ?? []).find((member) => member.id === selectedStaffId) ?? null,
    [staff, selectedStaffId],
  );

  function selectStaff(staffId: string | null) {
    setSelectedStaffId(staffId);
    const member = (staff ?? []).find((m) => m.id === staffId);
    // Best-effort prefill from the Staff record's own moduleAccess field —
    // the RBAC-enforced source of truth is the separate staff_module_access
    // collection this page writes to (no GET exists for it on the swagger
    // doc), so this is a starting point, not a guaranteed mirror. Saving
    // below always writes the real, enforced record regardless.
    setSelectedModules(new Set(member?.moduleAccess ?? []));
  }

  async function handleGrantCapability(role: StaffRole) {
    const capability = (grantInputs[role] ?? '').trim();
    if (!capability) {
      toast.error('Enter a capability to grant');
      return;
    }
    try {
      setGrantingRole(role);
      const updated = await rbacService.addRoleCapability(role, { capability });
      setRoleCapabilities((prev) => replaceOrAppend(prev, updated));
      setGrantInputs((prev) => ({ ...prev, [role]: '' }));
      toast.success(`Granted "${capability}" to ${role}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to grant capability'));
    } finally {
      setGrantingRole(null);
    }
  }

  async function handleRevokeCapability(role: StaffRole, capability: string) {
    try {
      setRemovingChip(chipKey(role, capability));
      const updated = await rbacService.removeRoleCapability(role, capability);
      setRoleCapabilities((prev) => replaceOrAppend(prev, updated));
      toast.success(`Revoked "${capability}" from ${role}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to revoke capability'));
    } finally {
      setRemovingChip(null);
    }
  }

  function openBulkEdit(role: StaffRole) {
    setBulkEditRole(role);
    setBulkEditList([...(capabilitiesByRole.get(role) ?? [])]);
    setBulkEditInput('');
  }
  function closeBulkEdit() {
    setBulkEditRole(null);
    setBulkEditList([]);
    setBulkEditInput('');
  }
  function addToBulkEditList() {
    const value = bulkEditInput.trim();
    if (!value || bulkEditList.includes(value)) {
      setBulkEditInput('');
      return;
    }
    setBulkEditList((prev) => [...prev, value]);
    setBulkEditInput('');
  }
  function removeFromBulkEditList(value: string) {
    setBulkEditList((prev) => prev.filter((c) => c !== value));
  }
  async function handleSaveBulkEdit() {
    if (!bulkEditRole) return;
    try {
      setIsSavingBulk(true);
      const updated = await rbacService.replaceRoleCapabilities(bulkEditRole, { capabilities: bulkEditList });
      setRoleCapabilities((prev) => replaceOrAppend(prev, updated));
      toast.success(`Replaced ${bulkEditRole}'s capability set (${bulkEditList.length} capabilities)`);
      closeBulkEdit();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to replace capability set'));
    } finally {
      setIsSavingBulk(false);
    }
  }

  function toggleModule(module: ModuleName) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }

  async function handleSaveModuleAccess() {
    if (!selectedStaffId) {
      toast.error('Select a staff member first');
      return;
    }
    try {
      setIsSavingModules(true);
      await rbacService.updateStaffModuleAccess(selectedStaffId, { modules: [...selectedModules] });
      toast.success('Module access updated');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update module access'));
    } finally {
      setIsSavingModules(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ─── Role Capabilities ───────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldIcon size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">Role Capabilities</h3>
            <p className="text-sm font-body text-gray-500">
              Grant, revoke, or fully replace a role's capability set. Changes apply immediately, no redeploy needed.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <p className="text-sm font-body text-gray-400 text-center py-6">Loading role capabilities…</p>
          ) : loadError ? (
            <div className="text-center py-6">
              <p className="text-sm font-body text-red-600 mb-3">{loadError}</p>
              <button
                onClick={() => void loadRoleCapabilities()}
                className="px-4 py-2 text-sm font-heading font-bold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {ROLE_ORDER.map((role) => {
                const capabilities = capabilitiesByRole.get(role) ?? [];
                return (
                  <div key={role} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-heading font-bold bg-primary/10 text-primary">
                          {role}
                        </span>
                        <span className="text-xs font-body text-gray-400">
                          {capabilities.length} capabilit{capabilities.length === 1 ? 'y' : 'ies'}
                        </span>
                      </div>
                      <button
                        onClick={() => openBulkEdit(role)}
                        className="flex items-center gap-1.5 text-xs font-body text-primary hover:text-primary/80 transition-colors"
                      >
                        <PencilIcon size={12} />
                        Bulk edit
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {capabilities.length === 0 && (
                        <span className="text-xs font-body text-gray-400 italic">No capabilities granted</span>
                      )}
                      {capabilities.map((capability) => {
                        const key = chipKey(role, capability);
                        const busy = removingChip === key;
                        return (
                          <span
                            key={capability}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body bg-gray-100 text-gray-700"
                          >
                            {capability}
                            <button
                              onClick={() => void handleRevokeCapability(role, capability)}
                              disabled={busy}
                              title={`Revoke ${capability}`}
                              className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2Icon size={11} className="animate-spin" /> : <XIcon size={11} />}
                            </button>
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        list="rbac-capability-suggestions"
                        value={grantInputs[role] ?? ''}
                        onChange={(e) => setGrantInputs((prev) => ({ ...prev, [role]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleGrantCapability(role);
                          }
                        }}
                        placeholder="e.g. workflow:initiate:STAFF"
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                      <button
                        onClick={() => void handleGrantCapability(role)}
                        disabled={grantingRole === role}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-heading font-bold hover:bg-[#e64a19] transition-colors disabled:opacity-50"
                      >
                        {grantingRole === role ? (
                          <Loader2Icon size={12} className="animate-spin" />
                        ) : (
                          <PlusIcon size={12} />
                        )}
                        Grant
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <datalist id="rbac-capability-suggestions">
        {capabilitySuggestions.map((capability) => (
          <option key={capability} value={capability} />
        ))}
      </datalist>

      {/* Bulk edit modal */}
      <ModalWrapper isOpen={bulkEditRole !== null} onClose={closeBulkEdit}>
        <button
          onClick={closeBulkEdit}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <XIcon size={18} />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <ShieldIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">Replace {bulkEditRole}'s capability set</h3>
            <p className="text-xs font-body text-gray-500">
              Overwrites the entire list — anything left off is revoked, not just what you remove below.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3 max-h-48 overflow-y-auto">
          {bulkEditList.length === 0 && (
            <span className="text-xs font-body text-gray-400 italic">No capabilities — this role will have none</span>
          )}
          {bulkEditList.map((capability) => (
            <span
              key={capability}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body bg-gray-100 text-gray-700"
            >
              {capability}
              <button
                onClick={() => removeFromBulkEditList(capability)}
                className="text-gray-400 hover:text-red-600 transition-colors"
              >
                <XIcon size={11} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-5">
          <input
            list="rbac-capability-suggestions"
            value={bulkEditInput}
            onChange={(e) => setBulkEditInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addToBulkEditList();
              }
            }}
            placeholder="Add a capability to the list"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <button
            onClick={addToBulkEditList}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-heading font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <PlusIcon size={14} />
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={closeBulkEdit}
            className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSaveBulkEdit()}
            disabled={isSavingBulk}
            className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSavingBulk ? 'Saving...' : 'Replace capability set'}
          </button>
        </div>
      </ModalWrapper>

      {/* ─── Staff Module Access ─────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <UsersIcon size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">Staff Module Access</h3>
            <p className="text-sm font-body text-gray-500">
              LOANS/ACCOUNTING/HR access is separate from role — grant or revoke it per staff member here.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {staffLoadError ? (
            <p className="text-sm font-body text-red-600">{staffLoadError}</p>
          ) : (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-body font-medium text-gray-600 mb-1.5">
                <SearchIcon size={12} />
                Staff member
              </label>
              <Select
                options={staffOptions}
                isLoading={isLoadingStaff}
                isClearable
                value={staffOptions.find((o) => o.value === selectedStaffId) ?? null}
                onChange={(option) => selectStaff(option?.value ?? null)}
                placeholder="Search by name or email..."
                noOptionsMessage={() => 'No staff found'}
                classNamePrefix="rbac-staff-select"
                // The "Staff Module Access" card above is `overflow-hidden`
                // (for its rounded corners) — the dropdown menu renders
                // inline by default, so it was getting clipped by that
                // ancestor instead of floating above the rest of the page.
                // Portalling it to <body> (react-select's own documented fix
                // for exactly this) escapes any ancestor's overflow/z-index
                // entirely; menuPosition="fixed" keeps it tracking the
                // control correctly since the portal is now outside this
                // scrollable card.
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            </div>
          )}

          {selectedStaff && (
            <div className="border border-gray-100 rounded-lg p-4">
              <p className="text-sm font-heading font-bold text-gray-900 mb-3">
                {selectedStaff.firstName} {selectedStaff.lastName}
                <span className="ml-2 text-xs font-body font-normal text-gray-400">{selectedStaff.role}</span>
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                {MODULE_OPTIONS.map((moduleOption) => (
                  <label
                    key={moduleOption.value}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-primary/20 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.has(moduleOption.value)}
                      onChange={() => toggleModule(moduleOption.value)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                    />
                    <span className="text-sm font-body text-gray-700">{moduleOption.label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => void handleSaveModuleAccess()}
                disabled={isSavingModules}
                className="px-4 py-2 text-sm font-heading font-bold bg-accent text-white rounded-lg hover:bg-[#e64a19] transition-colors disabled:opacity-50"
              >
                {isSavingModules ? 'Saving...' : 'Save Module Access'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

      </div>
    </div>
  );
}

function replaceOrAppend(
  list: RoleCapabilities[] | null,
  updated: RoleCapabilities,
): RoleCapabilities[] {
  const current = list ?? [];
  const exists = current.some((entry) => entry.role === updated.role);
  return exists ? current.map((entry) => (entry.role === updated.role ? updated : entry)) : [...current, updated];
}
