// Admin Panel Script
const API_URL = 'http://localhost:5000';
let currentEditingProxy = null;

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const proxiesTableBody = document.getElementById('proxiesTableBody');
const usersTableBody = document.getElementById('usersTableBody');
const addProxyBtn = document.getElementById('addProxyBtn');
const proxyModal = document.getElementById('proxyModal');
const proxyForm = document.getElementById('proxyForm');
const closeBtn = document.querySelector('.close');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadProxies();
    loadStatistics();
    loadLogs();
    checkAdminAuth();
});

// Setup Event Listeners
function setupEventListeners() {
    navItems.forEach(item => {
        item.addEventListener('click', handleNavClick);
    });

    addProxyBtn.addEventListener('click', openProxyModal);
    closeBtn.addEventListener('click', closeProxyModal);
    proxyForm.addEventListener('submit', handleProxySubmit);
    logoutBtn.addEventListener('click', handleLogout);

    // Filters
    document.getElementById('proxySearch').addEventListener('input', filterProxies);
    document.getElementById('countryFilter').addEventListener('change', filterProxies);
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    document.getElementById('userStatusFilter').addEventListener('change', filterUsers);
    document.getElementById('logLevelFilter').addEventListener('change', loadLogs);

    // Settings
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === proxyModal) {
            closeProxyModal();
        }
    });
}

// Navigation
function handleNavClick(e) {
    e.preventDefault();

    // Update active nav item
    navItems.forEach(item => item.classList.remove('active'));
    e.target.closest('.nav-item').classList.add('active');

    // Update active section
    const sectionName = e.target.closest('.nav-item').dataset.section;
    contentSections.forEach(section => section.classList.remove('active'));
    document.getElementById(`${sectionName}-section`).classList.add('active');

    // Update page title
    const titles = {
        proxies: 'Управление прокси',
        users: 'Управление пользователями',
        statistics: 'Статистика',
        settings: 'Параметры системы',
        logs: 'Логи системы'
    };
    document.getElementById('pageTitle').textContent = titles[sectionName] || 'Админ-панель';

    // Reload data if needed
    if (sectionName === 'proxies') loadProxies();
    if (sectionName === 'users') loadUsers();
    if (sectionName === 'statistics') loadStatistics();
}

// Proxies Management
async function loadProxies() {
    try {
        const response = await fetch(`${API_URL}/api/admin/proxies`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load proxies');

        const proxies = await response.json();
        renderProxiesTable(proxies);
    } catch (error) {
        console.error('Load proxies error:', error);
        proxiesTableBody.innerHTML = `<tr><td colspan="8" class="loading">Ошибка загрузки</td></tr>`;
    }
}

function renderProxiesTable(proxies) {
    proxiesTableBody.innerHTML = proxies.map(proxy => `
        <tr>
            <td><strong>${proxy.name}</strong></td>
            <td>${proxy.country}</td>
            <td>${proxy.host}</td>
            <td>${proxy.port}</td>
            <td>${proxy.type}</td>
            <td>
                <span class="status-badge ${proxy.status === 'active' ? '' : 'inactive'}">
                    ${proxy.status === 'active' ? '✓ Активен' : '✗ Неактивен'}
                </span>
            </td>
            <td>${proxy.users_count || 0}</td>
            <td>
                <button class="btn btn-primary" onclick="editProxy('${proxy.id}')">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteProxy('${proxy.id}')">Удалить</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="loading">Нет прокси</td></tr>';
}

function openProxyModal() {
    currentEditingProxy = null;
    proxyForm.reset();
    document.querySelector('.modal-content h2').textContent = 'Новый прокси';
    proxyModal.style.display = 'flex';
}

function closeProxyModal() {
    proxyModal.style.display = 'none';
    proxyForm.reset();
    currentEditingProxy = null;
}

async function editProxy(proxyId) {
    try {
        const response = await fetch(`${API_URL}/api/admin/proxies/${proxyId}`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load proxy');

        const proxy = await response.json();
        currentEditingProxy = proxy.id;

        document.getElementById('proxyName').value = proxy.name;
        document.getElementById('proxyCountry').value = proxy.country;
        document.getElementById('proxyHost').value = proxy.host;
        document.getElementById('proxyPort').value = proxy.port;
        document.getElementById('proxyType').value = proxy.type;
        document.getElementById('proxyUsername').value = proxy.username || '';
        document.getElementById('proxyPassword').value = proxy.password || '';

        document.querySelector('.modal-content h2').textContent = 'Редактировать прокси';
        proxyModal.style.display = 'flex';
    } catch (error) {
        console.error('Edit proxy error:', error);
        alert('Ошибка при загрузке данных прокси');
    }
}

async function deleteProxy(proxyId) {
    if (!confirm('Вы уверены? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/proxies/${proxyId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to delete proxy');

        loadProxies();
        alert('Прокси удален успешно');
    } catch (error) {
        console.error('Delete proxy error:', error);
        alert('Ошибка при удалении прокси');
    }
}

async function handleProxySubmit(e) {
    e.preventDefault();

    const proxyData = {
        name: document.getElementById('proxyName').value,
        country: document.getElementById('proxyCountry').value,
        host: document.getElementById('proxyHost').value,
        port: parseInt(document.getElementById('proxyPort').value),
        type: document.getElementById('proxyType').value,
        username: document.getElementById('proxyUsername').value,
        password: document.getElementById('proxyPassword').value
    };

    try {
        const url = currentEditingProxy
            ? `${API_URL}/api/admin/proxies/${currentEditingProxy}`
            : `${API_URL}/api/admin/proxies`;

        const method = currentEditingProxy ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify(proxyData)
        });

        if (!response.ok) throw new Error('Failed to save proxy');

        closeProxyModal();
        loadProxies();
        alert('Прокси сохранен успешно');
    } catch (error) {
        console.error('Save proxy error:', error);
        alert('Ошибка при сохранении прокси');
    }
}

// Filtering
function filterProxies() {
    const searchTerm = document.getElementById('proxySearch').value.toLowerCase();
    const country = document.getElementById('countryFilter').value;

    const rows = proxiesTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(searchTerm) && (!country || row.textContent.includes(country));
        row.style.display = matches ? '' : 'none';
    });
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const status = document.getElementById('userStatusFilter').value;

    const rows = usersTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(searchTerm) && (!status || row.textContent.includes(status));
        row.style.display = matches ? '' : 'none';
    });
}

// Users Management
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load users');

        const users = await response.json();
        renderUsersTable(users);
    } catch (error) {
        console.error('Load users error:', error);
        usersTableBody.innerHTML = `<tr><td colspan="6" class="loading">Ошибка загрузки</td></tr>`;
    }
}

function renderUsersTable(users) {
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${new Date(user.registered_at).toLocaleDateString('ru-RU')}</td>
            <td>
                <span class="status-badge ${user.status}">
                    ${user.status === 'active' ? '✓ Активен' : user.status === 'inactive' ? '⚠ Неактивен' : '✗ Заблокирован'}
                </span>
            </td>
            <td>${user.proxy_name || '-'}</td>
            <td>
                <button class="btn btn-primary" onclick="viewUser('${user.id}')">Просмотр</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="loading">Нет пользователей</td></tr>';
}

function viewUser(userId) {
    alert(`Просмотр пользователя: ${userId}`);
}

// Statistics
async function loadStatistics() {
    try {
        const response = await fetch(`${API_URL}/api/admin/statistics`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load statistics');

        const stats = await response.json();

        document.getElementById('totalProxies').textContent = stats.total_proxies;
        document.getElementById('activeUsers').textContent = stats.active_users;
        document.getElementById('dailyTraffic').textContent = `${(stats.daily_traffic / 1024 / 1024 / 1024).toFixed(2)} GB`;
        document.getElementById('uniqueIPs').textContent = stats.unique_ips;

        // Draw simple chart
        drawActivityChart(stats.activity_chart);
    } catch (error) {
        console.error('Load statistics error:', error);
    }
}

function drawActivityChart(data) {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 300;

    if (!data || data.length === 0) return;

    const maxValue = Math.max(...data);
    const barWidth = canvas.width / data.length;
    const barHeight = canvas.height / maxValue;

    ctx.fillStyle = '#667eea';
    data.forEach((value, index) => {
        ctx.fillRect(
            index * barWidth,
            canvas.height - value * barHeight,
            barWidth - 2,
            value * barHeight
        );
    });
}

// Settings
async function saveSettings() {
    const settings = {
        max_users_per_proxy: parseInt(document.getElementById('maxUsersPerProxy').value),
        default_proxy_timeout: parseInt(document.getElementById('defaultProxyTimeout').value),
        max_bandwidth: parseInt(document.getElementById('maxBandwidth').value),
        enable_logging: document.getElementById('enableLogging').checked,
        enable_auto_backup: document.getElementById('enableAutoBackup').checked
    };

    try {
        const response = await fetch(`${API_URL}/api/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');

        alert('Параметры сохранены успешно');
    } catch (error) {
        console.error('Save settings error:', error);
        alert('Ошибка при сохранении параметров');
    }
}

// Logs
async function loadLogs() {
    try {
        const level = document.getElementById('logLevelFilter')?.value || '';

        const response = await fetch(`${API_URL}/api/admin/logs?level=${level}`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to load logs');

        const logs = await response.json();
        renderLogs(logs);
    } catch (error) {
        console.error('Load logs error:', error);
        document.getElementById('logsContent').innerHTML = '<div class="loading">Ошибка загрузки логов</div>';
    }
}

function renderLogs(logs) {
    const logsContent = document.getElementById('logsContent');
    logsContent.innerHTML = logs.map(log => `
        <div class="log-line log-${log.level}">
            <strong>[${log.timestamp}]</strong> ${log.message}
        </div>
    `).join('') || '<div class="loading">Нет логов</div>';

    logsContent.scrollTop = logsContent.scrollHeight;
}

async function clearLogs() {
    if (!confirm('Вы уверены? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/logs`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });

        if (!response.ok) throw new Error('Failed to clear logs');

        loadLogs();
        alert('Логи очищены');
    } catch (error) {
        console.error('Clear logs error:', error);
        alert('Ошибка при очистке логов');
    }
}

// Authentication
function getAdminToken() {
    return localStorage.getItem('adminToken') || '';
}

function checkAdminAuth() {
    const token = getAdminToken();
    if (!token) {
        window.location.href = 'admin-login.html';
    }
}

function handleLogout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'admin-login.html';
}

// Utility functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
