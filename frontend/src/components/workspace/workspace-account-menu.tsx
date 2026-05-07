"use client";

import { LogOutIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/core/auth/AuthProvider";
import { useI18n } from "@/core/i18n/hooks";

import type { SettingsSection } from "./settings/settings-dialog";

type WorkspaceAccountMenuProps = {
  onOpenSettings: (section: SettingsSection) => void;
};

function getInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || "A";
}

export function WorkspaceAccountMenu({
  onOpenSettings,
}: WorkspaceAccountMenuProps) {
  const [mounted, setMounted] = useState(false);
  const { open: isSidebarOpen } = useSidebar();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    setMounted(true);
  }, []);

  const email = user?.email ?? t.settings.sections.account;
  const systemRole = user?.system_role ?? "";
  const initial = useMemo(() => getInitial(user?.email), [user?.email]);

  const triggerContent = (
    <>
      <Avatar className="size-8 rounded-md border border-sidebar-border/70">
        <AvatarFallback className="bg-primary/10 text-primary rounded-md text-xs font-semibold">
          {initial}
        </AvatarFallback>
      </Avatar>
      {isSidebarOpen && (
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{email}</span>
          <span className="text-sidebar-foreground/60 truncate text-xs capitalize">
            {systemRole}
          </span>
        </div>
      )}
    </>
  );

  return (
    <SidebarMenu className="w-full">
      <SidebarMenuItem>
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                aria-label={email}
                title={!isSidebarOpen ? email : undefined}
              >
                {triggerContent}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={8}
              className="w-64"
            >
              <DropdownMenuLabel className="min-w-0">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 rounded-md border">
                    <AvatarFallback className="bg-primary/10 text-primary rounded-md text-sm font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-medium">{email}</p>
                    {systemRole && (
                      <p className="text-muted-foreground truncate text-xs capitalize">
                        {systemRole}
                      </p>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onOpenSettings("account")}>
                <UserIcon className="size-4" />
                <span>{t.settings.sections.account}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void logout()}
              >
                <LogOutIcon className="size-4" />
                <span>{t.settings.account.signOut}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SidebarMenuButton size="lg" className="pointer-events-none">
            {triggerContent}
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
