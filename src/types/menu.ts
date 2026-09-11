/**
 * @module Navigation Menu Types
 *
 * Shared TypeScript interfaces for sidebar navigation items.
 * SubMenuItem — a nested link or clickable action within a menu group.
 * MenuItem     — a top-level nav entry with an icon and optional sub-items array.
 */
import React from "react";

export interface SubMenuItem {
  name: string;
  href?: string;
  onClick?: () => void;
}

export interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  subItems?: SubMenuItem[];
}
