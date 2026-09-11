"use client";
/**
 * @component UserLayoutVW
 *
 * Master shell layout for all authenticated pages.
 *
 * Composes UserSidebarVW, UserHeaderVW, and FooterVW around the page
 * content slot. Manages sidebar collapsed state (desktop) and mobile
 * drawer open/close state, passing both down to the sidebar and header
 * as controlled props. The main content area shifts right to accommodate
 * the sidebar width transition.
 */
import React, { useState } from "react";
import UserHeaderVW from "../Header/UserHeaderVW";
import UserSidebarVW from "../Sidebar/UserSidebarVW";
import FooterVW from "../Footer/FooterVW";

const UserLayoutVW = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-base-100 flex min-h-screen">
      <UserSidebarVW
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}
      >
        <UserHeaderVW setMobileOpen={setMobileOpen} />
        <main className="flex-1 p-6 max-sm:p-3.5">{children}</main>
        <FooterVW />
      </div>
    </div>
  );
};

export default UserLayoutVW;
