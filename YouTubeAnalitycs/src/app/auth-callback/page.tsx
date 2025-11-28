"use client"

import { useEffect } from "react"

export default function AuthCallback() {
  useEffect(() => {
    // This page is opened in a popup after successful OAuth authentication
    // Close the popup and let the parent window refresh
    if (window.opener) {
      window.opener.postMessage({ type: "auth-success" }, window.location.origin);
      window.close();
    } else {
      // If not in popup, redirect to dashboard
      window.location.href = "/dashboard";
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
