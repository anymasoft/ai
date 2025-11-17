// Background script для обработки авторизации через Google OAuth
// Управляет токенами и тарифными планами

console.log('[VideoReader Background] Service worker запущен')

// Глобальная переменная для отслеживания OAuth popup
let oauthPopupId: number | null = null

/**
 * Открывает OAuth popup для авторизации через Google
 */
function openOAuthPopup() {
  const authUrl = 'http://localhost:5000/auth'

  chrome.windows.create(
    {
      url: authUrl,
      type: 'popup',
      width: 480,
      height: 640,
      focused: true
    },
    (window) => {
      if (window && window.id) {
        oauthPopupId = window.id
        console.log('[VideoReader Background] OAuth popup opened:', window.id)
      }
    }
  )
}

/**
 * Получает информацию о тарифном плане пользователя
 */
async function getPlan(): Promise<{ email?: string; plan?: string }> {
  try {
    const { auth_token } = await chrome.storage.local.get('auth_token')

    if (!auth_token) {
      console.log('[VideoReader Background] No auth token found, returning Free plan')
      return { plan: 'Free' }
    }

    const response = await fetch('http://localhost:5000/api/plan', {
      headers: {
        Authorization: `Bearer ${auth_token}`
      }
    })

    if (!response.ok) {
      console.error('[VideoReader Background] Failed to fetch plan:', response.status)
      // Токен невалидный - очищаем
      chrome.storage.local.remove('auth_token')
      return { plan: 'Free' }
    }

    const data = await response.json()
    console.log('[VideoReader Background] Plan fetched:', data)
    return data
  } catch (error) {
    console.error('[VideoReader Background] Error fetching plan:', error)
    return { plan: 'Free' }
  }
}

/**
 * Обработчик сообщений от popup и content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Логин через OAuth popup
  if (message.type === 'login') {
    console.log('[VideoReader Background] Login request received')
    openOAuthPopup()
    sendResponse({ success: true })
    return false
  }

  // Получение информации о тарифном плане
  if (message.type === 'get-plan') {
    console.log('[VideoReader Background] Get plan request received')
    getPlan().then(sendResponse)
    return true // Асинхронный ответ
  }

  // Сохранение токена после успешной авторизации
  if (message.type === 'AUTH_SUCCESS' && message.token) {
    console.log('[VideoReader Background] Auth token received from OAuth popup')

    chrome.storage.local.set({ auth_token: message.token }, () => {
      console.log('[VideoReader Background] Auth token saved to storage')
      sendResponse({ success: true })

      // Закрываем OAuth popup если он открыт
      if (oauthPopupId) {
        chrome.windows.remove(oauthPopupId, () => {
          console.log('[VideoReader Background] OAuth popup closed')
          oauthPopupId = null
        })
      }
    })

    return true // Асинхронный ответ
  }

  return false
})

// Обработчик для закрытия OAuth popup
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === oauthPopupId) {
    console.log('[VideoReader Background] OAuth popup was closed')
    oauthPopupId = null
  }
})

console.log('[VideoReader Background] Message handlers registered')
