"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return; // Wait for session to load
    }

    if (session) {
      // User is authenticated
      router.replace("/dashboard-2");
    } else {
      // User is not authenticated
      router.replace("/landing");
    }
  }, [router, session, status]);

  // Show a loading state while checking auth and redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading...</p>
      </div>
    </div>
  );
}
