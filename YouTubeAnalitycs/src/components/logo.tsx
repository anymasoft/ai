"use client"

import Image from "next/image"
import logoImage from "@/public/logo.png"

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
        src={logoImage}
        alt="Logo"
        fill
        style={{ objectFit: "contain" }}
        priority
      />
    </div>
  )
}
