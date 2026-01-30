"use client"

import type * as React from "react"
import {
  IconBell,
  IconChartBar,
  IconDashboard,
  IconHistory,
  IconMessage,
  IconSettings,
  IconHelp,
  IconSearch,
  IconInnerShadowTop,
  IconReport,
  IconDatabase,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Администратор",
    email: "admin@telemonitor.ru",
    avatar: "/avatars/admin.jpg",
    plan: "pro", // может быть "free", "pro", "enterprise"
  },
  navMain: [
    {
      title: "Мониторинг",
      url: "/channels",
      icon: IconMessage,
    },
    {
      title: "Аналитика",
      url: "/analytics",
      icon: IconChartBar,
    },
    {
      title: "История",
      url: "/history",
      icon: IconHistory,
    },
  ],
  navDocuments: [
    {
      name: "Активные каналы",
      url: "/channels?filter=active",
      icon: IconMessage,
    },
    {
      name: "Отчеты",
      url: "/reports",
      icon: IconReport,
    },
  ],
  navSecondary: [
    {
      title: "Настройки",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "Помощь",
      url: "/help",
      icon: IconHelp,
    },
    {
      title: "Поиск",
      url: "/search",
      icon: IconSearch,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">TeleMonitor</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.navDocuments} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
