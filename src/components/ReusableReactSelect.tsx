import { FormikProps } from 'formik';
import { ReactNode } from 'react';
import Select, { StylesConfig } from 'react-select';

export type SelectOption = {
  label: string;
  value: string;
};

type FormValues = Record<string, unknown>;

type ReusableReactSelectProps<TValues extends FormValues> = {
  name: keyof TValues & string;
  label: string;
  formik: FormikProps<TValues>;
  options: SelectOption[];
  placeholder?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  helperText?: string;
  noOptionsMessage?: string;
  labelAction?: ReactNode;
};

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderRadius: 8,
    borderColor: state.isFocused ? '#14523F' : '#D1D5DB',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(20, 82, 63, 0.2)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#14523F' : '#9CA3AF',
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 30,
  }),
  // A raised menu z-index alone doesn't help once this select sits inside
  // an `overflow-hidden` ancestor (several settings-page cards use that for
  // rounded corners) — the menu still renders inline and gets clipped by
  // that ancestor's overflow, not just out-z-indexed. Portalling to <body>
  // (below, via menuPortalTarget/menuPosition) escapes that entirely; this
  // just has to keep the portalled node's own z-index high enough to sit
  // above everything else once it's there.
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

export function ReusableReactSelect<TValues extends FormValues>({
  name,
  label,
  formik,
  options,
  placeholder,
  isDisabled,
  isLoading,
  helperText,
  noOptionsMessage,
  labelAction,
}: ReusableReactSelectProps<TValues>) {
  const currentValue = String(formik.values[name] ?? '');
  const selectedOption = options.find((option) => option.value === currentValue) ?? null;

  const isTouched = Boolean(formik.touched[name]);
  const errorMessage = isTouched && typeof formik.errors[name] === 'string' ? (formik.errors[name] as string) : '';

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {labelAction ? <div>{labelAction}</div> : null}
      </div>
      <Select
        inputId={name}
        // No `name` prop, deliberately — react-select only renders a hidden
        // <input type="hidden" name={name}> for non-JS form-submit fallback,
        // which we don't use (submission goes through formik/fetch). That
        // hidden input is also exactly what browser autofill latches onto
        // for "state"/"city"-shaped fields, silently overwriting the
        // selection whenever a *different* address-looking field (e.g.
        // Address) gets typed into — dropping it removes the autofill
        // target entirely instead of fighting it.
        options={options}
        value={selectedOption}
        onChange={(selected) => {
          // A single shouldValidate:true call, not two — calling both
          // setFieldValue(...,true) and setFieldTouched(...,true) back to
          // back each kicks off its own async validateForm() pass; the two
          // race, and whichever resolves second (sometimes against a
          // stale/pre-update snapshot) wins, which is what left the
          // "required" error stuck until some *other* field's blur forced
          // one more validation pass. Touch first (no validation), then
          // update the value and validate once.
          formik.setFieldTouched(name, true, false);
          formik.setFieldValue(name, selected?.value ?? '', true);
        }}
        onBlur={() => {
          formik.setFieldTouched(name, true, false);
        }}
        isSearchable
        isClearable
        isDisabled={isDisabled}
        isLoading={isLoading}
        placeholder={placeholder}
        noOptionsMessage={() => noOptionsMessage ?? 'No options found'}
        styles={selectStyles}
        // See selectStyles.menuPortal's own comment — escapes any
        // `overflow-hidden` ancestor instead of being clipped by it.
        menuPortalTarget={document.body}
        menuPosition="fixed"
      />
      {!errorMessage && helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
      {errorMessage && <p className="text-xs text-red-600 mt-1">{errorMessage}</p>}
    </div>
  );
}
