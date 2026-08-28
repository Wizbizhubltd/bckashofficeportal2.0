import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon, PencilIcon, XIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { ReusableReactSelect, SelectOption } from '../../components/ReusableReactSelect';
import { GENDER_OPTIONS, ID_TYPE_LABEL } from '../../constants/identity-options';
import { referenceDataService } from '../../services/reference-data/reference-data.service';
import { staffService, type Staff, type UpdateOwnProfilePayload } from '../../services/staff/staff.service';
import { useAppSelector } from '../../store/hooks';

const phoneRule = Yup.string()
  .matches(/^(?:\+234|0)[789]\d{9}$/, 'Enter a valid Nigerian mobile number')
  .required('Phone number is required');

const contactPersonSchema = Yup.object({
  name: Yup.string().trim().required('Name is required'),
  relationship: Yup.string().trim().required('Relationship is required'),
  phoneNumber: phoneRule,
  address: Yup.string().trim().required('Address is required'),
});

const personalInfoSchema = Yup.object({
  phoneNumber: phoneRule,
  state: Yup.string().trim().required('State is required'),
  city: Yup.string().trim().required('City is required'),
  street: Yup.string().trim().required('Street address is required'),
  nextOfKin: contactPersonSchema,
  reference: contactPersonSchema,
});

type FormValues = Yup.InferType<typeof personalInfoSchema>;

function toFormValues(profile: Staff): FormValues {
  return {
    phoneNumber: profile.phoneNumber,
    state: profile.residentialAddress?.state ?? '',
    city: profile.residentialAddress?.city ?? '',
    street: profile.residentialAddress?.street ?? '',
    nextOfKin: {
      name: profile.nextOfKin?.name ?? '',
      relationship: profile.nextOfKin?.relationship ?? '',
      phoneNumber: profile.nextOfKin?.phoneNumber ?? '',
      address: profile.nextOfKin?.address ?? '',
    },
    reference: {
      name: profile.reference?.name ?? '',
      relationship: profile.reference?.relationship ?? '',
      phoneNumber: profile.reference?.phoneNumber ?? '',
      address: profile.reference?.address ?? '',
    },
  };
}

// Same look as StaffOnboarding.tsx's renderInput/ReusableReactSelect — this
// page is meant to read like the same form, not a different design.
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed';
const subsectionHeadingClass = 'text-md font-semibold text-primary mb-3';

type OptionItem = { id: string; name: string };

/**
 * PATCH /staff/me — self-service subset only (phoneNumber, residentialAddress,
 * nextOfKin, reference). Kyc/BVN/role/department/unit/branch are read-only
 * here (see ProfileHeaderCard for role/dept/unit/branch, and the KYC block
 * below) — they go through their own, differently-gated flows, not this form.
 */
export function ProfilePersonalInfoCard({
  profile,
  onUpdated,
}: {
  profile: Staff;
  onUpdated: (staff: Staff) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const states = useAppSelector((state) => state.lookups.states);
  const [cities, setCities] = useState<OptionItem[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const formik = useFormik<FormValues>({
    enableReinitialize: true,
    initialValues: toFormValues(profile),
    validationSchema: personalInfoSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      setError(null);
      setIsSaving(true);
      try {
        const payload: UpdateOwnProfilePayload = {
          phoneNumber: values.phoneNumber.trim(),
          residentialAddress: {
            state: values.state.trim(),
            city: values.city.trim(),
            street: values.street.trim(),
          },
          nextOfKin: {
            name: values.nextOfKin.name.trim(),
            relationship: values.nextOfKin.relationship.trim(),
            phoneNumber: values.nextOfKin.phoneNumber.trim(),
            address: values.nextOfKin.address.trim(),
          },
          reference: {
            name: values.reference.name.trim(),
            relationship: values.reference.relationship.trim(),
            phoneNumber: values.reference.phoneNumber.trim(),
            address: values.reference.address.trim(),
          },
        };
        const updated = await staffService.updateMe(payload);
        onUpdated(updated);
        toast.success('Profile updated.');
        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update profile');
      } finally {
        setIsSaving(false);
      }
    },
  });

  // Cascading city load, same pattern as StaffOnboarding.tsx — options carry
  // the *name* as their value (not the id), matching what residentialAddress
  // actually stores/submits, so a prepopulated state/city needs no id
  // round-trip to display correctly. Only clears the city when it's no
  // longer valid for the newly-loaded list, so the profile's existing
  // city survives the initial load instead of being wiped on mount.
  useEffect(() => {
    if (!formik.values.state) {
      setCities([]);
      return;
    }

    const stateId = states.find((item) => item.name === formik.values.state)?.id;
    if (!stateId) {
      setCities([]);
      return;
    }

    let isMounted = true;
    setIsLoadingCities(true);
    referenceDataService
      .listCitiesByState(stateId)
      .then((cityList) => {
        if (!isMounted) return;
        setCities(cityList.map((city) => ({ id: city.id, name: city.name })));
      })
      .catch(() => {
        if (isMounted) setCities([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingCities(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.state, states]);

  useEffect(() => {
    if (!isLoadingCities && formik.values.city && !cities.some((city) => city.name === formik.values.city)) {
      formik.setFieldValue('city', '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, isLoadingCities]);

  const stateOptions: SelectOption[] = states.map((state) => ({ label: state.name, value: state.name }));
  const cityOptions: SelectOption[] = cities.map((city) => ({ label: city.name, value: city.name }));

  const cancelEditing = () => {
    formik.resetForm({ values: toFormValues(profile) });
    setError(null);
    setIsEditing(false);
  };

  const handleNumericChange = (field: string, maxLength: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = event.target.value.replace(/\D/g, '').slice(0, maxLength);
    formik.setFieldValue(field, sanitized);
  };

  const getError = (path: string): string => {
    const parts = path.split('.');
    let touchedNode: unknown = formik.touched;
    let errorNode: unknown = formik.errors;
    for (const part of parts) {
      touchedNode = touchedNode && typeof touchedNode === 'object' ? (touchedNode as any)[part] : undefined;
      errorNode = errorNode && typeof errorNode === 'object' ? (errorNode as any)[part] : undefined;
    }
    return touchedNode && typeof errorNode === 'string' ? errorNode : '';
  };

  const renderInput = (field: string, label: string, type: string, value: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        name={field}
        value={value}
        disabled={!isEditing}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        autoComplete="off"
        className={inputClass}
      />
      {getError(field) && <p className="text-xs text-red-600 mt-1">{getError(field)}</p>}
    </div>
  );

  const renderPhoneInput = (field: string, label: string, value: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        name={field}
        value={value}
        disabled={!isEditing}
        onChange={handleNumericChange(field, 11)}
        onBlur={formik.handleBlur}
        placeholder="08000000000"
        autoComplete="off"
        className={inputClass}
      />
      {getError(field) && <p className="text-xs text-red-600 mt-1">{getError(field)}</p>}
    </div>
  );

  // Read-only — KYC changes go through re-verification, not this form.
  const renderReadOnly = (label: string, value: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input type="text" value={value || '—'} disabled readOnly className={inputClass} />
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-bold text-primary">Personal Details</h3>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <PencilIcon size={14} /> Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <XIcon size={14} /> Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircleIcon size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-6">
        <div>
          <h4 className={subsectionHeadingClass}>Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderPhoneInput('phoneNumber', 'Phone Number', formik.values.phoneNumber)}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className={subsectionHeadingClass}>Residential Address</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReusableReactSelect
              name="state"
              label="State"
              formik={formik}
              options={stateOptions}
              placeholder="Search and select state"
              isDisabled={!isEditing}
            />
            <ReusableReactSelect
              name="city"
              label="City"
              formik={formik}
              options={cityOptions}
              placeholder={formik.values.state ? 'Search and select city' : 'Select state first'}
              isDisabled={!isEditing || !formik.values.state}
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
            <div className="md:col-span-2">{renderInput('street', 'Street', 'text', formik.values.street)}</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className={subsectionHeadingClass}>Identity (KYC)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderReadOnly(
              'Date of Birth',
              profile.kyc?.dateOfBirth ? new Date(profile.kyc.dateOfBirth).toLocaleDateString() : '',
            )}
            {renderReadOnly('Gender', GENDER_OPTIONS.find((o) => o.value === profile.kyc?.gender)?.label ?? '')}
            {renderReadOnly('ID Type', profile.kyc?.idType ? ID_TYPE_LABEL[profile.kyc.idType] ?? profile.kyc.idType : '')}
            {renderReadOnly('ID Number', profile.kyc?.idNumber ?? '')}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Identity details are set during onboarding and verified separately — contact an admin to correct them.
          </p>
        </div>

        <div className="border-t pt-4">
          <h4 className={subsectionHeadingClass}>Next of Kin</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderInput('nextOfKin.name', 'Name', 'text', formik.values.nextOfKin.name)}
            {renderInput('nextOfKin.relationship', 'Relationship', 'text', formik.values.nextOfKin.relationship)}
            {renderPhoneInput('nextOfKin.phoneNumber', 'Phone Number', formik.values.nextOfKin.phoneNumber)}
            {renderInput('nextOfKin.address', 'Address', 'text', formik.values.nextOfKin.address)}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className={subsectionHeadingClass}>Reference</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderInput('reference.name', 'Name', 'text', formik.values.reference.name)}
            {renderInput('reference.relationship', 'Relationship', 'text', formik.values.reference.relationship)}
            {renderPhoneInput('reference.phoneNumber', 'Phone Number', formik.values.reference.phoneNumber)}
            {renderInput('reference.address', 'Address', 'text', formik.values.reference.address)}
          </div>
        </div>

        {isEditing && (
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {isSaving ? <LoaderIcon size={16} className="animate-spin" /> : <CheckCircle2Icon size={16} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </form>
    </div>
  );
}
