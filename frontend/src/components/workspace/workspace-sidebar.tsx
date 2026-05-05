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
      <Sidebar variant="sidebar" collapsible="icon" {...props}>
        <SidebarHeader className="py-0">
          <WorkspaceHeader />
        </SidebarHeader>
        <SidebarContent>
          <WorkspaceNavChatList />
          <WorkspaceNavUtilityList onOpenSettings={openSettings} />
          {isSidebarOpen && <RecentChatList />}
        </SidebarContent>
        <SidebarFooter>
          <WorkspaceNavMenu onOpenSettings={openSettings} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
