import { cn } from "@/lib/utils";
import React from "react";

interface Iphone15ProProps {
  children?: React.ReactNode;
  className?: string;
  src?: string;
}

export function Iphone15Pro({
  children,
  className,
  src,
}: Iphone15ProProps) {
  return (
    <div className={cn(
      "relative mx-auto w-full max-w-sm",
      className
    )}>
      {/* iPhone frame */}
      <div className="relative overflow-hidden rounded-[40px] border-[14px] border-black bg-black shadow-2xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-6 w-40 -translate-x-1/2 rounded-b-3xl bg-black" />

        {/* Screen content */}
        <div className="aspect-[9/19.5] bg-white overflow-hidden rounded-[30px]">
          {src ? (
            <img
              src={src}
              alt="iPhone preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
