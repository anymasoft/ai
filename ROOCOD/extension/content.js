// Content Script
console.log('[VPN Extension] Content script loaded');

// Inject proxy detection script
function injectProxyDetection() {
    const script = document.createElement('script');
    script.textContent = `
        window.VPNInfo = {
            isActive: false,
            getCurrentLocation: function() {
                return fetch('https://api.ipify.org?format=json')
                    .then(r => r.json())
                    .catch(e => ({ ip: 'Unknown' }));
            }
        };
        window.dispatchEvent(new Event('vpnInfoReady'));
    `;
    (document.head || document.documentElement).appendChild(script);
}

// Listen for proxy changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'proxyChanged') {
        window.VPNInfo.isActive = request.enabled;
        window.dispatchEvent(new CustomEvent('vpnStatusChanged', {
            detail: { enabled: request.enabled, location: request.location }
        }));
    }
});

// Expose VPN info to window object
injectProxyDetection();

// Log page URL for debugging
console.log('[VPN Extension] Current page:', window.location.href);
