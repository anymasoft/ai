import { IconLayoutList } from "@tabler/icons-react";
import type { ComponentProps } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header({ className, ...props }: ComponentProps<"header">) {

  return (
    <header
      className={cn(
        "fixed top-0 left-0 z-50 w-full border-b backdrop-blur-md",
        className,
      )}
      {...props}
    >
      <div className="container mx-auto flex h-[var(--header-height)] items-center justify-between gap-2 px-4">
        <Link
          className="flex items-center gap-2 self-center font-medium"
          to="/"
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground sm:size-6">
            <IconLayoutList className="size-6 sm:size-4" />
          </div>

          <span className="hidden font-mono sm:block">
            Screen2Code
          </span>
        </Link>

        <nav className="sm:-translate-x-1/2 sm:-translate-y-1/2 flex gap-2 sm:absolute sm:top-1/2 sm:left-1/2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/pricing">
              Цены
            </Link>
          </Button>
        </nav>

        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/auth/sign-in">
              Войти
            </Link>
          </Button>

          <Button asChild size="sm">
            <Link to="/auth/sign-in">
              Зарегистрироваться
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
