import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  FileBarChart,
  Target,
  GitCompare,
  FileText,
  LucideIcon,
} from "lucide-react"

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  items?: NavItem[]
  description?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК НАВИГАЦИИ (SSOT)
 * Используется в:
 * - Sidebar (app-sidebar.tsx)
 * - Command Search (command-search.tsx)
 * - Navigation Menu
 */
export const navigationConfig: NavGroup[] = [
  {
    label: "Analytics",
    items: [
      {
        title: "Overview",
        url: "/dashboard",
        icon: LayoutDashboard,
        description: "Dashboard overview",
      },
      {
        title: "Competitors",
        url: "/competitors",
        icon: Target,
        description: "Track and analyze competitors",
      },
      {
        title: "Compare All",
        url: "/competitors/compare",
        icon: GitCompare,
        description: "Compare multiple channels",
      },
      {
        title: "Trending",
        url: "/trending",
        icon: TrendingUp,
        description: "Trending content insights",
      },
      {
        title: "Scripts",
        url: "/scripts",
        icon: FileText,
        description: "Generated video scripts",
      },
      {
        title: "Reports",
        url: "/reports",
        icon: FileBarChart,
        description: "AI-generated reports",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "Settings",
        url: "/settings/account",
        icon: Settings,
        description: "Account and preferences",
        items: [
          {
            title: "Billing",
            url: "/settings/billing",
            description: "Billing and subscription",
          },
        ],
      },
    ],
  },
]

/**
 * Получить все элементы навигации в плоском массиве (для Search, Command Palette)
 */
export function getAllNavigationItems(): (NavItem & { group?: string })[] {
  const allItems: (NavItem & { group?: string })[] = []
  for (const group of navigationConfig) {
    for (const item of group.items) {
      allItems.push({ ...item, group: group.label })
      if (item.items) {
        for (const subItem of item.items) {
          allItems.push({ ...subItem, group: group.label })
        }
      }
    }
  }
  return allItems
}

/**
 * Проверить валидность URL
 */
export function isValidNavigationUrl(url: string): boolean {
  const allItems = getAllNavigationItems()
  return allItems.some((item) => item.url === url)
}
