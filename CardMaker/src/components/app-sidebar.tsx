"use client"

import * as React from "react"
import {
  Settings,
  FileText,
  MessageSquare,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Logo } from "@/components/logo"
import { SidebarNotification } from "@/components/sidebar-notification"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { Button } from "@/components/ui/button"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { AdminMessagesMenuButton } from "@/components/admin-messages-menu-button"
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
    label: "Основное",
    items: [
      {
        title: "Массовая подготовка",
        url: "/batch",
        icon: Zap,
      },
      {
        title: "Проверка описания",
        url: "/validate",
        icon: CheckCircle2,
      },
      // TODO: История карточек будет добавлена позже
      // {
      //   title: "История карточек",
      //   url: "/cards-history",
      //   icon: FileText,
      // },
    ],
  },
  {
    label: "Поддержка",
    items: [
      {
        title: "Обратная связь",
        url: "/feedback",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Аккаунт",
    items: [
      {
        title: "Биллинг",
        url: "/settings/billing",
        icon: Settings,
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
              <Link href="/card-generator">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    Card Maker
                  </span>
                  <span className="truncate text-xs">Создание карточек</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 py-2 flex justify-center">
          <Button asChild size="icon" variant="default">
            <Link href="/card-generator" title="Создание карточки">
              <Sparkles className="size-5" />
            </Link>
          </Button>
        </div>
        {navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
        {session?.user?.email === ADMIN_EMAIL && (
          <div>
            <div className="px-2 py-2 text-sm font-medium text-sidebar-foreground/70">Администрирование</div>
            <SidebarMenu>
              <AdminMessagesMenuButton />
            </SidebarMenu>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarNotification />
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
