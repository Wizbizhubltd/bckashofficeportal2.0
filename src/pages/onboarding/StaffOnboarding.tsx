import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FileTextIcon,
  LoaderIcon,
  PlusIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ReusableReactSelect, SelectOption } from '../../components/ReusableReactSelect';
import { GENDER_OPTIONS, ID_TYPE_OPTIONS, STAFF_ROLE_LABEL, STAFF_ROLE_OPTIONS } from '../../constants/identity-options';
import { useAuth } from '../../context/AuthContext';
import type { StaffUserType } from '../../services/auth/auth.types';
import { departmentsService } from '../../services/departments/departments.service';
import { referenceDataService } from '../../services/reference-data/reference-data.service';
import { unitsService } from '../../services/units/units.service';
import {
  staffService,
  type BvnPreview,
  type Gender,
  type IdentificationType,
  type InitiateStaffOnboardingPayload,
  type OnboardableStaffRole,
} from '../../services/staff/staff.service';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { hydrateLookups, markLookupsStale } from '../../store/slices/lookupsSlice';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB — matches the backend's UPLOAD_MAX_FILE_SIZE default.
const PASSPORT_PHOTO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ID_DOCUMENT_MIME_TYPES = [...PASSPORT_PHOTO_MIME_TYPES, 'application/pdf'];

type OptionItem = {
  id: string;
  name: string;
};

type StaffOnboardingValues = {
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  state: string;
  city: string;
  address: string;
  departmentId: string;
  role: string;
  userType: string;
  roleId: string;
  branchId: string;
  startDate: string;
  bvn: string;
  idType: string;
  idNumber: string;
  nokName: string;
  nokRelationship: string;
  nokPhone: string;
  nokAddress: string;
  referenceName: string;
  referenceRelationship: string;
  referencePhone: string;
  referenceAddress: string;
};

const steps = [
  { id: 1, title: 'Personal Info' },
  { id: 2, title: 'Employment Details' },
  { id: 3, title: 'KYC & Contacts' },
  { id: 4, title: 'Review' },
] as const;

const initialValues: StaffOnboardingValues = {
  fullName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: '',
  gender: '',
  state: '',
  city: '',
  address: '',
  departmentId: '',
  role: '',
  userType: '',
  roleId: '',
  branchId: '',
  startDate: '',
  bvn: '',
  idType: '',
  idNumber: '',
  nokName: '',
  nokRelationship: '',
  nokPhone: '',
  nokAddress: '',
  referenceName: '',
  referenceRelationship: '',
  referencePhone: '',
  referenceAddress: '',
};

const numericPhoneRule = Yup.string()
  .matches(/^\d{11}$/, 'Phone number must be exactly 11 digits')
  .required('Phone number is required');

const fullSchema = Yup.object({
  fullName: Yup.string().trim().required('Full name is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  phoneNumber: numericPhoneRule,
  dateOfBirth: Yup.string().required('Date of birth is required'),
  gender: Yup.string().required('Gender is required'),
  state: Yup.string().trim().required('State is required'),
  city: Yup.string().trim().required('City is required'),
  address: Yup.string().trim().required('Address is required'),
  departmentId: Yup.string().required('Department is required'),
  role: Yup.string().required('Role is required'),
  userType: Yup.string().required('User type is required'),
  roleId: Yup.string().required('Role is required'),
  branchId: Yup.string().required('Branch is required'),
  startDate: Yup.string().required('Start date is required'),
  bvn: Yup.string().matches(/^\d{11}$/, 'BVN must be 11 digits').required('BVN is required'),
  idType: Yup.string().required('ID type is required'),
  idNumber: Yup.string().trim().required('ID number is required'),
  nokName: Yup.string().trim().required('Next of kin name is required'),
  nokRelationship: Yup.string().trim().required('Next of kin relationship is required'),
  nokPhone: numericPhoneRule,
  nokAddress: Yup.string().trim().required('Next of kin address is required'),
  referenceName: Yup.string().trim().required('Reference name is required'),
  referenceRelationship: Yup.string().trim().required('Reference relationship is required'),
  referencePhone: numericPhoneRule,
  referenceAddress: Yup.string().trim().required('Reference address is required'),
});

const stepFieldMap: Record<number, Array<keyof StaffOnboardingValues>> = {
  1: ['fullName', 'email', 'phoneNumber', 'dateOfBirth', 'gender', 'state', 'city', 'address'],
  2: ['departmentId', 'role', 'userType', 'roleId', 'branchId', 'startDate'],
  3: [
    'bvn',
    'idType',
    'idNumber',
    'nokName',
    'nokRelationship',
    'nokPhone',
    'nokAddress',
    'referenceName',
    'referenceRelationship',
    'referencePhone',
    'referenceAddress',
  ],
  4: [],
};

/**
 * A staff member's function in an approval chain — independent of `role`,
 * matches backend `StaffUserType` verbatim (see
 * backashbackend/src/common/enums/identity.enums.ts). This is the value
 * that actually gets posted to the API as `userType`.
 *
 * Real access control now (Initiator/Authorizer RBAC), not just a label: an
 * Initiator-flagged staff member can only ever initiate workflow requests
 * (raise a customer/loan/staff proposal, ...); an Authorizer-flagged one can
 * only ever review/approve them. "Reviewer" is deliberately NOT offered here
 * — it's a legacy value the backend only ever backfills onto a record that
 * pre-dates this feature (StaffService.resolveUserType rejects it as a new
 * value outright), so it's never a real choice for a new staff member.
 */
const userTypeOptions: SelectOption[] = [
  { label: 'Initiator', value: 'Initiator' },
  { label: 'Authorizer', value: 'Authorizer' },
];

function normalizeName(input: string): string {
  return input.trim().toLowerCase();
}

function validateUploadFile(file: File, allowedMimeTypes: string[]): string | null {
  if (!allowedMimeTypes.includes(file.type)) {
    return `Unsupported file type (${file.type || 'unknown'}).`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large — max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`;
  }
  return null;
}

export function StaffOnboarding() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  // Proposing an ADMIN/APPROVER account is Admin/SuperAdmin only — enforced
  // server-side too (see StaffService.initiateOnboarding's own doc
  // comment), hidden here so a Manager never even sees the option.
  const canOnboardAdminTier = user?.role === 'admin' || user?.role === 'super_admin';
  const staffRoleOptions = useMemo(
    () =>
      canOnboardAdminTier
        ? STAFF_ROLE_OPTIONS
        : STAFF_ROLE_OPTIONS.filter((option) => option.value !== 'ADMIN' && option.value !== 'APPROVER'),
    [canOnboardAdminTier],
  );
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<OptionItem[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({ name: '', description: '' });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', departmentId: '' });
  const [modalError, setModalError] = useState<string | null>(null);
  const [inlineCreateSuccess, setInlineCreateSuccess] = useState<string | null>(null);
  const [bvnModalOpen, setBvnModalOpen] = useState(false);
  const [isVerifyingBvn, setIsVerifyingBvn] = useState(false);
  const [bvnPreview, setBvnPreview] = useState<BvnPreview | null>(null);
  const [bvnPreviewError, setBvnPreviewError] = useState<string | null>(null);
  const [bvnPreviewConfirmed, setBvnPreviewConfirmed] = useState(false);
  const [passportPhotoFile, setPassportPhotoFile] = useState<File | null>(null);
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null);
  const [passportPhotoError, setPassportPhotoError] = useState<string | null>(null);
  const [idDocumentError, setIdDocumentError] = useState<string | null>(null);
  const [passportPhotoPreviewUrl, setPassportPhotoPreviewUrl] = useState<string | null>(null);
  const passportPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const idDocumentInputRef = useRef<HTMLInputElement | null>(null);

  // Revoke the previous object URL whenever the photo changes (or the page
  // unmounts) — otherwise every re-selection leaks the last one.
  useEffect(() => {
    if (!passportPhotoFile) {
      setPassportPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(passportPhotoFile);
    setPassportPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [passportPhotoFile]);

  const selectPassportPhoto = (file: File | null) => {
    if (!file) {
      setPassportPhotoFile(null);
      setPassportPhotoError(null);
      return;
    }
    const error = validateUploadFile(file, PASSPORT_PHOTO_MIME_TYPES);
    if (error) {
      setPassportPhotoError(error);
      return;
    }
    setPassportPhotoError(null);
    setPassportPhotoFile(file);
  };

  const selectIdDocument = (file: File | null) => {
    if (!file) {
      setIdDocumentFile(null);
      setIdDocumentError(null);
      return;
    }
    const error = validateUploadFile(file, ID_DOCUMENT_MIME_TYPES);
    if (error) {
      setIdDocumentError(error);
      return;
    }
    setIdDocumentError(null);
    setIdDocumentFile(file);
  };

  const storeStates = useAppSelector((state) => state.lookups.states);
  const storeDepartments = useAppSelector((state) => state.lookups.departments);
  const storeRoles = useAppSelector((state) => state.lookups.roles);
  const storeBranches = useAppSelector((state) => state.lookups.branches);
  const isLoadingOptions = useAppSelector((state) => state.lookups.loading);
  const optionsError = useAppSelector((state) => state.lookups.error);

  const states = useMemo<OptionItem[]>(() => {
    if (storeStates.length > 0) {
      return storeStates.map((stateItem) => ({ id: stateItem.id, name: stateItem.name }));
    }
    return [];
  }, [storeStates]);

  // Pre-saved at login (see hydrateLookups/lookupsSlice) — no local fallback
  // data; if the store is empty, the dropdown is empty until it loads.
  const departments = useMemo<OptionItem[]>(
    () => storeDepartments.map((department) => ({ id: department.id, name: department.name })),
    [storeDepartments],
  );

  const branches = useMemo<OptionItem[]>(
    () => storeBranches.map((branch) => ({ id: branch.id, name: branch.name })),
    [storeBranches],
  );

  const formik = useFormik<StaffOnboardingValues>({
    initialValues,
    validationSchema: fullSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      // Guards against a real React footgun: the "Continue" (type="button")
      // and "Submit Registration" (type="submit") buttons below sit in the
      // same JSX slot of a step<4 ? ... : ... ternary, so React reuses the
      // same DOM node across the step 3->4 transition rather than
      // unmounting/remounting it (see the `key`s added to each — that's the
      // actual fix). Without this guard, clicking "Continue" on step 3
      // could flip that node's `type` attribute to "submit" mid-click,
      // causing the browser to submit the form as part of that very click
      // — creating the staff profile before Review was ever seen, let
      // alone "Submit Registration" clicked. Kept as defense-in-depth even
      // with the key fix in place.
      if (step !== 4) {
        return;
      }

      setSubmissionMessage(null);
      setSubmissionError(null);

      // The form only has a single "Full Name" field, but the API wants
      // firstName/lastName separately — best-effort split on the first
      // space. (A dedicated last-name field would be more correct; this is
      // a pragmatic stopgap, not a redesign of the Personal Info step.)
      const trimmedFullName = values.fullName.trim();
      const [firstName, ...rest] = trimmedFullName.split(/\s+/);
      const lastName = rest.length > 0 ? rest.join(' ') : firstName;

      const payload: InitiateStaffOnboardingPayload = {
        role: values.role as OnboardableStaffRole,
        firstName,
        lastName,
        email: values.email.trim().toLowerCase(),
        phoneNumber: values.phoneNumber.trim(),
        userType: values.userType as StaffUserType,
        departmentId: values.departmentId,
        // The "Role" field (values.roleId) is really an org-structure Unit —
        // see lookupsSlice's own note on why it's still called `roles`/`roleId`
        // on the frontend; the API field is `unitId`.
        unitId: values.roleId,
        branchId: values.branchId,
        // No module-access (LOANS/ACCOUNTING/HR) picker in this form yet —
        // defaults to none, grantable later via RBAC.
        moduleAccess: [],
        startDate: values.startDate,
        bvn: values.bvn.trim() || undefined,
        residentialAddress: {
          // values.state/.city are ids (see stateOptions/cityOptions) — the
          // API wants the display name, resolved here against the
          // pre-saved states/cities lookups.
          state: selectedState?.name ?? '',
          city: selectedCity?.name ?? '',
          street: values.address.trim(),
        },
        kyc: {
          dateOfBirth: values.dateOfBirth,
          gender: values.gender as Gender,
          idType: values.idType as IdentificationType,
          idNumber: values.idNumber.trim(),
        },
        nextOfKin: {
          name: values.nokName.trim(),
          relationship: values.nokRelationship.trim(),
          phoneNumber: values.nokPhone.trim(),
          address: values.nokAddress.trim(),
        },
        reference: {
          name: values.referenceName.trim(),
          relationship: values.referenceRelationship.trim(),
          phoneNumber: values.referencePhone.trim(),
          address: values.referenceAddress.trim(),
        },
        passportPhoto: passportPhotoFile ?? undefined,
        idDocument: idDocumentFile ?? undefined,
      };

      try {
        // Workflow-mediated (Branch Managers onboard Marketers) — this
        // creates a WorkflowRequest pending Admin/Approver approval, not a
        // live Staff record; credentials go out by email once approved.
        await staffService.onboard(payload);

        setSubmissionMessage(
          'Staff onboarding request submitted for approval. Login credentials will be emailed once approved.',
        );
        formik.resetForm();
        setCities([]);
        selectPassportPhoto(null);
        selectIdDocument(null);
        setStep(1);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit staff registration';
        setSubmissionError(message);
      }
    },
  });

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === formik.values.departmentId),
    [departments, formik.values.departmentId],
  );
  const selectedRole = useMemo(
    () => storeRoles.find((item) => item.id === formik.values.roleId),
    [storeRoles, formik.values.roleId],
  );
  const selectedBranch = useMemo(
    () => branches.find((item) => item.id === formik.values.branchId),
    [branches, formik.values.branchId],
  );

  // `formik.values.state`/`.city` hold ids (same convention as
  // departmentId/roleId/branchId below) — the human-readable name for the
  // submission payload/review step is resolved via selectedState/selectedCity.
  const stateOptions: SelectOption[] = useMemo(
    () => states.map((stateItem) => ({ label: stateItem.name, value: stateItem.id })),
    [states],
  );

  const cityOptions: SelectOption[] = useMemo(
    () => cities.map((cityItem) => ({ label: cityItem.name, value: cityItem.id })),
    [cities],
  );

  const selectedState = useMemo(
    () => states.find((item) => item.id === formik.values.state),
    [states, formik.values.state],
  );
  const selectedCity = useMemo(
    () => cities.find((item) => item.id === formik.values.city),
    [cities, formik.values.city],
  );

  const departmentOptions: SelectOption[] = useMemo(
    () => departments.map((department) => ({ label: department.name, value: department.id })),
    [departments],
  );

  const selectedDepartmentName = useMemo(
    () => departments.find((department) => department.id === formik.values.departmentId)?.name,
    [departments, formik.values.departmentId],
  );

  // Pre-saved at login (see hydrateLookups/lookupsSlice) — no local fallback
  // data; scoped to whichever department is currently selected.
  const roles = useMemo<OptionItem[]>(() => {
    if (!selectedDepartmentName) {
      return [];
    }

    return storeRoles
      .filter((role) => normalizeName(role.department) === normalizeName(selectedDepartmentName))
      .map((role) => ({ id: role.id, name: role.name }));
  }, [storeRoles, selectedDepartmentName]);

  const roleOptions: SelectOption[] = useMemo(
    () => roles.map((role) => ({ label: role.name, value: role.id })),
    [roles],
  );

  const branchOptions: SelectOption[] = useMemo(
    () => branches.map((branch) => ({ label: branch.name, value: branch.id })),
    [branches],
  );

  const createDepartmentInline = async () => {
    setModalError(null);

    const name = departmentForm.name.trim();

    if (!name) {
      setModalError('Department name is required.');
      return;
    }

    try {
      setIsCreatingDepartment(true);
      // POST /departments — description isn't a field the backend accepts
      // (see CreateDepartmentPayload); the form field is kept for the UI's
      // sake but only `name` is actually sent.
      const created = await departmentsService.create({ name });

      dispatch(markLookupsStale());
      await dispatch(hydrateLookups());

      formik.setFieldValue('departmentId', created.id, false);

      setDepartmentForm({ name: '', description: '' });
      setDepartmentModalOpen(false);
      setSubmissionMessage('Department created successfully.');
      setInlineCreateSuccess('Department created successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create department';
      setModalError(message);
    } finally {
      setIsCreatingDepartment(false);
    }
  };

  const createRoleInline = async () => {
    setModalError(null);

    const name = roleForm.name.trim();
    const departmentId = roleForm.departmentId.trim();

    if (!name) {
      setModalError('Role name is required.');
      return;
    }

    if (!departmentId) {
      setModalError('Department is required for role creation.');
      return;
    }

    try {
      setIsCreatingRole(true);
      // POST /units — "Role" on this form is really an org-structure Unit,
      // see lookupsSlice's own note; description isn't accepted server-side.
      const created = await unitsService.create({ name, departmentId });

      dispatch(markLookupsStale());
      await dispatch(hydrateLookups());

      formik.setFieldValue('roleId', created.id, false);

      setRoleForm({ name: '', description: '', departmentId: formik.values.departmentId || '' });
      setRoleModalOpen(false);
      setSubmissionMessage('Role created successfully.');
      setInlineCreateSuccess('Role created successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create role';
      setModalError(message);
    } finally {
      setIsCreatingRole(false);
    }
  };

  /**
   * POST /staff/verify-bvn-preview — a real-time, no-consent BVN lookup
   * usable before this staff record exists (see staff.service.ts). Doesn't
   * persist anything; just resolves the provider's identity for the
   * onboarder to confirm against what's typed into the form.
   */
  const handleVerifyBvn = async () => {
    const bvn = formik.values.bvn.trim();

    if (!/^\d{11}$/.test(bvn)) {
      formik.setFieldTouched('bvn', true, false);
      setBvnPreview(null);
      setBvnPreviewError('Enter a valid 11-digit BVN first.');
      setBvnModalOpen(true);
      return;
    }

    setBvnModalOpen(true);
    setIsVerifyingBvn(true);
    setBvnPreviewError(null);
    setBvnPreview(null);

    try {
      const result = await staffService.verifyBvnPreview({ bvn });
      setBvnPreview(result);
    } catch (error) {
      setBvnPreviewError(error instanceof Error ? error.message : 'BVN verification failed.');
    } finally {
      setIsVerifyingBvn(false);
    }
  };

  // A changed BVN invalidates any earlier confirmation — must be re-verified.
  useEffect(() => {
    setBvnPreviewConfirmed(false);
  }, [formik.values.bvn]);

  useEffect(() => {
    formik.setFieldValue('roleId', '', false);
  }, [formik.values.departmentId]);

  // Marketers are always Initiator, non-negotiable — the backend forces
  // this server-side regardless of what's submitted (see
  // StaffService.resolveUserType), so reflect it here too rather than
  // showing an editable field whose value would be silently overridden.
  useEffect(() => {
    if (formik.values.role === 'MARKETER' && formik.values.userType !== 'Initiator') {
      formik.setFieldValue('userType', 'Initiator', false);
    }
  }, [formik.values.role]);

  useEffect(() => {
    if (!inlineCreateSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInlineCreateSuccess(null);
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [inlineCreateSuccess]);

  useEffect(() => {
    const loadCities = async () => {
      // `formik.values.state` is the state's id (see stateOptions) — GET
      // /reference-data/states/:stateId/cities, not the display name.
      if (!formik.values.state) {
        setIsLoadingCities(false);
        setCities([]);
        return;
      }

      try {
        setIsLoadingCities(true);
        const cityList = await referenceDataService.listCitiesByState(formik.values.state);
        setCities(cityList.map((city) => ({ id: city.id, name: city.name })));
      } catch {
        setCities([]);
      } finally {
        setIsLoadingCities(false);
      }
    };

    formik.setFieldValue('city', '', false);
    void loadCities();
  }, [formik.values.state]);

  const getError = (field: keyof StaffOnboardingValues) => {
    if (!formik.touched[field]) {
      return '';
    }

    const error = formik.errors[field];
    return typeof error === 'string' ? error : '';
  };

  const markStepFieldsTouched = (currentStep: number) => {
    const touchedFields = stepFieldMap[currentStep] ?? [];
    for (const field of touchedFields) {
      formik.setFieldTouched(field, true, false);
    }
  };

  const stepHasErrors = async (currentStep: number) => {
    const allErrors = await formik.validateForm();
    const fields = stepFieldMap[currentStep] ?? [];
    return fields.some((field) => Boolean(allErrors[field]));
  };

  const handleNextStep = async () => {
    markStepFieldsTouched(step);
    const hasErrors = await stepHasErrors(step);

    if (hasErrors) {
      return;
    }

    setStep((prev) => Math.min(prev + 1, 4));
  };

  const handleNumericChange = (field: keyof StaffOnboardingValues, maxLength: number) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = event.target.value.replace(/\D/g, '').slice(0, maxLength);
      formik.setFieldValue(field, sanitized);
    };
  };

  const renderInput = (
    field: keyof StaffOnboardingValues,
    label: string,
    type: string,
    placeholder?: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={field}
        value={formik.values[field]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
      {getError(field) && <p className="text-xs text-red-600 mt-1">{getError(field)}</p>}
    </div>
  );

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-6">
          <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderInput('fullName', 'Full Name', 'text', 'e.g. Adebayo Johnson')}
            {renderInput('email', 'Email Address', 'email', 'adebayo@bckash.com')}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                name="phoneNumber"
                value={formik.values.phoneNumber}
                onChange={handleNumericChange('phoneNumber', 11)}
                onBlur={formik.handleBlur}
                placeholder="08000000000"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              {getError('phoneNumber') && <p className="text-xs text-red-600 mt-1">{getError('phoneNumber')}</p>}
            </div>

            {renderInput('dateOfBirth', 'Date of Birth', 'date')}

            <ReusableReactSelect
              name="gender"
              label="Gender"
              formik={formik}
              options={GENDER_OPTIONS}
              placeholder="Select Gender"
            />

            <ReusableReactSelect
              name="state"
              label="State"
              formik={formik}
              options={stateOptions}
              placeholder="Search and select state"
              isLoading={isLoadingOptions}
              isDisabled={isLoadingOptions}
            />

            <ReusableReactSelect
              name="city"
              label="City"
              formik={formik}
              options={cityOptions}
              placeholder={formik.values.state ? 'Search and select city' : 'Select state first'}
              isDisabled={!formik.values.state}
              isLoading={isLoadingCities}
              helperText={
                !formik.values.state
                  ? 'Select a state to load cities'
                  : isLoadingCities
                    ? 'Loading cities...'
                    : cityOptions.length === 0
                      ? 'No cities found for selected state'
                      : undefined
              }
              noOptionsMessage={isLoadingCities ? 'Loading cities...' : 'No cities found'}
            />

            <div className="md:col-span-2">{renderInput('address', 'Address', 'text', 'Enter staff residential address')}</div>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-6">
          <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">Employment Details</h3>
          {optionsError && <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-md">{optionsError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID (Auto-generated)</label>
              <input
                type="text"
                value="BCK-2026-089"
                disabled
                className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500"
              />
            </div>

            <ReusableReactSelect
              name="departmentId"
              label="Department"
              formik={formik}
              options={departmentOptions}
              labelAction={
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setDepartmentModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-[#123e31]"
                >
                  <PlusIcon size={13} /> Create Department
                </button>
              }
              placeholder="Select Department"
              isDisabled={isLoadingOptions}
              isLoading={isLoadingOptions}
              helperText={
                isLoadingOptions
                  ? 'Loading departments...'
                  : departmentOptions.length === 0
                    ? 'No departments available'
                    : undefined
              }
              noOptionsMessage={isLoadingOptions ? 'Loading departments...' : 'No departments found'}
            />

            {/* Labeled "Staff Role" rather than plain "Role" to stay distinct
                from the `roleId` field just below — that one is really an
                org-structure Unit, see its own doc comment. This is the
                actual StaffRole the account is created with on approval. */}
            <ReusableReactSelect
              name="role"
              label="Staff Role"
              formik={formik}
              options={staffRoleOptions}
              placeholder="Select staff role"
            />

            <ReusableReactSelect
              name="userType"
              label="User Type"
              formik={formik}
              options={userTypeOptions}
              placeholder="Select user type"
              isDisabled={formik.values.role === 'MARKETER'}
              helperText={
                formik.values.role === 'MARKETER' ? 'Marketers are always Initiator.' : undefined
              }
            />

            <ReusableReactSelect
              name="roleId"
              label="Role"
              formik={formik}
              options={roleOptions}
              labelAction={
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setRoleForm((prev) => ({
                      ...prev,
                      departmentId: formik.values.departmentId || prev.departmentId,
                    }));
                    setRoleModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-[#123e31]"
                >
                  <PlusIcon size={13} /> Create Role
                </button>
              }
              placeholder={formik.values.departmentId ? 'Search and select role' : 'Select department first'}
              isDisabled={!formik.values.departmentId}
              helperText={
                !formik.values.departmentId
                  ? 'Select a department to load roles'
                  : roleOptions.length === 0
                    ? 'No roles found for selected department'
                    : undefined
              }
              noOptionsMessage={
                !formik.values.departmentId ? 'Select a department first' : 'No roles found for selected department'
              }
            />

            <ReusableReactSelect
              name="branchId"
              label="Branch Assignment"
              formik={formik}
              options={branchOptions}
              placeholder="Select Branch"
              isDisabled={isLoadingOptions}
              isLoading={isLoadingOptions}
              helperText={
                isLoadingOptions
                  ? 'Loading branches...'
                  : branchOptions.length === 0
                    ? 'No branches available'
                    : undefined
              }
              noOptionsMessage={isLoadingOptions ? 'Loading branches...' : 'No branches found'}
            />

            {renderInput('startDate', 'Start Date', 'date')}
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="space-y-6">
          <h3 className="text-lg font-heading font-bold text-primary border-b pb-2">KYC, NOK & Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BVN (11 digits)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="bvn"
                  value={formik.values.bvn}
                  onChange={handleNumericChange('bvn', 11)}
                  onBlur={formik.handleBlur}
                  placeholder="11-digit BVN"
                  autoComplete="off"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleVerifyBvn()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm border border-gray-200 flex items-center gap-1.5 disabled:opacity-60"
                  disabled={isVerifyingBvn}
                >
                  {isVerifyingBvn ? (
                    <LoaderIcon size={14} className="animate-spin" />
                  ) : bvnPreviewConfirmed ? (
                    <ShieldCheckIcon size={14} className="text-green-600" />
                  ) : null}
                  {isVerifyingBvn ? 'Verifying...' : bvnPreviewConfirmed ? 'Verified' : 'Verify'}
                </button>
              </div>
              {getError('bvn') && <p className="text-xs text-red-600 mt-1">{getError('bvn')}</p>}
            </div>

            <ReusableReactSelect
              name="idType"
              label="ID Type"
              formik={formik}
              options={ID_TYPE_OPTIONS}
              placeholder="Select ID Type"
            />

            {renderInput('idNumber', 'ID Number', 'text')}

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <input
                  ref={idDocumentInputRef}
                  type="file"
                  accept={ID_DOCUMENT_MIME_TYPES.join(',')}
                  className="hidden"
                  onChange={(event) => {
                    selectIdDocument(event.target.files?.[0] ?? null);
                    event.target.value = '';
                  }}
                />
                {idDocumentFile ? (
                  <div className="border-2 border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileTextIcon size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{idDocumentFile.name}</p>
                      <p className="text-xs text-gray-400">{(idDocumentFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectIdDocument(null)}
                      className="text-gray-400 hover:text-red-600 flex-shrink-0"
                      aria-label="Remove ID document"
                    >
                      <XCircleIcon size={20} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => idDocumentInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      selectIdDocument(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <UploadCloudIcon size={32} className="text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">Upload ID Document</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG or PDF (Max 5MB)</p>
                  </div>
                )}
                {idDocumentError && <p className="text-xs text-red-600 mt-1">{idDocumentError}</p>}
              </div>

              <div>
                <input
                  ref={passportPhotoInputRef}
                  type="file"
                  accept={PASSPORT_PHOTO_MIME_TYPES.join(',')}
                  className="hidden"
                  onChange={(event) => {
                    selectPassportPhoto(event.target.files?.[0] ?? null);
                    event.target.value = '';
                  }}
                />
                {passportPhotoFile && passportPhotoPreviewUrl ? (
                  <div className="border-2 border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    <img
                      src={passportPhotoPreviewUrl}
                      alt="Passport preview"
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{passportPhotoFile.name}</p>
                      <p className="text-xs text-gray-400">{(passportPhotoFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectPassportPhoto(null)}
                      className="text-gray-400 hover:text-red-600 flex-shrink-0"
                      aria-label="Remove passport photo"
                    >
                      <XCircleIcon size={20} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => passportPhotoInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      selectPassportPhoto(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <UploadCloudIcon size={32} className="text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">Upload Passport Photo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG or JPG (Max 5MB)</p>
                  </div>
                )}
                {passportPhotoError && <p className="text-xs text-red-600 mt-1">{passportPhotoError}</p>}
              </div>
            </div>

            <div className="md:col-span-2 border-t pt-4">
              <h4 className="text-md font-semibold text-primary mb-3">Next of Kin Details</h4>
            </div>
            {renderInput('nokName', 'NOK Full Name', 'text')}
            {renderInput('nokRelationship', 'NOK Relationship', 'text')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NOK Phone Number</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                name="nokPhone"
                value={formik.values.nokPhone}
                onChange={handleNumericChange('nokPhone', 11)}
                onBlur={formik.handleBlur}
                placeholder="08000000000"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              {getError('nokPhone') && <p className="text-xs text-red-600 mt-1">{getError('nokPhone')}</p>}
            </div>
            {renderInput('nokAddress', 'NOK Address', 'text')}

            <div className="md:col-span-2 border-t pt-4">
              <h4 className="text-md font-semibold text-primary mb-3">Reference Details</h4>
            </div>
            {renderInput('referenceName', 'Reference Full Name', 'text')}
            {renderInput('referenceRelationship', 'Reference Relationship', 'text')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Phone Number</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                name="referencePhone"
                value={formik.values.referencePhone}
                onChange={handleNumericChange('referencePhone', 11)}
                onBlur={formik.handleBlur}
                placeholder="08000000000"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              {getError('referencePhone') && <p className="text-xs text-red-600 mt-1">{getError('referencePhone')}</p>}
            </div>
            {renderInput('referenceAddress', 'Reference Address', 'text')}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2Icon size={32} />
          </div>
          <h3 className="text-xl font-heading font-bold text-primary mb-2">Review & Submit</h3>
          <p className="text-gray-500 max-w-md mx-auto">Please review the staff details before final submission.</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
          <p className="font-medium text-gray-700 mb-2">Summary:</p>
          <ul className="space-y-2 text-gray-600">
            <li>
              <span className="font-medium">Name:</span> {formik.values.fullName || '—'}
            </li>
            <li>
              <span className="font-medium">Department:</span> {selectedDepartment?.name || '—'}
            </li>
            <li>
              <span className="font-medium">Staff Role:</span> {STAFF_ROLE_LABEL[formik.values.role] ?? formik.values.role ?? '—'}
            </li>
            <li>
              <span className="font-medium">User Type:</span> {formik.values.userType || '—'}
            </li>
            <li>
              <span className="font-medium">Role:</span> {selectedRole?.name || '—'}
            </li>
            <li>
              <span className="font-medium">Branch:</span> {selectedBranch?.name || '—'}
            </li>
            <li>
              <span className="font-medium">State/City:</span> {selectedState?.name || '—'} / {selectedCity?.name || '—'}
            </li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          
          <p className="text-gray-500 text-sm mt-1">Register a new staff member into the system</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />

          {steps.map((currentStep) => (
            <div key={currentStep.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  step >= currentStep.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > currentStep.id ? <CheckCircle2Icon size={16} /> : currentStep.id}
              </div>
              <span className={`text-xs mt-2 font-medium ${step >= currentStep.id ? 'text-primary' : 'text-gray-400'}`}>
                {currentStep.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={formik.handleSubmit}
        // The whole 4-step wizard is one <form> — by the time a user reaches
        // the last step, every earlier step's fields already validate, so a
        // stray Enter keypress in any text field (a very natural habit while
        // filling one out) would otherwise submit the entire form the moment
        // it bubbles up here, well before "Submit Registration" is ever
        // clicked. Only step 4 (Review) is allowed to actually submit on
        // Enter — everywhere else it's a no-op.
        onKeyDown={(event) => {
          if (event.key === 'Enter' && step < 4) {
            event.preventDefault();
          }
        }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          {renderStepContent()}
        </motion.div>

        {submissionMessage && <p className="text-xs text-green-700 bg-green-50 p-2 rounded-md mt-6">{submissionMessage}</p>}
        {submissionError && <p className="text-xs text-red-700 bg-red-50 p-2 rounded-md mt-2">{submissionError}</p>}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(prev - 1, 1))}
            disabled={step === 1}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Back
          </button>

          {step < 4 ? (
            <button
              key="continue-button"
              type="button"
              onClick={() => {
                void handleNextStep();
              }}
              disabled={formik.isSubmitting}
              className="flex items-center px-6 py-2 bg-primary text-white rounded-lg hover:bg-[#123e31] font-medium transition-colors shadow-sm"
            >
              Continue <ChevronRightIcon size={18} className="ml-1" />
            </button>
          ) : (
            <button
              key="submit-button"
              type="submit"
              disabled={formik.isSubmitting}
              className="flex items-center px-8 py-2 bg-accent text-white rounded-lg hover:bg-[#e64a19] font-heading font-bold transition-colors shadow-md"
            >
              {formik.isSubmitting ? 'Submitting...' : 'Submit Registration'}
            </button>
          )}
        </div>
      </form>

      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDepartmentModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <button
              type="button"
              onClick={() => setDepartmentModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-lg font-heading font-bold text-primary mb-4">Create Department</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <input
                  type="text"
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="e.g. Internal Control"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={departmentForm.description}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  rows={3}
                />
              </div>
              {modalError && <p className="text-xs text-red-700 bg-red-50 p-2 rounded-md">{modalError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDepartmentModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={() => void createDepartmentInline()}
                  disabled={isCreatingDepartment}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {isCreatingDepartment ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRoleModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <button
              type="button"
              onClick={() => setRoleModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-lg font-heading font-bold text-primary mb-4">Create Role</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="e.g. Internal Auditor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={roleForm.departmentId}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, departmentId: event.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">Select department...</option>
                  {departmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={roleForm.description}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  rows={3}
                />
              </div>
              {modalError && <p className="text-xs text-red-700 bg-red-50 p-2 rounded-md">{modalError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRoleModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={() => void createRoleInline()}
                  disabled={isCreatingRole}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {isCreatingRole ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {inlineCreateSuccess && (
        <div className="fixed bottom-6 right-6 z-[60]">
          <div className="flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-3 shadow-xl">
            <CheckCircle2Icon size={16} />
            <span className="text-sm font-medium">{inlineCreateSuccess}</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {bvnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setBvnModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <button
                type="button"
                onClick={() => setBvnModalOpen(false)}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
              >
                <XIcon size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShieldCheckIcon size={20} className="text-primary" />
                </div>
                <h3 className="text-lg font-heading font-bold text-primary">BVN Verification</h3>
              </div>

              {isVerifyingBvn && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <LoaderIcon size={28} className="animate-spin mb-3 text-primary" />
                  <p className="text-sm">Checking BVN with the provider...</p>
                </div>
              )}

              {!isVerifyingBvn && bvnPreviewError && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircleIcon size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{bvnPreviewError}</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBvnModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVerifyBvn()}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {!isVerifyingBvn && !bvnPreviewError && bvnPreview && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <CheckCircle2Icon size={16} className="flex-shrink-0" />
                    <span>This BVN resolves to a real identity — confirm it matches the person being onboarded.</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div>
                      <dt className="text-xs text-gray-500 uppercase tracking-wide">Name</dt>
                      <dd className="font-medium text-gray-800">
                        {bvnPreview.firstName} {bvnPreview.lastName}
                        {bvnPreview.otherNames ? ` ${bvnPreview.otherNames}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 uppercase tracking-wide">Date of Birth</dt>
                      <dd className="font-medium text-gray-800">{bvnPreview.dateOfBirth}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-500 uppercase tracking-wide">Phone Number</dt>
                      <dd className="font-medium text-gray-800">{bvnPreview.phoneNumber}</dd>
                    </div>
                  </dl>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBvnModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBvnPreviewConfirmed(true);
                        setBvnModalOpen(false);
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                    >
                      This Is Correct
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}