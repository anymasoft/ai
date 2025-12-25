import { useAdminStore } from "@/store/admin"
import { useAuthStore } from "@/store/auth"
import { Navigate, useLocation } from "react-router-dom"
import { ReactNode } from "react"

interface ProtectedAdminRouteProps {
  children: ReactNode
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isLoading } = useAuthStore()
  const isAdmin = useAdminStore((state) => state.isAdmin)
  const location = useLocation()

  // First check: is user loading?
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Second check: is user authenticated?
  if (!user) {
    return <Navigate to="/auth/sign-in" replace />
  }

  // Third check: is admin status still loading/undefined?
  // (user exists but we haven't checked admin status yet)
  if (typeof isAdmin === "undefined") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Fourth check: is user admin?
  if (!isAdmin) {
    // Only redirect to /playground if on root path
    // On admin routes (/admin/*), stay on current page - let component handle auth
    if (location.pathname === "/") {
      return <Navigate to="/playground" replace />
    }
    // Allow render for admin routes - they'll show error if auth fails
    return <>{children}</>
  }

  return <>{children}</>
}
