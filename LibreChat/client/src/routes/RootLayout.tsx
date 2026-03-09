import { Outlet } from 'react-router-dom';
import { AuthContextProvider } from '~/hooks/AuthContext';

/**
 * RootLayout компонент обёртывает все маршруты в AuthContextProvider.
 * Это необходимо для того чтобы useNavigate() работал в AuthContext,
 * так как он требует Router context, который создаётся RouterProvider.
 */
export default function RootLayout() {
  return (
    <AuthContextProvider>
      <Outlet />
    </AuthContextProvider>
  );
}
