// VPN Popup Script
const API_URL = 'http://localhost:5000'; // Backend URL

// DOM Elements
const vpnToggle = document.getElementById('vpnToggle');
const statusText = document.getElementById('statusText');
const statusValue = document.getElementById('statusValue');
const ipValue = document.getElementById('ipValue');
const locationValue = document.getElementById('locationValue');
const locationSelect = document.getElementById('locationSelect');
const proxyDetails = document.getElementById('proxyDetails');
const proxyHost = document.getElementById('proxyHost');
const proxyPort = document.getElementById('proxyPort');
const proxyType = document.getElementById('proxyType');
const settingsBtn = document.getElementById('settingsBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const speedTestBtn = document.getElementById('speedTestBtn');
const speedResult = document.getElementById('speedResult');

// Settings Modal
const settingsModal = document.getElementById('settingsModal');
const closeBtn = document.querySelector('.close');
const autoConnectCheck = document.getElementById('autoConnectCheck');
const killSwitchCheck = document.getElementById('killSwitchCheck');
const logLevelSelect = document.getElementById('logLevelSelect');
const resetBtn = document.getElementById('resetBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadProxies();
    updateStatus();
    setupEventListeners();
});

// Event Listeners
vpnToggle.addEventListener('change', toggleVPN);
locationSelect.addEventListener('change', changeLocation);
settingsBtn.addEventListener('click', openSettings);
closeBtn.addEventListener('click', closeSettings);
adminPanelBtn.addEventListener('click', openAdminPanel);
speedTestBtn.addEventListener('click', runSpeedTest);
resetBtn.addEventListener('click', resetSettings);

window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        closeSettings();
    }
});

// Auto-update status every 2 seconds
setInterval(updateStatus, 2000);

// Toggle VPN
async function toggleVPN() {
    const isEnabled = vpnToggle.checked;

    try {
        const response = await fetch(`${API_URL}/api/vpn/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: isEnabled })
        });

        if (!response.ok) throw new Error('Failed to toggle VPN');

        const data = await response.json();

        // Save to local storage
        chrome.storage.local.set({
            vpnEnabled: isEnabled,
            lastToggleTime: Date.now()
        });

        updateStatus();
    } catch (error) {
        console.error('Toggle VPN error:', error);
        vpnToggle.checked = !isEnabled;
        showError('Ошибка при переключении VPN');
    }
}

// Change VPN Location
async function changeLocation() {
    const locationId = locationSelect.value;
    if (!locationId) return;

    try {
        const response = await fetch(`${API_URL}/api/vpn/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationId })
        });

        if (!response.ok) throw new Error('Failed to change location');

        const data = await response.json();

        // Save to local storage
        chrome.storage.local.set({ selectedLocation: locationId });

        // Update proxy details
        updateProxyDetails(data.proxy);
        updateStatus();
    } catch (error) {
        console.error('Change location error:', error);
        showError('Ошибка при смене локации');
    }
}

// Load Proxies
async function loadProxies() {
    try {
        const response = await fetch(`${API_URL}/api/proxies`);
        if (!response.ok) throw new Error('Failed to load proxies');

        const proxies = await response.json();

        locationSelect.innerHTML = '<option value="">Выберите локацию</option>';

        proxies.forEach(proxy => {
            const option = document.createElement('option');
            option.value = proxy.id;
            option.textContent = `${proxy.name} (${proxy.country})`;
            locationSelect.appendChild(option);
        });

        locationSelect.disabled = false;
    } catch (error) {
        console.error('Load proxies error:', error);
        locationSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        showError('Не удалось загрузить локации. Проверьте соединение с сервером.');
    }
}

// Update Status
async function updateStatus() {
    try {
        const { vpnEnabled, selectedLocation } = await chrome.storage.local.get([
            'vpnEnabled',
            'selectedLocation'
        ]);

        // Update toggle
        vpnToggle.checked = vpnEnabled || false;

        if (vpnEnabled) {
            statusValue.textContent = '✓ Подключено';
            statusValue.style.color = '#27ae60';
            statusText.textContent = 'Подключено';
        } else {
            statusValue.textContent = '✗ Отключено';
            statusValue.style.color = '#e74c3c';
            statusText.textContent = 'Отключено';
        }

        // Get current IP
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            ipValue.textContent = ipData.ip;
        } catch (e) {
            ipValue.textContent = '-';
        }

        // Update location
        if (selectedLocation) {
            locationSelect.value = selectedLocation;
            try {
                const response = await fetch(`${API_URL}/api/proxies/${selectedLocation}`);
                const proxy = await response.json();
                locationValue.textContent = `${proxy.name} (${proxy.country})`;
                updateProxyDetails(proxy);
            } catch (e) {
                locationValue.textContent = 'Неизвестно';
            }
        } else {
            locationValue.textContent = '-';
            proxyDetails.style.display = 'none';
        }
    } catch (error) {
        console.error('Update status error:', error);
    }
}

// Update Proxy Details
function updateProxyDetails(proxy) {
    if (!proxy) {
        proxyDetails.style.display = 'none';
        return;
    }

    proxyHost.textContent = proxy.host;
    proxyPort.textContent = proxy.port;
    proxyType.textContent = proxy.type || 'HTTP';
    proxyDetails.style.display = 'block';
}

// Settings Modal
function openSettings() {
    settingsModal.style.display = 'flex';
}

function closeSettings() {
    settingsModal.style.display = 'none';
    saveSettings();
}

async function loadSettings() {
    const { autoConnect, killSwitch, logLevel } = await chrome.storage.local.get([
        'autoConnect',
        'killSwitch',
        'logLevel'
    ]);

    autoConnectCheck.checked = autoConnect || false;
    killSwitchCheck.checked = killSwitch || false;
    logLevelSelect.value = logLevel || 'error';

    autoConnectCheck.addEventListener('change', saveSettings);
    killSwitchCheck.addEventListener('change', saveSettings);
    logLevelSelect.addEventListener('change', saveSettings);
}

async function saveSettings() {
    chrome.storage.local.set({
        autoConnect: autoConnectCheck.checked,
        killSwitch: killSwitchCheck.checked,
        logLevel: logLevelSelect.value
    });
}

function resetSettings() {
    if (confirm('Вы уверены? Это сбросит все параметры на значения по умолчанию.')) {
        chrome.storage.local.clear(() => {
            loadSettings();
            showSuccess('Параметры сброшены');
        });
    }
}

// Admin Panel
function openAdminPanel() {
    chrome.tabs.create({
        url: chrome.runtime.getURL('admin/admin.html')
    });
}

// Speed Test
async function runSpeedTest() {
    speedTestBtn.disabled = true;
    speedResult.innerHTML = '<div class="spinner"></div> Тестирование...';

    try {
        const startTime = performance.now();

        const response = await fetch(`${API_URL}/api/speed-test`, {
            method: 'GET',
            cache: 'no-store'
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        if (response.ok) {
            const speed = (1000 / duration).toFixed(2);
            speedResult.innerHTML = `✓ ${speed} Mbps (${duration.toFixed(0)}ms)`;
            speedResult.style.color = '#27ae60';
        } else {
            throw new Error('Speed test failed');
        }
    } catch (error) {
        console.error('Speed test error:', error);
        speedResult.textContent = '✗ Ошибка при тестировании';
        speedResult.style.color = '#e74c3c';
    } finally {
        speedTestBtn.disabled = false;
    }
}

// Notification Helpers
function showError(message) {
    const notification = createNotification(message, 'error');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showSuccess(message) {
    const notification = createNotification(message, 'success');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 12px 16px;
        background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
        color: white;
        border-radius: 6px;
        font-size: 12px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    return notification;
}
