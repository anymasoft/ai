"use client"

import { BarChart3 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount"

const adminItems = [
  {
    title: "Пользователи",
    url: "/admin/users",
  },
  {
    title: "Использование",
    url: "/admin/limits",
  },
  {
    title: "Платежи",
    url: "/admin/payments",
  },
  {
    title: "Сообщения",
    url: "/admin/messages",
  },
  {
    title: "Правила маркетплейсов",
    url: "/admin/marketplace-rules",
  },
  {
    title: "Стили описаний",
    url: "/admin/styles",
  },
]

export function AdminMessagesMenuButton() {
  const pathname = usePathname()
  const { unreadCount } = useUnreadMessagesCount()

  const isActive = (url: string): boolean => {
    if (url === "#") return false
    return pathname === url || pathname.startsWith(url + "/")
  }

  const shouldBeOpen = adminItems.some(item => isActive(item.url))
  const messagesItem = adminItems.find(item => item.url === "/admin/messages")

  const activeClasses = "bg-white/5 shadow-inner rounded-xl"

  return (
    <Collapsible
      defaultOpen={shouldBeOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Администрирование" className="cursor-pointer">
            <BarChart3 />
            <span>Панель</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {adminItems.map((item) => {
              const subIsActive = isActive(item.url)
              const isMessagesItem = item.url === "/admin/messages"

              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    className={`cursor-pointer transition-all ${subIsActive ? activeClasses : ""}`}
                    isActive={subIsActive}
                  >
                    <Link href={item.url}>
                      <div className="flex items-center gap-2 flex-1">
                        <span>{item.title}</span>
                        {isMessagesItem && unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto h-fit text-xs">
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
