"use client";
/**
 * @component InputVW
 *
 * Accessible labelled text input with optional leading icon, trailing
 * icon, badge, and helper text. Auto-generates a stable id via useId
 * for label/input association. Supports a hidden mode that renders a
 * plain hidden input without any wrapper markup. Forwards all native
 * <input> attributes and an optional inputRef for imperative focus.
 */

import React, { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  badge?: string;
  hidden?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  inputClassName?: string;
  labelClassName?: string;
}

const Input = ({
  label,
  helperText,
  startIcon,
  endIcon,
  badge,
  labelClassName = "",
  className = "",
  inputClassName = "",
  hidden = false,
  inputRef,
  required = false,
  id: externalId,
  ...props
}: InputProps) => {
  const autoId = useId();
  const inputId = externalId || autoId;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  if (hidden) {
    return <input ref={inputRef} {...props} className="hidden" />;
  }
  return (
    <fieldset className="fieldset w-full py-0">
      {label && (
        <label
          htmlFor={inputId}
          className={`text-neutral-content text-sm font-medium tracking-wider ${labelClassName ? labelClassName : ""}`}
        >
          {label}{" "}
          {required && (
            <span className="text-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <label className={`input bg-neutral/50 flex w-full items-center ${className}`}>
        {startIcon && <>{startIcon}</>}
        <input
          id={inputId}
          ref={inputRef}
          className={`min-w-0 grow ${inputClassName}`}
          required={required}
          aria-required={required || undefined}
          aria-describedby={helperId}
          {...props}
        />
        {badge && <span className="badge badge-neutral badge-md">{badge}</span>}
        {endIcon && <span className="shrink-0">{endIcon}</span>}
      </label>

      {helperText && (
        <label className="label">
          <span id={helperId} className="label-text-alt">
            {helperText}
          </span>
        </label>
      )}
    </fieldset>
  );
};

export default Input;
