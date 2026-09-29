import React from 'react';

type Option = {
  label: string;
  value: string;
};

type ReusableInputFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  touched?: boolean;
  as?: 'input' | 'textarea' | 'select';
  rows?: number;
  options?: Option[];
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  max?: string;
  required?: boolean;
  disabled?: boolean;
};

export function ReusableInputField({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  error,
  touched,
  as = 'input',
  rows = 3,
  options = [],
  maxLength,
  inputMode,
  max,
  required,
  disabled,
}: ReusableInputFieldProps) {
  const hasError = Boolean(touched && error);
  const baseClassName = `w-full px-3 py-2 border rounded-lg text-sm font-body focus:outline-none focus:ring-2 ${hasError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/20'}`;

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-body font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      {as === 'textarea' && (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className={baseClassName}
        />
      )}

      {as === 'select' && (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className={`${baseClassName} bg-white disabled:bg-gray-50`}
        >
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {as === 'input' && (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          max={max}
          disabled={disabled}
          className={`${baseClassName} disabled:bg-gray-50`}
        />
      )}

      {hasError && <p className="text-xs text-red-600 font-body">{error}</p>}
    </div>
  );
}
