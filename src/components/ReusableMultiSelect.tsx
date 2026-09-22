import Select, { StylesConfig } from 'react-select';

export type SelectOption = {
  label: string;
  value: string;
};

type ReusableMultiSelectProps = {
  label: string;
  values: string[];
  options: SelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  helperText?: string;
  noOptionsMessage?: string;
  errorMessage?: string;
};

// A separate style object from ReusableReactSelect's (rather than a shared
// export) — react-select's StylesConfig generic is parameterized on IsMulti,
// so the two don't type-unify cleanly even though the visuals match.
const multiSelectStyles: StylesConfig<SelectOption, true> = {
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
  menu: (base) => ({ ...base, zIndex: 30 }),
  // Portalled to <body> (below, via menuPortalTarget/menuPosition) so the
  // dropdown menu escapes any `overflow-hidden` ancestor instead of being
  // clipped by it; the portalled node's z-index just needs to sit above
  // everything else once it's there.
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export function ReusableMultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder,
  isDisabled,
  isLoading,
  helperText,
  noOptionsMessage,
  errorMessage,
}: ReusableMultiSelectProps) {
  const selectedOptions = options.filter((option) => values.includes(option.value));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <Select
        isMulti
        options={options}
        value={selectedOptions}
        onChange={(selected) => onChange(selected.map((option) => option.value))}
        isSearchable
        isClearable
        isDisabled={isDisabled}
        isLoading={isLoading}
        placeholder={placeholder}
        noOptionsMessage={() => noOptionsMessage ?? 'No options found'}
        styles={multiSelectStyles}
        menuPortalTarget={document.body}
        menuPosition="fixed"
      />
      {!errorMessage && helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
      {errorMessage && <p className="text-xs text-red-600 mt-1">{errorMessage}</p>}
    </div>
  );
}
