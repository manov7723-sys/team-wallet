"use client";
/**
 * UserSidebarVW Component
 *
 * A responsive sidebar component for team and user navigation.
 * Handles displaying active team info, switching between teams, navigation through menu items,
 * and authentication actions like login/logout.
 *
 * Features:
 * - Collapsible sidebar for desktop and mobile layouts
 * - Displays active team info with avatar, name, wallet address, threshold, and member count
 * - Dropdown to switch between multiple teams
 * - Protected route handling based on authentication and team membership
 * - Menu items with optional sub-items and active state highlighting
 * - Copy wallet address to clipboard
 * - Responsive adjustments for screen resizing
 *
 *
 * @param {Object} props - Component props
 * @param {boolean} props.collapsed - Whether the sidebar is collapsed (narrow view)
 * @param {(v: boolean) => void} props.setCollapsed - Function to toggle sidebar collapsed state
 * @param {boolean} props.mobileOpen - Whether the sidebar is open on mobile
 * @param {(v: boolean) => void} props.setMobileOpen - Function to toggle sidebar mobile open state
 *
 * @returns {JSX.Element} The sidebar JSX element
 *

 */
import { Fragment, useEffect, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import { menuItems } from "@/src/config/data";
import { usePathname, useRouter } from "next/navigation";
import { CircleCheckBig, Copy, LogOut, Plus, UserCircle, X } from "lucide-react";
import Button from "../Button/ButtonVW";
import { useActiveTeam } from "@/src/providers/ActiveTeamProvider";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTeamOnChain } from "@/src/hooks/useTeamOnChain";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const shortenAddress = (addr: string, chars = 4) =>
  addr ? `${addr.slice(0, chars)}...${addr.slice(-chars)}` : "";

const UserSidebarVW = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { activeTeam, setActiveTeamAddress, teams, isLoading } = useActiveTeam();
  const { isAuthenticated, logout } = useAuth();

  const { data: onChain } = useTeamOnChain(activeTeam?.teamWalletAddress);
  const displayThreshold = onChain?.voteThreshold ?? activeTeam?.threshold ?? 0;

  const displayMemberCount =
    onChain?.voters?.length ?? onChain?.voterCount ?? activeTeam?.memberCount ?? 0;

  const hasMembership = teams.length > 0;

  const PROTECTED_PREFIXES = [
    "/dashboard",
    "/members",
    "/settings",
    "/treasury",
    "/trade",
    "/programs",
    "/token",
  ];

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) setCollapsed(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setCollapsed]);

  const handleNavigation = (item: { href?: string }) => {
    if (!item.href) return;
    let href = item.href;

    if (!isAuthenticated || !hasMembership) {
      if (PROTECTED_PREFIXES.some((p) => href.startsWith(p))) {
        if (!isAuthenticated) {
          router.push("/");
        } else {
          toast.error(t("You need team access for this page"));
        }
        return;
      }
    }

    if (href === "/transaction" && activeTeam?.teamWalletAddress) {
      href = `/transaction/${activeTeam.teamWalletAddress}`;
    }
    router.push(href);
    setMobileOpen(false);
  };

  const handleTeamSwitch = (teamAddress: string) => {
    setActiveTeamAddress(teamAddress);
    if (pathname.startsWith("/transaction/")) {
      router.push(`/transaction/${teamAddress}`);
    }
  };

  const matchRoute = (base: string) => pathname === base || pathname.startsWith(base + "/");
  const isMenuItemActive = (item: { href: string; subItems?: { href?: string }[] }) => {
    if (item.href !== "/dashboard" && matchRoute(item.href)) return true;
    if (item.href === "/dashboard" && pathname === "/dashboard") return true;
    if (item.subItems?.some((sub) => sub.href && matchRoute(sub.href))) return true;
    return false;
  };

  return (
    <>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Sidebar navigation"
        className={`border-border bg-sidebar-background fixed top-0 left-0 z-40 flex h-screen flex-col border-r transition-all duration-300 ${collapsed ? "w-20" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {hasMembership && (
          <div
            className={`flex flex-col items-center justify-between ${collapsed ? "py-2" : "p-4"}`}
          >
            <div
              onClick={() => {
                if (collapsed) setCollapsed(false);
              }}
              className={`bg-secondary/50 w-full rounded-xl p-3 ${!collapsed && "border-glass-border border"}`}
            >
              <div className="flex justify-between">
                <div className={`flex-1 ${collapsed && "flex justify-center"}`}>
                  <div className="flex items-center">
                    <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      {activeTeam?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeTeam.image}
                          alt={activeTeam.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserCircle className="text-primary h-6 w-6" />
                      )}
                    </div>
                    {!collapsed && activeTeam && (
                      <div className="ml-4 min-w-0">
                        <p className="max-w-27 truncate font-semibold xl:text-base">
                          {activeTeam.name}
                        </p>
                        <div className="text-neutral-content flex items-center gap-1">
                          <p className="truncate font-mono text-xs">
                            {shortenAddress(activeTeam.teamWalletAddress)}
                          </p>
                          <Button
                            label={<Copy size={10} />}
                            size="xs"
                            variant="ghost"
                            className="btn-square"
                            onClick={() => {
                              navigator.clipboard.writeText(activeTeam.teamWalletAddress);
                              toast.success("Copied");
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {!collapsed && isLoading && (
                      <div className="ml-4">
                        <div className="loading loading-spinner loading-xs text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                {!collapsed && teams.length > 0 && (
                  <div className="dropdown dropdown-end">
                    <label
                      tabIndex={0}
                      className="btn btn-xs btn-square btn-ghost"
                      aria-label="Switch team"
                    >
                      <ChevronDownIcon className="size-4.5" />
                    </label>
                    <div
                      tabIndex={0}
                      className="dropdown-content bg-base-100 border-base-200 -right-3.5 z-50 mt-6 w-57 rounded-2xl border p-3 shadow-2xl"
                    >
                      <h6 className="text-neutral-content my-2 ms-2 text-xs">{t("SWITCH TEAM")}</h6>
                      <ul
                        className="flex max-h-50 flex-col gap-2 overflow-y-auto pb-0.5"
                        style={{ scrollbarWidth: "thin" }}
                      >
                        {teams.map((team) => {
                          const isActive = activeTeam?.teamWalletAddress === team.teamWalletAddress;
                          return (
                            <li
                              key={team.teamWalletAddress}
                              onClick={() => handleTeamSwitch(team.teamWalletAddress)}
                              className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-start text-xs font-normal ${isActive ? "bg-neutral-content/10" : "hover:bg-neutral-content/10"}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
                                  {team.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={team.image}
                                      alt={team.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <UserCircle className="text-primary h-5 w-5" />
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <p className="line-clamp-1">{team.name}</p>
                                  <p className="text-neutral-content font-mono text-xs">
                                    {shortenAddress(team.teamWalletAddress)}
                                  </p>
                                </div>
                              </div>
                              {isActive && <CircleCheckBig className="text-primary mr-1 size-4" />}
                            </li>
                          );
                        })}
                      </ul>
                      <Button
                        label={
                          <>
                            <Plus className="h-3 w-3" />
                            {t("Create Team")}
                          </>
                        }
                        onClick={() => router.push("/create")}
                        fullWidth
                        size="sm"
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
              </div>
              {!collapsed && activeTeam && (
                <div className="bg-neutral/50 mt-4 flex items-center justify-between rounded-lg max-sm:mt-2">
                  <span className="text-neutral-content">{t("Threshold")}</span>
                  <span className="text-primary font-medium">
                    {displayThreshold} / {displayMemberCount}
                  </span>
                </div>
              )}
            </div>
            <Button
              label={
                <ChevronLeftIcon
                  className={`h-6 w-6 stroke-3 transition-transform ${collapsed ? "rotate-180" : ""}`}
                />
              }
              onClick={() => setCollapsed(!collapsed)}
              className="btn-xs absolute -right-5 hidden h-8 w-8 items-center justify-center rounded-full lg:flex"
            />
            {mobileOpen && (
              <Button
                label={<X className="h-4.5 w-4.5" />}
                onClick={() => setMobileOpen(false)}
                className="btn-xs absolute top-2 -right-5 flex h-8 w-8 items-center justify-center rounded-full lg:hidden"
              />
            )}
          </div>
        )}

        {!hasMembership && (
          <div
            className={`flex flex-col items-center justify-between ${collapsed ? "py-2" : "p-4"}`}
          >
            <div
              className={`bg-secondary/50 w-full rounded-xl p-3 ${!collapsed && "border-glass-border border"}`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-base-200 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <UserCircle className="text-neutral-content/40 h-6 w-6" />
                </div>
                {!collapsed && (
                  <div>
                    <p className="text-neutral-content text-sm font-medium">{t("Viewing")}</p>
                    <p className="text-neutral-content/60 text-xs">{t("Public transaction")}</p>
                  </div>
                )}
              </div>
            </div>
            <Button
              label={
                <ChevronLeftIcon
                  className={`h-6 w-6 stroke-3 transition-transform ${collapsed ? "rotate-180" : ""}`}
                />
              }
              onClick={() => setCollapsed(!collapsed)}
              className="btn-xs absolute -right-5 hidden h-8 w-8 items-center justify-center rounded-full lg:flex"
            />
            {mobileOpen && (
              <Button
                label={<X className="h-4.5 w-4.5" />}
                onClick={() => setMobileOpen(false)}
                className="btn-xs absolute top-2 -right-5 flex h-8 w-8 items-center justify-center rounded-full lg:hidden"
              />
            )}
          </div>
        )}

        <nav
          className="my-2 flex-1 space-y-1 overflow-y-auto px-2 max-sm:mt-2"
          aria-label="Main menu"
        >
          {menuItems.map((item) => {
            const isActive = isMenuItemActive(item);
            const Icon = item.icon;
            return (
              <Fragment key={item.name}>
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setOpenDropdown(openDropdown === item.name ? null : item.name);
                      setCollapsed(false);
                    } else {
                      handleNavigation(item);
                    }
                  }}
                  aria-current={isActive ? "page" : undefined}
                  aria-expanded={item.subItems ? openDropdown === item.name : undefined}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${isActive ? "bg-primary/10 text-primary border-l-4" : "hover:bg-sidebar-accent"}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </div>
                  {!collapsed && item.subItems && (
                    <ChevronDownIcon
                      className={`size-4.5 transition-transform ${openDropdown === item.name ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
                {!collapsed && item.subItems && openDropdown === item.name && (
                  <div className="mt-1 ml-9 space-y-1">
                    {item.subItems.map((sub) => (
                      <button
                        key={sub.name}
                        onClick={() => handleNavigation(sub)}
                        className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors ${pathname === sub.href ? "bg-primary/10 text-primary" : "text-neutral-content hover:bg-sidebar-accent"}`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </nav>

        <div className="border-border border-t p-3">
          {isAuthenticated ? (
            <Button
              label={
                collapsed ? (
                  <LogOut className="h-4.5 w-4.5" />
                ) : (
                  <>
                    <LogOut className="h-4.5 w-4.5" />
                    {t("Logout")}
                  </>
                )
              }
              variant="outline"
              fullWidth
              size="sm"
              className={`btn-error ${collapsed ? "p-1" : ""}`}
              onClick={logout}
            />
          ) : (
            <Button
              label={collapsed ? <LogOut className="h-4.5 w-4.5" /> : "Connect Wallet"}
              variant="primary"
              fullWidth
              size="sm"
              className={collapsed ? "p-1" : ""}
              onClick={() => router.push("/")}
            />
          )}
        </div>
      </aside>
    </>
  );
};

export default UserSidebarVW;
