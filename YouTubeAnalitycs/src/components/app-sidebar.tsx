"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  FileBarChart,
  Target,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { SidebarNotification } from "@/components/sidebar-notification"

import { NavMain } from "@/components/nav-main"
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
    name: "YouTube Analytics",
    email: "store@example.com",
    avatar: "",
  },
  navGroups: [
    {
      label: "Analytics",
      items: [
        {
          title: "Overview",
          url: "/dashboard-2",
          icon: LayoutDashboard,
        },
        {
          title: "Competitors",
          url: "/competitors",
          icon: Target,
        },
        {
          title: "Trending",
          url: "/trending",
          icon: TrendingUp,
        },
        {
          title: "Reports",
          url: "/reports",
          icon: FileBarChart,
        },
      ],
    },
    {
      label: "Settings",
      items: [
        {
          title: "Settings",
          url: "#",
          icon: Settings,
          items: [
            {
              title: "Account",
              url: "/settings/account",
            },
            {
              title: "Billing",
              url: "/settings/billing",
            },
          ],
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">YouTube Analytics</span>
                  <span className="truncate text-xs">Analytics Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarNotification />
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
