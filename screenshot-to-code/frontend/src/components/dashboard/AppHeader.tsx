import { Moon, Sun, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AppHeader() {
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <header className="h-16 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center px-6 gap-4">
      {/* Left side - Menu toggle (for mobile) */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right side - Theme toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {isDark ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </Button>
    </header>
  );
}
