"use client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { IconCreditCard, IconDotsVertical, IconLogout, IconNotification, IconUserCircle } from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
    plan?: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<string>("free")

  useEffect(() => {
    const savedPlan = localStorage.getItem("selectedPlan")
    if (savedPlan) {
      setSelectedPlan(savedPlan)
    }
  }, [])

  const planNames = {
    free: "Бесплатный",
    базовый: "Базовый",
    pro: "Pro",
    enterprise: "Enterprise",
  }

  const getPlanBadgeStyle = (plan: string) => {
    switch (plan) {
      case "pro":
        return "bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-md"
      case "enterprise":
        return "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-md"
      case "базовый":
        return "bg-gradient-to-r from-green-500 to-teal-600 text-white border-0 shadow-md"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const handleBillingClick = () => {
    router.push("/pricing")
  }

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("selectedPlan")
    router.push("/")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="px-2 pb-2">
          <Badge className={`w-full justify-center text-xs px-3 py-1.5 font-medium ${getPlanBadgeStyle(selectedPlan)}`}>
            {planNames[selectedPlan as keyof typeof planNames]}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <IconUserCircle />
                Аккаунт
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBillingClick}>
                <IconCreditCard />
                Тарифы и оплата
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconNotification />
                Уведомления
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
