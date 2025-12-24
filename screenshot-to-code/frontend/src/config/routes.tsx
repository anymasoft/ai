import { lazy } from 'react'
import { Navigate } from 'react-router-dom'

// Lazy load components for better performance
const Dashboard = lazy(() => import('@/app/dashboard/page'))
const Playground = lazy(() => import('@/app/playground/page'))
const History = lazy(() => import('@/app/history/page'))
const ApiPage = lazy(() => import('@/app/api/page'))
const DocsPage = lazy(() => import('@/app/docs/page'))

// Auth pages
const SignIn = lazy(() => import('@/app/auth/sign-in/page'))

// Settings pages
const AccountSettings = lazy(() => import('@/app/settings/account/page'))
const BillingSettings = lazy(() => import('@/app/settings/billing/page'))

export interface RouteConfig {
  path: string
  element: React.ReactNode
  children?: RouteConfig[]
}

export const routes: RouteConfig[] = [
  // Default route - redirect to dashboard
  {
    path: "/",
    element: <Navigate to="dashboard" replace />
  },

  // Dashboard Route
  {
    path: "/dashboard",
    element: <Dashboard />
  },

  // Application Routes
  {
    path: "/playground",
    element: <Playground />
  },
  {
    path: "/history",
    element: <History />
  },
  {
    path: "/api",
    element: <ApiPage />
  },
  {
    path: "/docs",
    element: <DocsPage />
  },

  // Authentication Routes
  {
    path: "/auth/sign-in",
    element: <SignIn />
  },

  // Settings Routes
  {
    path: "/settings/account",
    element: <AccountSettings />
  },
  {
    path: "/settings/billing",
    element: <BillingSettings />
  },

  // Catch-all route for 404
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
]
