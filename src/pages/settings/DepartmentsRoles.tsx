import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormik } from 'formik';
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  BuildingIcon,
  ShieldIcon,
  CheckCircleIcon,
  UsersIcon,
  BriefcaseIcon,
  Loader2Icon,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { departmentSchema, roleSchema } from '../../validators/nonAuthSchemas';
import { departmentsService } from '../../services/departments/departments.service';
import { unitsService } from '../../services/units/units.service';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { hydrateLookups, markLookupsStale, upsertDepartmentScoped, upsertRoleScoped } from '../../store/slices/lookupsSlice';

// ─── Types ──────────────────────────────────────────────────────
interface Department {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  staffCount: number;
  dateCreated: string;
}
interface Role {
  id: string;
  name: string;
  department: string;
  staffCount: number;
  status: 'Active' | 'Inactive';
  dateCreated: string;
}

// ─── Shared helpers ─────────────────────────────────────────────
const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const selectClass = `${inputClass} bg-white`;

function formatDateDDMMYYYY(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${parsed.getFullYear()}`;
}

// backashbackend's org-structure.seeder.ts (seedOrgStructure) bootstraps a
// Department AND Unit both literally named "Unassigned" purely to give the
// seeded SuperAdmin account somewhere valid to point its required
// departmentId/unitId — that seeder's own doc comment is explicit this
// "is bootstrap scaffolding for the SuperAdmin account only, not meant to
// read as a real, pre-populated department the org actually has." Hidden
// from this page's lists (not deleted, and not filtered out of any other
// page's own department/role lookups) so the coop's real org chart isn't
// cluttered with it; matched by name (case/whitespace-insensitive) since
// Department.name is unique and there's no separate "system-seeded" flag on
// either schema. Renaming it in Settings (as that seeder's comment
// suggests, once a real department exists to replace it) makes it a normal,
// visible department again — that's intended, not a bug.
const SEEDED_BOOTSTRAP_NAME = 'unassigned';
const isSeededBootstrap = (name: string): boolean => name.trim().toLowerCase() === SEEDED_BOOTSTRAP_NAME;

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((word) => {
      if (!word) {
        return word;
      }

      if (word === word.toUpperCase()) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(' ');

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

// ─── Component ──────────────────────────────────────────────────
export function DepartmentsRoles() {
  const dispatch = useAppDispatch();
  const lookupDepartments = useAppSelector((state) => state.lookups.departments);
  const lookupRoles = useAppSelector((state) => state.lookups.roles);
  const lookupsHydrated = useAppSelector((state) => state.lookups.hydrated);
  const lookupsLoading = useAppSelector((state) => state.lookups.loading);

  // Pre-saved at login (see hydrateLookups/lookupsSlice) — no local fallback
  // data; if the store is empty, the table is empty until it loads. Every
  // create/edit/toggle/delete action below re-hydrates the store afterwards
  // so this stays the single source of truth.
  const departments = useMemo<Department[]>(
    () =>
      lookupDepartments
        .filter((department) => !isSeededBootstrap(department.name))
        .map((department) => ({
          id: department.id,
          name: department.name,
          status: department.status === 'Inactive' ? 'Inactive' : 'Active',
          staffCount: typeof department.staffCount === 'number' ? department.staffCount : 0,
          dateCreated: department.dateCreated ?? '',
        })),
    [lookupDepartments],
  );

  const roles = useMemo<Role[]>(
    () =>
      lookupRoles
        .filter((role) => !isSeededBootstrap(role.name))
        .map((role) => ({
          id: role.id,
          name: role.name,
          department: role.department,
          staffCount: typeof role.staffCount === 'number' ? role.staffCount : 0,
          status: role.status === 'Inactive' ? 'Inactive' : 'Active',
          dateCreated: role.dateCreated ?? '',
        })),
    [lookupRoles],
  );

  const [isSubmittingDepartment, setIsSubmittingDepartment] = useState(false);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  // Row-scoped busy state for toggle/delete — id currently being acted on,
  // so only that row's controls disable instead of the whole table.
  const [togglingDeptId, setTogglingDeptId] = useState<string | null>(null);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal states
  const [deptModal, setDeptModal] = useState<{ open: boolean; editing: Department | null }>({
    open: false,
    editing: null,
  });
  const [roleModal, setRoleModal] = useState<{ open: boolean; editing: Role | null }>({
    open: false,
    editing: null,
  });
  const [deleteModal, setDeleteModal] = useState<{
    type: 'dept' | 'role';
    id: string;
    name: string;
    staffCount?: number;
  } | null>(null);

  // Toast
  const [toast, setToast] = useState({ message: '', visible: false });
  function showToast(msg: string) {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  // Refreshes the redux lookups store after any mutation, same pattern
  // already used by the create paths below.
  async function refreshLookups() {
    dispatch(markLookupsStale());
    await dispatch(hydrateLookups());
  }

  const deptFormik = useFormik({
    initialValues: { name: '' },
    validationSchema: departmentSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      try {
        setIsSubmittingDepartment(true);
        if (deptModal.editing) {
          const updated = await departmentsService.update(deptModal.editing.id, {
            name: values.name.trim(),
          });
          await refreshLookups();
          showToast(`Department "${updated.name}" updated`);
        } else {
          const created = await departmentsService.create({ name: values.name.trim() });

          dispatch(
            upsertDepartmentScoped({
              id: created.id,
              name: created.name,
              status: created.active ? 'Active' : 'Inactive',
              dateCreated: created.createdAt,
            }),
          );

          await refreshLookups();
          showToast(`Department "${created.name}" created`);
        }
      } catch (submitError) {
        showToast(
          submitError instanceof Error ? submitError.message : 'Failed to save department',
        );
        return;
      } finally {
        setIsSubmittingDepartment(false);
      }
      closeDeptModal();
    },
  });

  const roleFormik = useFormik({
    initialValues: { name: '', department: '' },
    validationSchema: roleSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      try {
        setIsSubmittingRole(true);
        if (roleModal.editing) {
          const updated = await unitsService.update(roleModal.editing.id, {
            name: values.name.trim(),
            departmentId: values.department,
          });
          await refreshLookups();
          showToast(`Role "${updated.name}" updated`);
        } else {
          const created = await unitsService.create({
            name: values.name.trim(),
            departmentId: values.department,
          });

          dispatch(
            upsertRoleScoped({
              id: created.id,
              name: created.name,
              department: created.departmentName,
              status: created.active ? 'Active' : 'Inactive',
            }),
          );

          await refreshLookups();
          showToast(`Role "${created.name}" created`);
        }
      } catch (submitError) {
        showToast(submitError instanceof Error ? submitError.message : 'Failed to save role');
        return;
      } finally {
        setIsSubmittingRole(false);
      }
      closeRoleModal();
    },
  });

  // ─── Department CRUD ────────────────────────────────────────
  function openDeptModal(dept?: Department) {
    if (dept) {
      if (dept.staffCount > 0) {
        showToast('You cannot edit a department that already has staff members');
        return;
      }

      deptFormik.setValues({ name: dept.name });
      deptFormik.setTouched({});
      setDeptModal({ open: true, editing: dept });
    } else {
      deptFormik.setValues({ name: '' });
      deptFormik.setTouched({});
      setDeptModal({ open: true, editing: null });
    }
  }
  function closeDeptModal() {
    deptFormik.resetForm();
    setDeptModal({ open: false, editing: null });
  }
  async function toggleDeptStatus(dept: Department) {
    try {
      setTogglingDeptId(dept.id);
      const updated = await departmentsService.update(dept.id, { active: dept.status !== 'Active' });
      await refreshLookups();
      showToast(`Department "${updated.name}" is now ${updated.active ? 'Active' : 'Inactive'}`);
    } catch (toggleError) {
      showToast(toggleError instanceof Error ? toggleError.message : 'Failed to update department status');
    } finally {
      setTogglingDeptId(null);
    }
  }

  // ─── Role CRUD ──────────────────────────────────────────────
  function openRoleModal(role?: Role) {
    if (role) {
      if (role.staffCount > 0) {
        showToast('You cannot edit a role that already has staff members');
        return;
      }

      const matchedDepartment = departments.find((dept) => dept.name === role.department);
      roleFormik.setValues({ name: role.name, department: matchedDepartment?.id || '' });
      roleFormik.setTouched({});
      setRoleModal({ open: true, editing: role });
    } else {
      roleFormik.setValues({
        name: '',
        department: departments.find((d) => d.status === 'Active')?.id || '',
      });
      roleFormik.setTouched({});
      setRoleModal({ open: true, editing: null });
    }
  }
  function closeRoleModal() {
    roleFormik.resetForm();
    setRoleModal({ open: false, editing: null });
  }
  async function toggleRoleStatus(role: Role) {
    try {
      setTogglingRoleId(role.id);
      const updated = await unitsService.update(role.id, { active: role.status !== 'Active' });
      await refreshLookups();
      showToast(`Role "${updated.name}" is now ${updated.active ? 'Active' : 'Inactive'}`);
    } catch (toggleError) {
      showToast(toggleError instanceof Error ? toggleError.message : 'Failed to update role status');
    } finally {
      setTogglingRoleId(null);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    if ((deleteModal.staffCount ?? 0) > 0) {
      showToast(
        `You cannot delete a ${deleteModal.type === 'dept' ? 'department' : 'role'} that already has staff members`,
      );
      setDeleteModal(null);
      return;
    }

    try {
      setDeletingId(deleteModal.id);
      if (deleteModal.type === 'dept') {
        await departmentsService.remove(deleteModal.id);
      } else {
        await unitsService.remove(deleteModal.id);
      }
      await refreshLookups();
      showToast(`${deleteModal.type === 'dept' ? 'Department' : 'Role'} "${deleteModal.name}" deleted`);
      setDeleteModal(null);
    } catch (deleteError) {
      showToast(
        deleteError instanceof Error
          ? deleteError.message
          : `Failed to delete ${deleteModal.type === 'dept' ? 'department' : 'role'}`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  const activeDepts = departments.filter((d) => d.status === 'Active').length;
  // Only the very first load (before hydrateLookups has ever resolved) shows
  // a loading state — a background refresh after a mutation just re-renders
  // the already-populated table.
  const isInitialLoad = lookupsLoading && !lookupsHydrated;

  return (
    <div className="space-y-8">
      {/* Toast */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body"
          >
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ModalWrapper isOpen={deleteModal !== null} onClose={() => setDeleteModal(null)}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2Icon size={24} className="text-red-600" />
          </div>
          <h3 className="text-lg font-heading font-bold text-gray-900 mb-2">
            Delete {deleteModal?.type === 'dept' ? 'Department' : 'Role'}
          </h3>
          <p className="text-sm font-body text-gray-500 mb-6">
            Are you sure you want to delete <strong>{deleteModal?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDeleteModal(null)}
              disabled={deletingId !== null}
              className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="px-4 py-2 text-sm font-heading font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {deletingId !== null && <Loader2Icon size={14} className="animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </ModalWrapper>

      {/* ─── Departments ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BuildingIcon size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-gray-900">Departments</h3>
              <p className="text-sm font-body text-gray-500">
                {activeDepts} active of {departments.length} total
              </p>
            </div>
          </div>
          <button
            onClick={() => openDeptModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors"
          >
            <PlusIcon size={14} />
            Add Department
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">Staff</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isInitialLoad ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-body text-sm">
                    Loading departments…
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-body text-sm">
                    No departments yet — add one to get started.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-heading font-medium text-gray-900">{toTitleCase(dept.name)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-gray-600">
                        <UsersIcon size={13} />
                        {dept.staffCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleDeptStatus(dept)} disabled={togglingDeptId === dept.id}>
                        {togglingDeptId === dept.id ? (
                          <Loader2Icon size={14} className="animate-spin text-gray-400" />
                        ) : (
                          <StatusBadge status={dept.status} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDateDDMMYYYY(dept.dateCreated)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openDeptModal(dept)}
                        className="text-primary hover:text-accent mr-3 transition-colors"
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (dept.staffCount > 0) {
                            showToast('You cannot delete a department that already has staff members');
                            return;
                          }

                          setDeleteModal({
                            type: 'dept',
                            id: dept.id,
                            name: dept.name,
                            staffCount: dept.staffCount,
                          });
                        }}
                        className={`transition-colors ${dept.staffCount > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Modal */}
      <ModalWrapper isOpen={deptModal.open} onClose={closeDeptModal}>
        <button
          onClick={closeDeptModal}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <XIcon size={18} />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <BuildingIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">
              {deptModal.editing ? 'Edit Department' : 'Add Department'}
            </h3>
            <p className="text-xs font-body text-gray-500">
              {deptModal.editing ? deptModal.editing.name : 'Create a new department'}
            </p>
          </div>
        </div>
        <form onSubmit={deptFormik.handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={deptFormik.values.name}
              onChange={deptFormik.handleChange}
              onBlur={deptFormik.handleBlur}
              placeholder="e.g. Operations"
              className={inputClass}
              required
            />
            {deptFormik.touched.name && deptFormik.errors.name && (
              <p className="text-xs text-red-600 mt-1">{deptFormik.errors.name}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={closeDeptModal}
              className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!deptFormik.isValid || isSubmittingDepartment}
              className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingDepartment ? 'Saving...' : deptModal.editing ? 'Save Changes' : 'Add Department'}
            </button>
          </div>
        </form>
      </ModalWrapper>

      {/* ─── Roles ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ShieldIcon size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-gray-900">Roles</h3>
              <p className="text-sm font-body text-gray-500">
                {roles.filter((r) => r.status === 'Active').length} active role(s) across {activeDepts} departments
              </p>
            </div>
          </div>
          <button
            onClick={() => openRoleModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors"
          >
            <PlusIcon size={14} />
            Add Role
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">Staff</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isInitialLoad ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-body text-sm">
                    Loading units…
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-body text-sm">
                    No roles yet — add one to get started.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-heading font-medium text-gray-900">{toTitleCase(role.name)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <BriefcaseIcon size={13} />
                        {toTitleCase(role.department)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-gray-600">
                        <UsersIcon size={13} />
                        {role.staffCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleRoleStatus(role)} disabled={togglingRoleId === role.id}>
                        {togglingRoleId === role.id ? (
                          <Loader2Icon size={14} className="animate-spin text-gray-400" />
                        ) : (
                          <StatusBadge status={role.status} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDateDDMMYYYY(role.dateCreated)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openRoleModal(role)}
                        className={`mr-3 transition-colors ${role.staffCount > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-primary hover:text-accent'}`}
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (role.staffCount > 0) {
                            showToast('You cannot delete a role that already has staff members');
                            return;
                          }

                          setDeleteModal({
                            type: 'role',
                            id: role.id,
                            name: role.name,
                            staffCount: role.staffCount,
                          });
                        }}
                        className={`transition-colors ${role.staffCount > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Modal */}
      <ModalWrapper isOpen={roleModal.open} onClose={closeRoleModal}>
        <button
          onClick={closeRoleModal}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <XIcon size={18} />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <ShieldIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">
              {roleModal.editing ? 'Edit Role' : 'Add Role'}
            </h3>
            <p className="text-xs font-body text-gray-500">
              {roleModal.editing ? roleModal.editing.name : 'Create a new unit'}
            </p>
          </div>
        </div>
        <form onSubmit={roleFormik.handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={roleFormik.values.name}
              onChange={roleFormik.handleChange}
              onBlur={roleFormik.handleBlur}
              placeholder="e.g. Loan Officer"
              className={inputClass}
              required
            />
            {roleFormik.touched.name && roleFormik.errors.name && (
              <p className="text-xs text-red-600 mt-1">{roleFormik.errors.name}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              id="department"
              name="department"
              value={roleFormik.values.department}
              onChange={roleFormik.handleChange}
              onBlur={roleFormik.handleBlur}
              className={selectClass}
              required
            >
              <option value="">Select department...</option>
              {departments
                .filter((d) => d.status === 'Active')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            {roleFormik.touched.department && roleFormik.errors.department && (
              <p className="text-xs text-red-600 mt-1">{roleFormik.errors.department}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={closeRoleModal}
              className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!roleFormik.isValid || isSubmittingRole}
              className="px-4 py-2 text-sm font-heading font-bold bg-accent text-white rounded-lg hover:bg-[#e64a19] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingRole ? 'Saving...' : roleModal.editing ? 'Save Changes' : 'Add Role'}
            </button>
          </div>
        </form>
      </ModalWrapper>
    </div>
  );
}
