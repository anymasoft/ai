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
    label: "Аналитика",
    items: [
      {
        title: "Обзор",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Конкуренты",
        url: "/competitors",
        icon: Target,
      },
      {
        title: "Сравнение",
        url: "/competitors/compare",
        icon: GitCompare,
      },
      {
        title: "Сценарии",
        url: "/trending",
        icon: TrendingUp,
        isFeatured: true,
      },
      {
        title: "История сценариев",
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
        title: "Вопросы",
        url: "/faqs",
        icon: FileText,
      },
      {
        title: "Обратная связь",
        url: "/feedback",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Настройки",
    items: [
      {
        title: "Настройки",
        url: "#",
        icon: Settings,
        items: [
          {
            title: "Биллинг",
            url: "/settings/billing",
          },
        ],
      },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()

  const user = {
    name: session?.user?.name || "Пользователь",
    email: session?.user?.email || "user@example.com",
    avatar: session?.user?.image || "",
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/trending">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    Beem Analytics
                  </span>
                  <span className="truncate text-xs">Панель аналитики</span>
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
            label="Администрирование"
            items={[
              {
                title: "Панель",
                url: "#",
                icon: BarChart3,
                items: [
                  {
                    title: "Пользователи",
                    url: "/admin/users",
                  },
                  {
                    title: "Платежи",
                    url: "/admin/payments",
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
