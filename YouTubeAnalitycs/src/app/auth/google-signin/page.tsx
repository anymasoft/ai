"use client"

import { useEffect } from "react"
import { signIn } from "next-auth/react"

export default function GoogleSignInPopup() {
  useEffect(() => {
    // Automatically trigger Google OAuth when this page loads
    signIn("google", { callbackUrl: "/auth-callback" })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to Google...</p>
      </div>
    </div>
  )
}
