// Google Sign In Handler
const googleSignInBtn = document.getElementById('googleSignInBtn');

if (googleSignInBtn) {
  googleSignInBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // TODO: Implement Google OAuth flow using Chrome Identity API
    // chrome.identity.launchWebAuthFlow(...)

    console.log('Google Sign In clicked');
    alert('Google Sign In functionality will be implemented with Chrome Identity API');
  });
}
