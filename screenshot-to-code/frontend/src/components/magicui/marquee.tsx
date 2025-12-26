import { cn } from "@/lib/utils";
import React from "react";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  speed?: number;
}

export function Marquee({
  children,
  className,
  reverse,
  pauseOnHover = false,
  speed = 40,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden",
        className
      )}
    >
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .marquee-content {
          animation: scroll ${speed}s linear infinite;
        }

        .marquee-wrapper:hover .marquee-content {
          animation-play-state: ${pauseOnHover ? 'paused' : 'running'};
        }
      `}</style>
      <div className="marquee-wrapper flex w-full overflow-hidden">
        <div className="marquee-content flex w-max gap-4 pr-4">
          {children}
        </div>
        <div className="marquee-content flex w-max gap-4 pr-4">
          {children}
        </div>
      </div>
    </div>
  );
}
