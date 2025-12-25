import * as React from "react"
import {
  LayoutDashboard,
  Code2,
  Clock,
  Terminal,
  BookOpen,
  Mail,
  Users,
  DollarSign,
  CreditCard,
  Settings,
  MessageSquare,
  Tag,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"
import { useUnreadCount } from "@/hooks/useUnreadCount"
import { useAuthStore } from "@/store/auth"
import { useAdminStore } from "@/store/admin"

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

const getNavData = (unreadCount: number, email: string | null, isAdmin: boolean) => {
  const navGroups = [
    {
      label: "Основное",
      items: [
        {
          title: "Обзор",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Генератор",
          url: "/playground",
          icon: Code2,
        },
        {
          title: "История",
          url: "/history",
          icon: Clock,
        },
      ],
    },
    {
      label: "Разработчикам",
      items: [
        {
          title: "API",
          url: "/api",
          icon: Terminal,
        },
        {
          title: "Документация",
          url: "/docs",
          icon: BookOpen,
        },
        {
          title: "Отзывы",
          url: "/feedback",
          icon: MessageSquare,
        },
      ],
    },
  ]

  navGroups.push({
    label: "Аккаунт",
    items: [
      {
        title: "Тарифы",
        url: "/settings/billing",
        icon: CreditCard,
      },
      {
        title: "Настройки",
        url: "/settings/account",
        icon: Settings,
      },
    ],
  })

  // Only add Admin section if user is admin (at the bottom)
  if (isAdmin) {
    navGroups.push({
      label: "Администрирование",
      items: [
        {
          title: "Сообщения",
          url: "/admin/messages",
          icon: Mail,
          badge: unreadCount,
        },
        {
          title: "Пользователи",
          url: "/admin/users",
          icon: Users,
        },
        {
          title: "Платежи",
          url: "/admin/payments",
          icon: DollarSign,
        },
        {
          title: "Тарифы",
          url: "/admin/tariffs",
          icon: Tag,
        },
      ],
    })
  }

  return {
    user: {
      name: email ? email.split("@")[0] : "Пользователь",
      email: email || "не авторизирован",
      avatar: "",
    },
    navGroups,
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const unreadCount = useUnreadCount()
  const email = useAuthStore((state) => state.user?.email ?? null)
  const isAdmin = useAdminStore((state) => state.isAdmin)
  const data = React.useMemo(() => getNavData(unreadCount, email, isAdmin), [unreadCount, email, isAdmin])

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
