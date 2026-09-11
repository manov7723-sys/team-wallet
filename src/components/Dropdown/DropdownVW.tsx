"use client";
/**
 * @component DropdownVW
 *
 * Accessible DaisyUI dropdown menu with a configurable trigger label and
 * a list of items with optional click handlers and disabled states.
 * Renders with ARIA role="button" on the trigger and role="menu" on the
 * list for screen reader compatibility.
 */
import React from "react";

interface DropdownItem {
  label: string | React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

interface DropdownProps {
  buttonLabel?: string | React.ReactNode;
  items: DropdownItem[];
  className?: string;
  btnClassName?: string;
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  buttonLabel,
  items,
  className = "",
  btnClassName = "",
  disabled = false,
}) => {
  return (
    <div className={`dropdown ${className} z-50`}>
      <div
        tabIndex={0}
        role="button"
        aria-haspopup="menu"
        aria-label={typeof buttonLabel === "string" ? buttonLabel : undefined}
        className={`btn ${btnClassName} ${disabled && "btn-disabled"}`}
      >
        {buttonLabel}
      </div>

      <ul
        tabIndex={0}
        role="menu"
        className="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow"
      >
        {items.map((item, index) => (
          <li key={index} className={`${item.disabled && "menu-disabled"}`} role="none">
            <button
              type="button"
              role="menuitem"
              className="text-left"
              onClick={item.onClick}
              aria-disabled={item.disabled || undefined}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dropdown;
