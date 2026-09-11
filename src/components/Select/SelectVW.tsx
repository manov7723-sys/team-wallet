"use client";
/**
 * @component SelectVW
 *
 * Accessible labelled <select> dropdown with DaisyUI styling.
 * Auto-generates a stable id via useId for label/select association.
 * Accepts an options array of { label, value } pairs and an optional
 * placeholder rendered as a disabled first option. Forwards all
 * native <select> attributes.
 */
import React, { useId } from "react";

interface Option {
  label: string;
  value: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  placeholder?: string;
  options: Option[];
  className?: string;
}

const Select = ({
  label,
  placeholder = "select",
  options,
  className = "",
  value,
  onChange,
  disabled,
  id: externalId,
  ...rest
}: SelectProps) => {
  const autoId = useId();
  const selectId = externalId || autoId;

  return (
    <fieldset className="fieldset w-full cursor-pointer py-0">
      {label && (
        <legend className="fieldset-legend">
          <label htmlFor={selectId}>{label}</label>
        </legend>
      )}
      <select
        id={selectId}
        className={`select w-full ${className}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={!label ? placeholder : undefined}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </fieldset>
  );
};

export default Select;
