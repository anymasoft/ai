"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Code2,
  Clock,
  Terminal,
  BookOpen,
  CreditCard,
  Settings,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"

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
    name: "Screen2Code",
    email: "user@screen2code.com",
    avatar: "",
  },
  navGroups: [
    {
      label: "Main",
      items: [
        {
          title: "Overview",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Playground",
          url: "/playground",
          icon: Code2,
        },
        {
          title: "History",
          url: "/history",
          icon: Clock,
        },
      ],
    },
    {
      label: "Developer",
      items: [
        {
          title: "API",
          url: "/api",
          icon: Terminal,
        },
        {
          title: "Docs",
          url: "/docs",
          icon: BookOpen,
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          title: "Billing",
          url: "/settings/billing",
          icon: CreditCard,
        },
        {
          title: "Settings",
          url: "/settings/account",
          icon: Settings,
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
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Screen2Code</span>
                  <span className="truncate text-xs">SaaS Platform</span>
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
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
