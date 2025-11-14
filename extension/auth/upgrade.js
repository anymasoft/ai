// upgrade.js - Upgrade page logic

// DOM Elements
const backBtn = document.getElementById('backBtn');

// Back button handler
backBtn.addEventListener('click', () => {
  // Go back to previous page or close
  window.history.back();
});

// Track page view (analytics placeholder)
function trackUpgradePageView() {
  chrome.storage.sync.get(['user_id'], (result) => {
    if (result.user_id) {
      console.log('Upgrade page viewed by user:', result.user_id);
      // TODO: Send analytics event to your backend
      // sendAnalyticsEvent('upgrade_page_view', { user_id: result.user_id });
    }
  });
}

// Check if user is already on Pro/Premium plan
function checkCurrentPlan() {
  chrome.storage.sync.get(['plan'], (result) => {
    if (result.plan === 'pro' || result.plan === 'premium') {
      // User is already on Pro, show message
      showAlreadyProMessage();
    }
  });
}

// Show message if already Pro
function showAlreadyProMessage() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50';
  messageDiv.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>You're already on the Pro plan!</span>
    </div>
  `;
  document.body.appendChild(messageDiv);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// Initialize
trackUpgradePageView();
checkCurrentPlan();
