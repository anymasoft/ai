// Google OAuth Configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const REDIRECT_URI = chrome.identity.getRedirectURL('oauth2');

// Google Sign In Handler
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Function to open OAuth popup centered on screen
function openGoogleAuthPopup() {
  // Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' '));

  // Popup dimensions - compact and centered
  const popupWidth = 480;
  const popupHeight = 640;

  // Calculate center position
  const left = Math.round((screen.width - popupWidth) / 2);
  const top = Math.round((screen.height - popupHeight) / 2);

  // Popup features - compact, non-resizable window
  const popupFeatures = [
    "popup=yes",
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=no",
    "resizable=no",
    "toolbar=no",
    "menubar=no",
    "status=no"
  ].join(",");

  // Open popup window
  const popup = window.open(authUrl.toString(), 'VideoReaderAI Login', popupFeatures);

  // Check if popup was blocked
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    alert('Popup was blocked. Please allow popups for this site and try again.');
    return;
  }

  // Monitor popup for redirect
  const pollTimer = setInterval(() => {
    try {
      if (popup.closed) {
        clearInterval(pollTimer);
        console.log('Popup closed by user');
        return;
      }

      // Check if popup redirected to our redirect URI
      if (popup.location.href.indexOf(REDIRECT_URI) === 0) {
        clearInterval(pollTimer);

        // Extract access token from URL
        const url = new URL(popup.location.href);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token');

        if (accessToken) {
          console.log('Access token received:', accessToken);

          // Close popup
          popup.close();

          // Get user info from Google
          getUserInfo(accessToken);
        } else {
          popup.close();
          alert('Failed to get access token');
        }
      }
    } catch (error) {
      // Cross-origin error - popup is still on Google's domain
      // This is expected, continue polling
    }
  }, 500);
}

// Alternative: Use Chrome Identity API (recommended for Chrome Extensions)
function openGoogleAuthWithChromeAPI() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' '));

  chrome.identity.launchWebAuthFlow(
    {
      url: authUrl.toString(),
      interactive: true
    },
    (redirectUrl) => {
      if (chrome.runtime.lastError) {
        console.error('OAuth error:', chrome.runtime.lastError);
        alert('Sign-in failed. Please try again.');
        return;
      }

      if (!redirectUrl) {
        alert('Sign-in was cancelled.');
        return;
      }

      // Extract access token from redirect URL
      const url = new URL(redirectUrl);
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      if (accessToken) {
        console.log('Access token received:', accessToken);
        getUserInfo(accessToken);
      } else {
        alert('Failed to get access token');
      }
    }
  );
}

// Get user info from Google
async function getUserInfo(accessToken) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const userInfo = await response.json();
    console.log('User info:', userInfo);

    // Save user data to Chrome storage
    chrome.storage.sync.set({
      user_id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      authenticated: true,
      access_token: accessToken,
      auth_timestamp: Date.now()
    }, () => {
      console.log('User data saved');
      alert(`Welcome, ${userInfo.name}! You are now signed in.`);

      // Redirect to main page or close window
      // window.location.href = 'main.html';
    });

  } catch (error) {
    console.error('Error getting user info:', error);
    alert('Failed to get user information');
  }
}

// Event listener
if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // Choose one of the methods:

    // Method 1: Use Chrome Identity API (Recommended for Chrome Extensions)
    // This uses Chrome's built-in OAuth flow
    openGoogleAuthWithChromeAPI();

    // Method 2: Use custom popup window (if you need more control)
    // This opens a centered popup window
    // openGoogleAuthPopup();
  });
}

console.log('OAuth script loaded');
console.log('Redirect URI:', REDIRECT_URI);
