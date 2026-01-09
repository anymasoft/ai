"use client";

import { useState } from "react";

interface ChannelAvatarProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

/**
 * Компонент аватарки канала с fallback на первую букву названия
 */
export function ChannelAvatar({ src, alt, className = "h-8 w-8" }: ChannelAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Получаем первую букву для fallback
  const initial = alt?.charAt(0)?.toUpperCase() || "?";

  if (!src || hasError) {
    return (
      <div
        className={`${className} rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium`}
        title={alt}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} rounded-full object-cover`}
      onError={() => setHasError(true)}
    />
  );
}
