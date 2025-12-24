"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { getAdminEmail, isAdmin } from "@/lib/admin-config"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    // Check admin access
    const email = getAdminEmail()

    if (!email || !isAdmin(email)) {
      // Redirect to dashboard if not admin
      router.push("/dashboard")
    }
  }, [router])

  // Render children if admin check passes
  return <>{children}</>
}
