import { lazy } from 'react'
import { Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { ProtectedRoute } from '@/components/router/protected-route'
import { ProtectedAdminRoute } from '@/components/router/protected-admin-route'

// const Dashboard = lazy(() => import('@/app/dashboard/page')) // TODO: Отключено - Overview не используется
const Playground = lazy(() => import('@/app/playground/page'))
const History = lazy(() => import('@/app/history/page'))
const ApiPage = lazy(() => import('@/app/api/page'))
const DocsPage = lazy(() => import('@/app/docs/page'))
const FeedbackPage = lazy(() => import('@/app/feedback'))

const AdminMessages = lazy(() => import('@/app/admin/messages'))
const AdminMessageDetail = lazy(() => import('@/app/admin/messages/MessageDetail'))
const AdminUsers = lazy(() => import('@/app/admin/users'))
const AdminPayments = lazy(() => import('@/app/admin/payments'))
const AdminTariffs = lazy(() => import('@/app/admin/tariffs'))

const SignIn = lazy(() => import('@/app/auth/sign-in/page'))
const AuthCallback = lazy(() => import('@/app/auth/callback/page'))

const AccountSettings = lazy(() => import('@/app/settings/account/page'))
const BillingSettings = lazy(() => import('@/app/settings/billing/page'))

export interface RouteConfig {
  path: string
  element: React.ReactNode
  children?: RouteConfig[]
}

export const routes: RouteConfig[] = [
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      {
        path: "/",
        element: <Navigate to="/playground" replace />
      },
      // {
      //   path: "/dashboard",
      //   element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      // },
      {
        path: "/playground",
        element: <ProtectedRoute><Playground /></ProtectedRoute>
      },
      {
        path: "/history",
        element: <ProtectedRoute><History /></ProtectedRoute>
      },
      {
        path: "/api",
        element: <ProtectedRoute><ApiPage /></ProtectedRoute>
      },
      {
        path: "/docs",
        element: <ProtectedRoute><DocsPage /></ProtectedRoute>
      },
      {
        path: "/feedback",
        element: <ProtectedRoute><FeedbackPage /></ProtectedRoute>
      },
      {
        path: "/admin/messages",
        element: <ProtectedAdminRoute><AdminMessages /></ProtectedAdminRoute>
      },
      {
        path: "/admin/messages/:id",
        element: <ProtectedAdminRoute><AdminMessageDetail /></ProtectedAdminRoute>
      },
      {
        path: "/admin/users",
        element: <ProtectedAdminRoute><AdminUsers /></ProtectedAdminRoute>
      },
      {
        path: "/admin/payments",
        element: <ProtectedAdminRoute><AdminPayments /></ProtectedAdminRoute>
      },
      {
        path: "/admin/tariffs",
        element: <ProtectedAdminRoute><AdminTariffs /></ProtectedAdminRoute>
      },
      {
        path: "/settings/account",
        element: <ProtectedRoute><AccountSettings /></ProtectedRoute>
      },
      {
        path: "/settings/billing",
        element: <ProtectedRoute><BillingSettings /></ProtectedRoute>
      },
    ]
  },
  {
    path: "/auth/sign-in",
    element: <SignIn />
  },
  {
    path: "/auth/callback",
    element: <AuthCallback />
  },
  {
    path: "*",
    element: <ProtectedRoute><Navigate to="/playground" replace /></ProtectedRoute>
  }
]
