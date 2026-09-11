"use client";
/**
 * @component TextareaVW
 *
 * Accessible labelled <textarea> with configurable DaisyUI size,
 * optional helper text, and required field indicator. Auto-generates
 * a stable id via useId for label/textarea association and wires up
 * aria-describedby for the helper text. Forwards all native
 * <textarea> attributes.
 */

import React, { useId } from "react";

type TextareaSize = "xs" | "sm" | "md" | "lg" | "xl";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  uiSize?: TextareaSize;
  helperText?: string;
  labelClassName?: string;
}

const Textarea = ({
  label,
  uiSize = "md",
  helperText,
  labelClassName = "",
  className = "",
  required = false,
  id: externalId,
  ...props
}: TextareaProps) => {
  const autoId = useId();
  const textareaId = externalId || autoId;
  const helperId = helperText ? `${textareaId}-helper` : undefined;

  return (
    <fieldset className="fieldset w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className={`text-neutral-content text-sm font-medium tracking-wider ${labelClassName ? labelClassName : ""}`}
        >
          {label}
          {required && (
            <span className="text-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <textarea
        id={textareaId}
        className={`textarea bg-neutral/50 textarea-${uiSize} w-full ${className}`}
        required={required}
        aria-required={required || undefined}
        aria-describedby={helperId}
        {...props}
      />

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

export default Textarea;
