"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export default function AuthCallback() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  useEffect(() => {
    // Проверяем есть ли ошибка (например, disabled пользователь)
    if (error) {
      // Если в popup и есть ошибка - закрыть popup и открыть ошибку в родительском окне
      if (window.opener) {
        window.opener.postMessage(
          { 
            type: "auth-error",
            error: error,
            redirectTo: error === "AccessDenied" ? "/errors/access-denied" : "/sign-in"
          }, 
          window.location.origin
        );
        window.close();
      } else {
        // Если не в popup - просто редирект на error страницу
        if (error === "AccessDenied") {
          window.location.href = "/errors/access-denied";
        } else {
          window.location.href = "/sign-in?error=" + encodeURIComponent(error);
        }
      }
      return;
    }

    // This page is opened in a popup after successful OAuth authentication
    // Close the popup and let the parent window refresh
    if (window.opener) {
      window.opener.postMessage({ type: "auth-success" }, window.location.origin);
      window.close();
    } else {
      // If not in popup, redirect to card-generator
      window.location.href = "/card-generator";
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
