"use client";

import { SparklesIcon, WrenchIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";

import type { SettingsSection } from "./settings/settings-dialog";

type WorkspaceNavUtilityListProps = {
  onOpenSettings: (section: SettingsSection) => void;
};

export function WorkspaceNavUtilityList({
  onOpenSettings,
}: WorkspaceNavUtilityListProps) {
  const { t } = useI18n();

  return (
    <SidebarGroup className="pt-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => onOpenSettings("tools")}
            tooltip={t.settings.sections.tools}
          >
            <WrenchIcon />
            <span>{t.settings.sections.tools}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => onOpenSettings("skills")}
            tooltip={t.settings.sections.skills}
          >
            <SparklesIcon />
            <span>{t.settings.sections.skills}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
