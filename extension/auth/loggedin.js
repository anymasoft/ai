// loggedin.js - Success page logic

// DOM Elements
const startBtn = document.getElementById('startBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const userInfo = document.getElementById('userInfo');
const userPlan = document.getElementById('userPlan');

// Load user data and display
function loadUserData() {
  chrome.storage.sync.get(['plan', 'user_id', 'authenticated'], (result) => {
    if (result.authenticated) {
      // Show user info
      userInfo.classList.remove('hidden');

      // Display plan
      if (result.plan) {
        userPlan.textContent = result.plan.charAt(0).toUpperCase() + result.plan.slice(1);

        // Change color based on plan
        if (result.plan === 'pro' || result.plan === 'premium') {
          userPlan.classList.remove('text-indigo-600');
          userPlan.classList.add('text-purple-600');
        }
      }

      // Hide upgrade button if already on Pro/Premium
      if (result.plan === 'pro' || result.plan === 'premium') {
        upgradeBtn.classList.add('hidden');
      }
    } else {
      // Not authenticated, redirect to welcome
      window.location.href = 'welcome.html';
    }
  });
}

// Close the tab
function closeTab() {
  // Get current tab and close it
  chrome.tabs.getCurrent((tab) => {
    if (tab) {
      chrome.tabs.remove(tab.id);
    } else {
      // Fallback: just close window
      window.close();
    }
  });
}

// Event Listeners
startBtn.addEventListener('click', () => {
  // Close the tab - user will continue on YouTube
  closeTab();
});

upgradeBtn.addEventListener('click', () => {
  // Navigate to upgrade page
  window.location.href = 'upgrade.html';
});

// Auto-close after 5 seconds (optional)
let autoCloseTimer;
function startAutoCloseTimer() {
  let countdown = 5;
  const originalText = startBtn.textContent;

  autoCloseTimer = setInterval(() => {
    countdown--;
    startBtn.textContent = `Start using Video Reader AI (${countdown}s)`;

    if (countdown <= 0) {
      clearInterval(autoCloseTimer);
      closeTab();
    }
  }, 1000);
}

// Cancel auto-close on user interaction
function cancelAutoClose() {
  if (autoCloseTimer) {
    clearInterval(autoCloseTimer);
    startBtn.textContent = 'Start using Video Reader AI';
  }
}

// Optional: uncomment to enable auto-close
// setTimeout(startAutoCloseTimer, 2000);

// Event listeners to cancel auto-close
startBtn.addEventListener('mouseenter', cancelAutoClose);
upgradeBtn.addEventListener('click', cancelAutoClose);

// Initialize
loadUserData();
