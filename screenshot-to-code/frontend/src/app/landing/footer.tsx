/** biome-ignore-all lint/a11y/useAnchorContent: anchor receives props */
import type { ComponentProps } from "react";
import { Github, Linkedin, Twitter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function Footer({ className, ...props }: ComponentProps<"footer">) {

  return (
    <footer
      className={cn("border-t md:h-(--header-height)", className)}
      {...props}
    >
      <div className="container mx-auto flex h-full flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row md:py-0">
        <div className="flex items-center gap-2">
          <Button
            aria-label="GitHub"
            asChild
            className="size-8"
            size="icon"
            variant="outline"
          >
            <a href="https://github.com/janhesters/react-router-saas-template">
              <Github className="size-4" />
            </a>
          </Button>

          <Button
            aria-label="Twitter"
            asChild
            className="size-8"
            size="icon"
            variant="outline"
          >
            <a href="https://x.com/janhesters">
              <Twitter className="size-4" />
            </a>
          </Button>

          <Button
            aria-label="LinkedIn"
            asChild
            className="size-8"
            size="icon"
            variant="outline"
          >
            <a href="https://www.linkedin.com/in/jan-hesters/">
              <Linkedin className="size-4" />
            </a>
          </Button>

          <div className="h-6">
            <Separator orientation="vertical" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2">
            © 2024 Screen2Code. Все права защищены.
          </span>
        </div>
      </div>
    </footer>
  );
}
