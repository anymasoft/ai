import { useEffect, useState } from "react"
import "./popup.css"

interface UserData {
  email?: string
  plan?: string
}

function IndexPopup() {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Загружаем токен из storage при монтировании
    chrome.storage.local.get(["auth_token"], (result) => {
      if (result.auth_token) {
        setAuthToken(result.auth_token)
        fetchUserData(result.auth_token)
      } else {
        setLoading(false)
      }
    })
  }, [])

  const fetchUserData = async (token: string) => {
    try {
      const response = await fetch("http://localhost:5000/api/plan", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUserData(data)
      } else {
        // Токен невалидный - очищаем
        setAuthToken(null)
        chrome.storage.local.remove("auth_token")
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = () => {
    // Отправляем сообщение в background для открытия OAuth popup
    chrome.runtime.sendMessage({ type: "login" })

    // Слушаем обновления токена
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.auth_token && changes.auth_token.newValue) {
        setAuthToken(changes.auth_token.newValue)
        fetchUserData(changes.auth_token.newValue)
        chrome.storage.onChanged.removeListener(listener)
      }
    }

    chrome.storage.onChanged.addListener(listener)
  }

  const handleLogout = () => {
    chrome.storage.local.remove("auth_token")
    setAuthToken(null)
    setUserData(null)
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <img src="/assets/logo.png" alt="VideoReader" className="logo" />
        <h1>VideoReader</h1>
      </div>

      <div className="popup-content">
        {authToken && userData ? (
          <div className="user-info">
            <div className="user-email">{userData.email || "User"}</div>
            <div className="user-plan">
              Plan: <span className="plan-badge">{userData.plan || "Free"}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        ) : (
          <div className="login-section">
            <p>Sign in to access premium features</p>
            <button onClick={handleLogin} className="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                  fill="#EA4335"
                />
              </svg>
              Login with Google
            </button>
          </div>
        )}
      </div>

      <div className="popup-footer">
        <small>v1.0.0</small>
      </div>
    </div>
  )
}

export default IndexPopup
