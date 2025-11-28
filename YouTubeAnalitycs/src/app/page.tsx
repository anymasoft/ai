"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  // TODO: replace with real auth later
  const isAuthenticated = false;

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard-2");
    } else {
      router.replace("/landing");
    }
  }, [router, isAuthenticated]);

  // Show a loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading...</p>
      </div>
    </div>
  );
}
