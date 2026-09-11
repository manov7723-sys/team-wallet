"use client";
/**
 * @component AccordionVW
 *
 * DaisyUI-based collapsible accordion using a native <details> element.
 * Supports custom title content, optional name grouping for radio-style
 * single-open behaviour, a defaultOpen prop, and className overrides
 * for the container, trigger button, and content area.
 */
import React from "react";

interface AccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  name?: string;
  containerClassName?: string;
  btnClassName?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
}

const Accordion = ({
  title,
  children,
  name,
  defaultOpen = false,
  containerClassName = "",
  btnClassName = "",
  contentClassName = "",
  ...props
}: AccordionProps) => {
  return (
    <details
      className={`collapse-arrow collapse ${containerClassName}`}
      name={name}
      open={defaultOpen}
    >
      <summary
        {...props}
        className={`collapse-title flex items-center justify-between ${btnClassName}`}
      >
        {title}
      </summary>
      <div className={`collapse-content ${contentClassName} `}>{children}</div>
    </details>
  );
};

export default Accordion;
