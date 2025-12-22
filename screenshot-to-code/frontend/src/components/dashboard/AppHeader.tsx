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
    <header className="h-16 border-b border-border bg-background flex items-center px-6 gap-4 shadow-xs">
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
        className="text-muted-foreground hover:text-foreground"
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
