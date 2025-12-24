import { useAdminStore } from "@/store/admin"
import { useAuthStore } from "@/store/auth"
import { Navigate } from "react-router-dom"
import { ReactNode } from "react"

interface ProtectedAdminRouteProps {
  children: ReactNode
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isLoading } = useAuthStore()
  const isAdmin = useAdminStore((state) => state.isAdmin)

  // First check: is user authenticated?
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

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />
  }

  // Second check: is user admin?
  if (!isAdmin) {
    return <Navigate to="/playground" replace />
  }

  return <>{children}</>
}
