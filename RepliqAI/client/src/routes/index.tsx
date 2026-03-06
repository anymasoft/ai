import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  SignIn,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import HomePage from './HomePage';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import AdminPanel from './AdminPanel';
import Search from './Search';
import Root from './Root';
import Pricing from './Pricing';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'sign-in',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: <SignIn />,
        },
      ],
    },
    {
      path: 'register',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: <Registration />,
        },
      ],
    },
    {
      path: 'forgot-password',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: <RequestPasswordReset />,
        },
      ],
    },
    {
      path: 'reset-password',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'login',
      element: <Navigate to="/sign-in" replace={true} />,
    },
    {
      path: 'login/2fa',
      element: <Navigate to="/sign-in/2fa" replace={true} />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <HomePage />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'sign-in/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        {
          path: 'admin',
          element: <AdminPanel />,
          errorElement: <RouteErrorBoundary />,
        },
        {
          path: '/',
          element: <Root />,
          children: [
            {
              index: true,
              element: <Navigate to="/c/new" replace={true} />,
            },
            {
              path: 'c/:conversationId?',
              element: <ChatRoute />,
            },
            {
              path: 'search',
              element: <Search />,
            },
            {
              path: 'agents',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'agents/:category',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'pricing',
              element: <Pricing />,
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);
