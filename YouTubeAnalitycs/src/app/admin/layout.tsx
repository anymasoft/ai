import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import Link from "next/link"
import { Users, Zap, CreditCard, Settings, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  // Double-check admin access
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect("/")
  }

  const navItems = [
    {
      label: "Users",
      href: "/admin/users",
      icon: Users,
    },
    {
      label: "Limits",
      href: "/admin/limits",
      icon: Zap,
    },
    {
      label: "Payments",
      href: "/admin/payments",
      icon: CreditCard,
    },
    {
      label: "System",
      href: "/admin/system",
      icon: Settings,
    },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar */}
      <div className="w-64 border-r bg-muted/50 p-6">
        <div className="mb-8 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-xl font-bold">Admin</h1>
        </div>

        <Separator className="mb-6" />

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  asChild
                >
                  <span>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Button>
              </Link>
            )
          })}
        </nav>

        <Separator className="my-6" />

        <div className="space-y-2 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold">Admin</p>
            <p className="truncate">{session.user.email}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
