// welcome.js - Google OAuth authentication logic

// Configuration
const CONFIG = {
  // TODO: Replace with your actual Google OAuth URL
  GOOGLE_OAUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth?...',
  // TODO: Replace with your actual backend URL
  BACKEND_URL: 'https://your-server.com/auth/google',
  REDIRECT_URL: chrome.identity.getRedirectURL('oauth2')
};

// DOM Elements
const googleSignInBtn = document.getElementById('googleSignInBtn');
const loadingIndicator = document.getElementById('loadingIndicator');

// Show loading state
function showLoading(isLoading) {
  if (isLoading) {
    googleSignInBtn.disabled = true;
    googleSignInBtn.classList.add('opacity-50', 'cursor-not-allowed');
    loadingIndicator.classList.remove('hidden');
  } else {
    googleSignInBtn.disabled = false;
    googleSignInBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    loadingIndicator.classList.add('hidden');
  }
}

// Extract ID token from redirect URL
function extractIdToken(redirectUrl) {
  const url = new URL(redirectUrl);
  const hash = url.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('id_token') || params.get('access_token');
}

// Send token to backend
async function authenticateWithBackend(idToken) {
  try {
    const response = await fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id_token: idToken })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    return data; // Expected: { user_id, plan, jwt }
  } catch (error) {
    console.error('Backend authentication error:', error);
    throw error;
  }
}

// Save user data to Chrome storage
function saveUserData(userData) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({
      user_id: userData.user_id,
      plan: userData.plan,
      jwt: userData.jwt,
      authenticated: true,
      auth_timestamp: Date.now()
    }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Main Google Sign-In flow
async function handleGoogleSignIn() {
  showLoading(true);

  try {
    // Launch Google OAuth flow
    chrome.identity.launchWebAuthFlow(
      {
        url: CONFIG.GOOGLE_OAUTH_URL,
        interactive: true
      },
      async (redirectUrl) => {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error('OAuth error:', chrome.runtime.lastError);
          alert('Sign-in failed. Please try again.');
          showLoading(false);
          return;
        }

        if (!redirectUrl) {
          alert('Sign-in was cancelled.');
          showLoading(false);
          return;
        }

        try {
          // Extract ID token
          const idToken = extractIdToken(redirectUrl);

          if (!idToken) {
            throw new Error('No ID token received');
          }

          // Authenticate with backend
          const userData = await authenticateWithBackend(idToken);

          // Save to Chrome storage
          await saveUserData(userData);

          // Redirect to success page
          window.location.href = 'loggedin.html';

        } catch (error) {
          console.error('Authentication process failed:', error);
          alert('Authentication failed. Please try again.');
          showLoading(false);
        }
      }
    );
  } catch (error) {
    console.error('Sign-in error:', error);
    alert('An error occurred. Please try again.');
    showLoading(false);
  }
}

// Event Listeners
googleSignInBtn.addEventListener('click', handleGoogleSignIn);

// Check if already authenticated
chrome.storage.sync.get(['authenticated', 'jwt'], (result) => {
  if (result.authenticated && result.jwt) {
    // User is already signed in, redirect
    window.location.href = 'loggedin.html';
  }
});
