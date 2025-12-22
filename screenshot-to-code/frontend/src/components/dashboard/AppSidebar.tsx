import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Palette,
  History,
  CreditCard,
  Settings,
  ChevronDown,
  Sparkles
} from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppSidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navGroups: NavGroup[] = [
    {
      label: "Инструменты",
      items: [
        { title: "Playground", url: "/playground", icon: Palette },
        { title: "История", url: "/history", icon: History },
      ],
    },
    {
      label: "Аккаунт",
      items: [
        { title: "Биллинг", url: "/settings/billing", icon: CreditCard },
        { title: "Настройки", url: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen w-64 bg-background border-r border-border shadow-xs">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold leading-none">
            screenshot-to-code
          </h2>
          <p className="text-xs text-muted-foreground">
            AI Conversion Tool
          </p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="px-4 py-3">
        <Link to="/playground" className="block w-full">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Новая генерация
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-6 px-2 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground px-2 leading-none">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.url} to={item.url}>
                      <Button
                        variant={isActive(item.url) ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start text-sm font-normal h-9",
                          isActive(item.url) ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                        )}
                        size="sm"
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {item.title}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start hover:bg-accent/50 h-10"
              size="sm"
            >
              <Avatar className="w-8 h-8 mr-2 flex-shrink-0">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs font-medium truncate">User</div>
                <div className="text-xs text-muted-foreground truncate">user@example.com</div>
              </div>
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">user@example.com</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">Настройки</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/billing" className="cursor-pointer">Биллинг</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log("Sign out")}>
              Выход
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
