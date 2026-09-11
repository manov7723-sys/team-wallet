"use client";
/**
 * @component CheckboxVW
 *
 * Accessible labelled DaisyUI checkbox with configurable size, colour
 * variant, and inline error message. Switches to checkbox-error styling
 * automatically when an error prop is provided. Forwards all native
 * <input type="checkbox"> attributes.
 */
import React from "react";

type CheckboxSize = "xs" | "sm" | "md" | "lg" | "xl";

type CheckboxVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "success"
  | "warning"
  | "error";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  variant?: CheckboxVariant;
  size?: CheckboxSize;
  error?: string;
}

const Checkbox = ({
  label,
  variant,
  disabled,
  size = "md",
  className = "",
  error,
  ...props
}: CheckboxProps) => {
  const variantClass = error ? "checkbox-error" : `checkbox-${variant}`;

  return (
    <div className={`${className} flex flex-col`}>
      <label className="label">
        <input
          type="checkbox"
          className={`checkbox checkbox-${size} ${variantClass}`}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          {...props}
        />

        {label && <span className="label-text">{label}</span>}
      </label>

      {error && (
        <p className="text-error mt-1 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default Checkbox;
