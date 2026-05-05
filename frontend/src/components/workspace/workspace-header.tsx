"use client";

import { MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";
import { env } from "@/env";
import { cn } from "@/lib/utils";

export function WorkspaceHeader({ className }: { className?: string }) {
  const { t } = useI18n();
  const { state } = useSidebar();
  const pathname = usePathname();

  return (
    <>
      <div
        className={cn(
          "group/workspace-header flex h-12 flex-col justify-center",
          className,
        )}
      >
        {state === "collapsed" ? (
          <div className="group-has-data-[collapsible=icon]/sidebar-wrapper:-translate-y flex w-full cursor-pointer items-center justify-center">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-semibold group-hover/workspace-header:hidden">
              A
            </div>
            <SidebarTrigger className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hidden group-hover/workspace-header:block" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true" ? (
              <Link
                href="/"
                className="text-sidebar-foreground ml-1 flex items-center gap-2"
              >
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-semibold">
                  A
                </span>
                <span className="text-sm font-semibold tracking-wide">
                  Aether 靈境
                </span>
              </Link>
            ) : (
              <div className="text-sidebar-foreground ml-1 flex cursor-default items-center gap-2">
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-semibold">
                  A
                </span>
                <span className="text-sm font-semibold tracking-wide">
                  Aether 靈境
                </span>
              </div>
            )}
            <SidebarTrigger className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          </div>
        )}
      </div>
      <SidebarMenu className="pt-1">
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/workspace/chats/new"}
            asChild
            className="text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-foreground"
          >
            <Link href="/workspace/chats/new">
              <MessageSquarePlus size={16} />
              <span>{t.sidebar.newChat}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
