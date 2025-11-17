export {}

// Background service worker for VideoReader extension
// This handles token-based authentication and API communication

console.log('VideoReader background service worker started')

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  PLAN: 'user_plan',
  EMAIL: 'user_email'
}

// API endpoints
const API_BASE = 'http://localhost:5000'
const API_ENDPOINTS = {
  LOGIN: `${API_BASE}/api/login`,
  PLAN: `${API_BASE}/api/plan`
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/**
 * Get auth token from storage
 */
async function getToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.TOKEN])
    return result[STORAGE_KEYS.TOKEN] || null
  } catch (error) {
    console.error('Failed to get token:', error)
    return null
  }
}

/**
 * Save auth token to storage
 */
async function saveToken(token: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: token })
    console.log('Token saved successfully')
  } catch (error) {
    console.error('Failed to save token:', error)
  }
}

/**
 * Clear auth token from storage
 */
async function clearToken(): Promise<void> {
  try {
    await chrome.storage.local.remove([STORAGE_KEYS.TOKEN])
    console.log('Token cleared')
  } catch (error) {
    console.error('Failed to clear token:', error)
  }
}

// =============================================================================
// API CALLS (STUBS)
// =============================================================================

/**
 * Login stub - will be implemented later
 * TODO: Implement OAuth flow or email/password login
 */
async function login(): Promise<{ token: string } | null> {
  console.log('[STUB] login() called - not implemented yet')

  // TODO: Implement actual login logic
  // For now, return null (no authentication)

  return null
}

/**
 * Get user plan from backend
 */
async function getPlan(): Promise<{ plan: string; email: string } | null> {
  console.log('Fetching user plan...')

  const token = await getToken()

  if (!token) {
    console.log('No token found - user not authenticated')
    // Save Free plan to storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLAN]: 'Free',
      [STORAGE_KEYS.EMAIL]: null
    })
    return { plan: 'Free', email: '' }
  }

  try {
    const response = await fetch(API_ENDPOINTS.PLAN, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 401) {
      // Token invalid or expired
      console.log('Token invalid - clearing')
      await clearToken()
      await chrome.storage.local.set({
        [STORAGE_KEYS.PLAN]: 'Free',
        [STORAGE_KEYS.EMAIL]: null
      })
      return { plan: 'Free', email: '' }
    }

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()

    if (data.status === 'ok' && data.plan && data.email) {
      // Save to storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.PLAN]: data.plan,
        [STORAGE_KEYS.EMAIL]: data.email
      })

      console.log(`User plan: ${data.plan} (${data.email})`)
      return { plan: data.plan, email: data.email }
    }

    return null
  } catch (error) {
    console.error('Failed to fetch plan:', error)
    // Default to Free on error
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLAN]: 'Free',
      [STORAGE_KEYS.EMAIL]: null
    })
    return { plan: 'Free', email: '' }
  }
}

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

/**
 * Handle messages from content scripts or popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message)

  switch (message.type) {
    case 'GET_TOKEN':
      getToken().then(token => sendResponse({ token }))
      return true // async response

    case 'SAVE_TOKEN':
      saveToken(message.token).then(() => sendResponse({ success: true }))
      return true

    case 'CLEAR_TOKEN':
      clearToken().then(() => sendResponse({ success: true }))
      return true

    case 'GET_PLAN':
      getPlan().then(plan => sendResponse(plan))
      return true

    case 'LOGIN':
      login().then(result => sendResponse(result))
      return true

    default:
      console.warn('Unknown message type:', message.type)
      sendResponse({ error: 'Unknown message type' })
  }
})

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Fetch plan on extension install/update
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('VideoReader extension installed/updated')
  await getPlan()
})

/**
 * Fetch plan on browser startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started - fetching plan')
  await getPlan()
})
