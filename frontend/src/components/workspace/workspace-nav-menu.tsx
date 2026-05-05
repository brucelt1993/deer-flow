"use client";

import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";

import type { SettingsSection } from "./settings/settings-dialog";

function NavMenuButtonContent({
  isSidebarOpen,
  t,
}: {
  isSidebarOpen: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return isSidebarOpen ? (
    <div className="text-sidebar-foreground/72 flex w-full items-center gap-2 text-left text-sm">
      <SettingsIcon className="size-4" />
      <span>{t.common.settings}</span>
    </div>
  ) : (
    <div className="flex size-full items-center justify-center">
      <SettingsIcon className="text-sidebar-foreground/72 size-4" />
    </div>
  );
}

type WorkspaceNavMenuProps = {
  onOpenSettings: (section: SettingsSection) => void;
};

export function WorkspaceNavMenu({ onOpenSettings }: WorkspaceNavMenuProps) {
  const [mounted, setMounted] = useState(false);
  const { open: isSidebarOpen } = useSidebar();
  const { t } = useI18n();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SidebarMenu className="w-full">
      <SidebarMenuItem>
        {mounted ? (
          <SidebarMenuButton
            size="lg"
            className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            onClick={() => onOpenSettings("appearance")}
            tooltip={t.common.settings}
          >
            <NavMenuButtonContent isSidebarOpen={isSidebarOpen} t={t} />
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <NavMenuButtonContent isSidebarOpen={isSidebarOpen} t={t} />
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
