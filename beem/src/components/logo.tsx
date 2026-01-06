"use client"

import Image from "next/image"

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-block"
      }}
      className={className}
    >
      <Image
        src="/logo.png"
        alt="Logo"
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
        priority
      />
    </div>
  )
}
