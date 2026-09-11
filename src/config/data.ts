/**
 * @module App Navigation Configuration
 *
 * Defines the sidebar menu items (label, href, icon, optional sub-items)
 * consumed by UserSidebarVW. Update this file to add, remove, or reorder
 * navigation entries without touching the sidebar component itself.
 */

import { MenuItem } from "@/src/types/menu";
import {
  ArrowLeftRight,
  Code2,
  Landmark,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";

export const menuItems: MenuItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transaction", icon: ArrowLeftRight },
  { name: "Members", href: "/members", icon: Users },
  { name: "Treasury", href: "/treasury", icon: Landmark },
  { name: "Trade", href: "/trade", icon: TrendingUp },
  {
    name: "Developers",
    href: "/programs",
    icon: Code2,
    subItems: [
      { name: "Programs", href: "/programs" },
      { name: "Token Manager", href: "/token" },
    ],
  },
  { name: "Settings", href: "/settings", icon: Settings },
];
