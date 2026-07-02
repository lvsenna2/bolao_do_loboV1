"use client";

import { NavigationList } from "./navigation-list";
import { mobileNavigationItems } from "./navigation";

export function MobileBottomNav() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#000d3f]/95 px-2 py-2 shadow-soft backdrop-blur lg:hidden">
      <NavigationList
        className="grid grid-cols-5 gap-1"
        compact
        items={mobileNavigationItems}
        orientation="horizontal"
      />
    </div>
  );
}
