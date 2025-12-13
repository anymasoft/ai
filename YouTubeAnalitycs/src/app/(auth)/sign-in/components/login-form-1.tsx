"use client"

import { signIn } from "next-auth/react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm1({
  className,
  ...props
}: React.ComponentProps<"div">) {

  // Listen for auth success or error message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "auth-success") {
        // Redirect to dashboard after successful auth
        window.location.href = "/dashboard";
      }

      if (event.data.type === "auth-error") {
        // Redirect to error page (for disabled users or other errors)
        // The popup closed itself, so just redirect the main window
        window.location.href = event.data.redirectTo;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleGoogleSignIn = () => {
    // Calculate popup position (centered)
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open intermediate page that will trigger Google OAuth
    const popup = window.open(
      "/auth/google-signin",
      "google-signin",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    // Fallback if popup is blocked
    if (!popup) {
      console.warn("Popup blocked, using redirect method");
      signIn("google", { callbackUrl: "/trending" });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Войдите в YouTube Аналитику</CardTitle>
          <CardDescription>
            Войдите с помощью вашего аккаунта Google
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            type="button"
            onClick={handleGoogleSignIn}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Продолжить с Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
