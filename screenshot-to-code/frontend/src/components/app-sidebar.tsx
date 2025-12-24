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
} from "lucide-react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"
import { useUnreadCount } from "@/hooks/useUnreadCount"
import { useAuthStore } from "@/store/auth"

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

const getNavData = (unreadCount: number, email: string | null, role: string | null) => {
  const navGroups = [
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
        {
          title: "Feedback",
          url: "/feedback",
          icon: MessageSquare,
        },
      ],
    },
  ]

  // Only add Admin section if user is admin
  if (role === "admin") {
    navGroups.push({
      label: "Admin",
      items: [
        {
          title: "Messages",
          url: "/admin/messages",
          icon: Mail,
          badge: unreadCount,
        },
        {
          title: "Users",
          url: "/admin/users",
          icon: Users,
        },
        {
          title: "Payments",
          url: "/admin/payments",
          icon: DollarSign,
        },
      ],
    })
  }

  navGroups.push({
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
  })

  return {
    user: {
      name: email ? email.split("@")[0] : "User",
      email: email || "not signed in",
      avatar: "",
    },
    navGroups,
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const unreadCount = useUnreadCount()
  const email = useAuthStore((state) => state.email)
  const role = useAuthStore((state) => state.role)
  const data = React.useMemo(() => getNavData(unreadCount, email, role), [unreadCount, email, role])

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
