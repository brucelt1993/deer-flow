"use client";

import { SparklesIcon, WrenchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";

export function WorkspaceNavUtilityList() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <SidebarGroup className="pt-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/workspace/tools"}
            asChild
            tooltip={t.settings.sections.tools}
            className="text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-foreground"
          >
            <Link href="/workspace/tools">
              <WrenchIcon />
              <span>{t.settings.sections.tools}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/workspace/skills"}
            asChild
            tooltip={t.settings.sections.skills}
            className="text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-foreground"
          >
            <Link href="/workspace/skills">
              <SparklesIcon />
              <span>{t.settings.sections.skills}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
