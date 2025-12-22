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

export function AppSidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { icon: Palette, label: "Playground", path: "/playground" },
    { icon: History, label: "History", path: "/history" },
    { icon: CreditCard, label: "Billing", path: "/settings/billing" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <div className="flex flex-col h-screen w-64 bg-white border-r border-gray-200 dark:bg-zinc-950 dark:border-zinc-800">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            screenshot-to-code
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            AI Conversion Tool
          </p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <Link to="/playground" className="w-full block">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            New Generation
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive(item.path) ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive(item.path) && "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                  )}
                  size="sm"
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 dark:border-zinc-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start hover:bg-gray-100 dark:hover:bg-zinc-800"
              size="sm"
            >
              <Avatar className="w-8 h-8 mr-3">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="text-xs font-medium text-gray-900 dark:text-white">User</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">user@example.com</div>
              </div>
              <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <span className="text-xs text-gray-500">user@example.com</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/billing">Billing</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log("Sign out")}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
