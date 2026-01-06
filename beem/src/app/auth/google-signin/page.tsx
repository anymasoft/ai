"use client"

import { useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function GoogleSignInPopup() {
  const router = useRouter()

  useEffect(() => {
    // Automatically trigger Google OAuth when this page loads
    // On disabled user, NextAuth will redirect to error page
    // We need to handle that redirect and pass it to parent window
    
    signIn("google", { 
      callbackUrl: "/auth-callback",
      redirect: true
    }).catch((error) => {
      console.error("Sign in error:", error)
      // If signIn fails, redirect to auth-callback with error
      router.push("/auth-callback?error=SignInError")
    })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to Google...</p>
      </div>
    </div>
  )
}
