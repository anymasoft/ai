"use client"

import { redirect } from "next/navigation"
import { useSession } from "next-auth/react"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import Link from "next/link"
import { Users, Zap, CreditCard, Settings, BarChart3, ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { usePathname } from "next/navigation"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const pathname = usePathname()

  // Double-check admin access
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return null
  }

  const navItems = [
    {
      title: "Users",
      href: "/admin/users",
      icon: Users,
    },
    {
      title: "Limits",
      href: "/admin/limits",
      icon: Zap,
    },
    {
      title: "Payments",
      href: "/admin/payments",
      icon: CreditCard,
    },
    {
      title: "System",
      href: "/admin/system",
      icon: Settings,
    },
  ]

  const isActive = (href: string) => pathname === href
  const isAdminActive = navItems.some((item) => isActive(item.href))

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar */}
      <div className="w-64 border-r bg-sidebar">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h1 className="font-semibold">Admin Panel</h1>
          </div>

          {/* Admin Menu */}
          <Collapsible defaultOpen={isAdminActive} className="group/collapsible">
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
              <BarChart3 className="h-4 w-4" />
              <span>Panel</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Admin Info */}
        <div className="absolute bottom-0 left-0 w-64 border-t border-border bg-sidebar p-6">
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Admin</p>
            <p className="truncate">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-32">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
