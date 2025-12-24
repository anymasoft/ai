import { BrowserRouter as Router } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { SidebarConfigProvider } from '@/contexts/sidebar-context'
import { AppRouter } from '@/components/router/app-router'
import { useEffect } from 'react'
import { initGTM } from '@/utils/analytics'
import { useAuthStore } from '@/store/auth'
import { useAdminStore } from '@/store/admin'

// Get basename from environment (for deployment) or use empty string for development
const basename = import.meta.env.VITE_BASENAME || ''

function App() {
  const email = useAuthStore((state) => state.email)
  const checkAdmin = useAdminStore((state) => state.checkAdmin)

  // Initialize GTM on app load
  useEffect(() => {
    initGTM();
  }, []);

  // Check admin status when user is authenticated
  useEffect(() => {
    if (email) {
      checkAdmin()
    }
  }, [email, checkAdmin])

  return (
    <div className="font-sans antialiased" style={{ fontFamily: 'var(--font-inter)' }}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <SidebarConfigProvider>
          <Router basename={basename}>
            <AppRouter />
          </Router>
        </SidebarConfigProvider>
      </ThemeProvider>
    </div>
  )
}

export default App
