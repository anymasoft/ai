// Background Service Worker
const API_URL = 'http://localhost:5000';

// Listen for installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[VPN] Extension installed');

    // Set default values
    chrome.storage.local.set({
        vpnEnabled: false,
        autoConnect: false,
        killSwitch: false,
        logLevel: 'error'
    });

    // Check auto-connect setting on startup
    const { autoConnect, selectedLocation } = await chrome.storage.local.get([
        'autoConnect',
        'selectedLocation'
    ]);

    if (autoConnect && selectedLocation) {
        connectVPN(selectedLocation);
    }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        if (changes.vpnEnabled) {
            const isEnabled = changes.vpnEnabled.newValue;
            log('VPN status changed', isEnabled ? 'ENABLED' : 'DISABLED');
            updateIcon(isEnabled);
        }
    }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        try {
            switch (request.action) {
                case 'getStatus':
                    const { vpnEnabled } = await chrome.storage.local.get('vpnEnabled');
                    sendResponse({ status: vpnEnabled });
                    break;

                case 'toggleVPN':
                    await handleToggleVPN(request.enabled);
                    sendResponse({ success: true });
                    break;

                case 'changeLocation':
                    await handleChangeLocation(request.locationId);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            log('Message handler error', error.message, 'error');
            sendResponse({ error: error.message });
        }
    })();

    return true;
});

// Handle VPN Toggle
async function handleToggleVPN(enabled) {
    try {
        if (enabled) {
            const { selectedLocation } = await chrome.storage.local.get('selectedLocation');
            if (!selectedLocation) {
                throw new Error('Location not selected');
            }
            await connectVPN(selectedLocation);
        } else {
            await disconnectVPN();
        }
    } catch (error) {
        log('Toggle VPN error', error.message, 'error');
        throw error;
    }
}

// Connect VPN
async function connectVPN(locationId) {
    try {
        log('Connecting to VPN', `Location: ${locationId}`);

        const response = await fetch(`${API_URL}/api/vpn/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationId })
        });

        if (!response.ok) throw new Error('Failed to connect');

        const data = await response.json();

        // Apply proxy settings
        await applyProxySettings(data.proxy);

        chrome.storage.local.set({ vpnEnabled: true });
        log('VPN connected successfully');
    } catch (error) {
        log('VPN connection error', error.message, 'error');
        throw error;
    }
}

// Disconnect VPN
async function disconnectVPN() {
    try {
        log('Disconnecting VPN');

        // Remove proxy settings
        await removeProxySettings();

        chrome.storage.local.set({ vpnEnabled: false });
        log('VPN disconnected successfully');
    } catch (error) {
        log('VPN disconnection error', error.message, 'error');
        throw error;
    }
}

// Handle Location Change
async function handleChangeLocation(locationId) {
    try {
        const { vpnEnabled } = await chrome.storage.local.get('vpnEnabled');

        if (vpnEnabled) {
            await disconnectVPN();
            await connectVPN(locationId);
        }

        chrome.storage.local.set({ selectedLocation: locationId });
    } catch (error) {
        log('Location change error', error.message, 'error');
        throw error;
    }
}

// Apply Proxy Settings
async function applyProxySettings(proxy) {
    try {
        const proxyConfig = {
            mode: 'fixed_servers',
            rules: {
                singleProxy: {
                    scheme: proxy.type?.toLowerCase() || 'http',
                    host: proxy.host,
                    port: parseInt(proxy.port)
                },
                bypassList: ['localhost', '127.0.0.1']
            }
        };

        chrome.proxy.settings.set(
            { value: proxyConfig, scope: 'regular' },
            () => {
                if (chrome.runtime.lastError) {
                    throw new Error(chrome.runtime.lastError.message);
                }
                log('Proxy settings applied', `${proxy.host}:${proxy.port}`);
            }
        );
    } catch (error) {
        log('Apply proxy error', error.message, 'error');
        throw error;
    }
}

// Remove Proxy Settings
async function removeProxySettings() {
    return new Promise((resolve, reject) => {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            }
            log('Proxy settings removed');
            resolve();
        });
    });
}

// Update Icon
async function updateIcon(isEnabled) {
    const iconPath = isEnabled
        ? { 16: 'assets/icons/icon-16-active.png', 48: 'assets/icons/icon-48-active.png', 128: 'assets/icons/icon-128-active.png' }
        : { 16: 'assets/icons/icon-16.png', 48: 'assets/icons/icon-48.png', 128: 'assets/icons/icon-128.png' };

    chrome.action.setIcon({ path: iconPath });

    const title = isEnabled ? 'VPN: Подключено' : 'VPN: Отключено';
    chrome.action.setTitle({ title });
}

// Logging
async function log(message, details = '', level = 'info') {
    const { logLevel } = await chrome.storage.local.get('logLevel');

    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[logLevel] || levels.error;
    const messageLevel = levels[level] || levels.info;

    if (messageLevel <= currentLevel) {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [VPN-${level.toUpperCase()}]`;
        console.log(`${prefix} ${message}`, details);
    }
}

// Periodic health check
setInterval(async () => {
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) {
            log('Backend health check failed', response.status, 'warn');
        }
    } catch (error) {
        log('Backend connection error', error.message, 'warn');
    }
}, 30000);
