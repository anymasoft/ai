"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  FileBarChart,
  Target,
  GitCompare,
  FileText,
  MessageSquare,
  BarChart3,
} from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Logo } from "@/components/logo"
import { SidebarNotification } from "@/components/sidebar-notification"
import { ADMIN_EMAIL } from "@/lib/admin-config"

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

const navGroups = [
  {
    label: "Analytics",
    items: [
      {
        title: "Overview",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Competitors",
        url: "/competitors",
        icon: Target,
      },
      {
        title: "Compare All",
        url: "/competitors/compare",
        icon: GitCompare,
      },
      {
        title: "Trending",
        url: "/trending",
        icon: TrendingUp,
      },
      {
        title: "Scripts",
        url: "/scripts",
        icon: FileText,
      },
      // DISABLED: PDF reports with Russian content show as transliteration (bad UX)
      // Uncomment to re-enable when solution is found
      /*
      {
        title: "Reports",
        url: "/reports",
        icon: FileBarChart,
      },
      */
      {
        title: "FAQ",
        url: "/faqs",
        icon: FileText,
      },
      {
        title: "Feedback",
        url: "/feedback",
        icon: MessageSquare,
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
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();

  const user = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "user@example.com",
    avatar: session?.user?.image || "",
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
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
        {navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
        {session?.user?.email === ADMIN_EMAIL && (
          <NavMain
            label="Admin"
            items={[
              {
                title: "Panel",
                url: "#",
                icon: BarChart3,
                items: [
                  {
                    title: "Users",
                    url: "/admin/users",
                  },
                  {
                    title: "Limits",
                    url: "/admin/limits",
                  },
                  {
                    title: "Payments",
                    url: "/admin/payments",
                  },
                  {
                    title: "System",
                    url: "/admin/system",
                  },
                ],
              },
            ]}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarNotification />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}