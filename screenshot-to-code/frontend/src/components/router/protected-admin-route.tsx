import { useAdminStore } from "@/store/admin"
import { Navigate } from "react-router-dom"
import { ReactNode } from "react"

interface ProtectedAdminRouteProps {
  children: ReactNode
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const isAdmin = useAdminStore((state) => state.isAdmin)

  if (!isAdmin) {
    return <Navigate to="/playground" replace />
  }

  return <>{children}</>
}
