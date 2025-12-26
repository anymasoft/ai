import * as React from "react"
import {
  Code2,
  Clock,
  Terminal,
  BookOpen,
  Mail,
  Users,
  DollarSign,
  CreditCard,
  MessageSquare,
  Tag,
  ArrowRight,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useUnreadCount } from "@/hooks/useUnreadCount"
import { useAuthStore } from "@/store/auth"
import { useAdminStore } from "@/store/admin"
import { Button } from "@/components/ui/button"

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

import type { User } from "@/store/auth"

const getNavData = (unreadCount: number, user: User | null, isAdmin: boolean) => {
  const navGroups = [
    {
      label: "Основное",
      items: [
        {
          title: "История",
          url: "/history",
          icon: Clock,
        },
        {
          title: "Обратная связь",
          url: "/feedback",
          icon: MessageSquare,
        },
      ],
    },
    // Раздел "Разработчикам" скрыт временно (API, Документация)
    // TODO: раскрыть когда понадобится
    // {
    //   label: "Разработчикам",
    //   items: [
    //     {
    //       title: "API",
    //       url: "/api",
    //       icon: Terminal,
    //     },
    //     {
    //       title: "Документация",
    //       url: "/docs",
    //       icon: BookOpen,
    //     },
    //     {
    //       title: "Обратная связь",
    //       url: "/feedback",
    //       icon: MessageSquare,
    //     },
    //   ],
    // },
  ]

  navGroups.push({
    label: "Аккаунт",
    items: [
      {
        title: "Тарифы",
        url: "/settings/billing",
        icon: CreditCard,
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
    primaryAction: {
      title: "Сайт из скриншота",
      url: "/playground",
      icon: Code2,
    },
    user: {
      name: user?.name || "Пользователь",
      email: user?.email || "не авторизирован",
    },
    navGroups,
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const unreadCount = useUnreadCount()
  const user = useAuthStore((state) => state.user ?? null)
  const isAdmin = useAdminStore((state) => state.isAdmin)
  const data = React.useMemo(() => getNavData(unreadCount, user, isAdmin), [unreadCount, user, isAdmin])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <img
                  src="/logo/logo-sidebar.webp"
                  alt="Screen2Code"
                  className="h-8 w-8"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Screen2Code</span>
                  <span className="truncate text-xs">SaaS Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Primary Action - Сайт из скриншота */}
        <div className="px-2 pt-2">
          <Button
            asChild
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
          >
            <Link to={data.primaryAction.url}>
              <data.primaryAction.icon className="h-4 w-4" />
              <span>{data.primaryAction.title}</span>
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Link>
          </Button>
        </div>
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
