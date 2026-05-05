"use client";

import { useCallback, useState } from "react";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { RecentChatList } from "./recent-chat-list";
import { SettingsDialog, type SettingsSection } from "./settings";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceNavChatList } from "./workspace-nav-chat-list";
import { WorkspaceNavMenu } from "./workspace-nav-menu";
import { WorkspaceNavUtilityList } from "./workspace-nav-utility-list";

export function WorkspaceSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { open: isSidebarOpen } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDefaultSection, setSettingsDefaultSection] =
    useState<SettingsSection>("appearance");

  const openSettings = useCallback((section: SettingsSection) => {
    setSettingsDefaultSection(section);
    setSettingsOpen(true);
  }, []);

  return (
    <>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultSection={settingsDefaultSection}
      />
      <Sidebar
        variant="sidebar"
        collapsible="icon"
        className="border-r border-sidebar-border/70 shadow-[8px_0_30px_rgba(15,23,42,0.08)]"
        {...props}
      >
        <SidebarHeader className="border-b border-sidebar-border/70 px-2 py-2">
          <WorkspaceHeader />
        </SidebarHeader>
        <SidebarContent className="gap-2 px-2 py-3">
          <WorkspaceNavChatList />
          <WorkspaceNavUtilityList />
          {isSidebarOpen && <RecentChatList />}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/70 px-2 py-2">
          <WorkspaceNavMenu onOpenSettings={openSettings} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
