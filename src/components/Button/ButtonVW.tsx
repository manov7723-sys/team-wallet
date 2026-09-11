"use client";
/**
 * @component ButtonVW
 *
 * Reusable DaisyUI button with variant, size, loading state, and full-width
 * support. Forwards all native <button> attributes. Sets aria-busy during
 * loading and automatically disables interaction while loading is active.
 */
import React from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "outline"
  | "link"
  | "success"
  | "warning"
  | "error";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = ({
  label,
  variant,
  size = "md",
  loading = false,
  fullWidth = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) => {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${fullWidth ? "btn-block" : ""} ${loading ? "loading" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {label}
    </button>
  );
};

export default Button;
