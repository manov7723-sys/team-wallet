"use client";
/**
 * @component TabsVW
 *
 * Accessible controlled tabbed panel component.
 * Renders a tab button row with proper ARIA roles (tablist, tab,
 * tabpanel) and aria-selected state. The active tab's content is
 * rendered in the panel slot. Supports custom active-class overrides
 * per tab and a className prop for outer container styling.
 */
import React from "react";

interface TabItem {
  label: string;
  content: React.ReactNode;
  activeClass?: string;
}

interface TabsProps {
  name: string;
  tabs: TabItem[];
  activeIndex: number;
  onChange?: (index: number) => void;
  className?: string;
  tabContentclassName?: string;
}

const TabsVW = ({
  tabs,
  activeIndex,
  onChange,
  className = "",
  tabContentclassName = "",
}: TabsProps) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="bg-base-200 flex gap-2 rounded-xl p-1" role="tablist">
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              type="button"
              key={index}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange?.(index)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? (tab.activeClass ?? "bg-primary text-primary-content shadow-sm")
                  : "bg-base-300"
              } `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className={`mt-4 ${tabContentclassName}`}>
        {tabs[activeIndex]?.content}
      </div>
    </div>
  );
};

export default TabsVW;
