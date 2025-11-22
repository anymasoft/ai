// Admin Panel Logic

// State
let currentSection = 'dashboard';
let currentPages = {
    users: 1,
    payments: 1,
    feedback: 1,
    cache: 1
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAccess();
});

// Check admin access
async function checkAdminAccess() {
    try {
        const response = await fetch('/admin/auth-check', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.isAdmin) {
                // Show admin panel
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('admin-panel').classList.remove('hidden');
                document.getElementById('admin-email').textContent = data.email;

                // Setup navigation
                setupNavigation();

                // Load dashboard
                loadDashboard();
            } else {
                showAccessDenied();
            }
        } else {
            showAccessDenied();
        }
    } catch (error) {
        console.error('Access check error:', error);
        showAccessDenied();
    }
}

function showAccessDenied() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('access-denied').classList.remove('hidden');
}

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(section) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.section === section) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.add('hidden');
    });
    document.getElementById(`section-${section}`).classList.remove('hidden');

    currentSection = section;

    // Load data
    if (section === 'users') loadUsers();
    if (section === 'payments') loadPayments();
    if (section === 'feedback') loadFeedback();
    if (section === 'cache') loadCache();
}

// Dashboard
async function loadDashboard() {
    try {
        // Load stats in parallel
        const [usersRes, paymentsRes, feedbackRes] = await Promise.all([
            fetch('/admin/users?per_page=1', { credentials: 'include' }),
            fetch('/admin/payments?per_page=1', { credentials: 'include' }),
            fetch('/admin/feedback?per_page=1', { credentials: 'include' })
        ]);

        const usersData = await usersRes.json();
        const paymentsData = await paymentsRes.json();
        const feedbackData = await feedbackRes.json();

        document.getElementById('stats-users').textContent = usersData.total || 0;
        document.getElementById('stats-payments').textContent = paymentsData.total || 0;
        document.getElementById('stats-feedback').textContent = feedbackData.total || 0;
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Users
async function loadUsers(page = 1) {
    try {
        const response = await fetch(`/admin/users?page=${page}&per_page=50`, {
            credentials: 'include'
        });

        const data = await response.json();
        currentPages.users = page;

        renderUsersTable(data.users);
        renderPagination('users', data.page, data.total_pages);
    } catch (error) {
        console.error('Users load error:', error);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${user.email}</td>
            <td class="px-6 py-4 text-sm"><span class="plan-badge ${user.plan.toLowerCase()}">${user.plan}${user.isExpired ? ' (expired)' : ''}</span></td>
            <td class="px-6 py-4 text-sm text-gray-600">${formatDate(user.created_at)}</td>
            <td class="px-6 py-4 text-sm">
                <select
                    onchange="updateUserPlan('${user.email}', this.value)"
                    class="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Change plan...</option>
                    <option value="Free" ${user.plan === 'Free' ? 'disabled' : ''}>Free</option>
                    <option value="Pro" ${user.plan === 'Pro' ? 'disabled' : ''}>Pro</option>
                    <option value="Premium" ${user.plan === 'Premium' ? 'disabled' : ''}>Premium</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateUserPlan(email, plan) {
    if (!plan) return;

    if (!confirm(`Change plan for ${email} to ${plan}?`)) {
        return;
    }

    try {
        const response = await fetch('/admin/update-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, plan })
        });

        if (response.ok) {
            alert('Plan updated successfully!');
            loadUsers(currentPages.users);
        } else {
            alert('Failed to update plan');
        }
    } catch (error) {
        console.error('Update plan error:', error);
        alert('Error updating plan');
    }
}

function refreshUsers() {
    loadUsers(currentPages.users);
}

// Payments
async function loadPayments(page = 1) {
    try {
        const response = await fetch(`/admin/payments?page=${page}&per_page=50`, {
            credentials: 'include'
        });

        const data = await response.json();
        currentPages.payments = page;

        renderPaymentsTable(data.payments);
        renderPagination('payments', data.page, data.total_pages);
    } catch (error) {
        console.error('Payments load error:', error);
    }
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table');
    tbody.innerHTML = '';

    payments.forEach(payment => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-600">#${payment.id}</td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${payment.email}</td>
            <td class="px-6 py-4 text-sm"><span class="plan-badge ${payment.plan.toLowerCase()}">${payment.plan}</span></td>
            <td class="px-6 py-4 text-xs text-gray-500 font-mono">${payment.payment_id || '-'}</td>
            <td class="px-6 py-4 text-sm"><span class="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700">${payment.status}</span></td>
            <td class="px-6 py-4 text-sm text-gray-600">${formatDate(payment.timestamp)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function refreshPayments() {
    loadPayments(currentPages.payments);
}

// Feedback
async function loadFeedback(page = 1) {
    try {
        const response = await fetch(`/admin/feedback?page=${page}&per_page=50`, {
            credentials: 'include'
        });

        const data = await response.json();
        currentPages.feedback = page;

        renderFeedbackList(data.feedback);
        renderPagination('feedback', data.page, data.total_pages);
    } catch (error) {
        console.error('Feedback load error:', error);
    }
}

function renderFeedbackList(feedback) {
    const list = document.getElementById('feedback-list');
    list.innerHTML = '';

    feedback.forEach(item => {
        const card = document.createElement('div');
        card.className = 'feedback-card';
        card.innerHTML = `
            <div class="feedback-header">
                <div class="flex-1">
                    <div class="feedback-email">${item.email}</div>
                    <span class="plan-badge ${item.plan.toLowerCase()}">${item.plan}</span>
                </div>
                <div class="feedback-date">${formatDate(item.timestamp)}</div>
            </div>
            <div class="feedback-message">${escapeHtml(item.message)}</div>
        `;
        list.appendChild(card);
    });
}

function refreshFeedback() {
    loadFeedback(currentPages.feedback);
}

// Cache
async function loadCache(page = 1, videoId = '') {
    try {
        let url = `/admin/translations?page=${page}&per_page=50`;
        if (videoId) {
            url += `&video_id=${encodeURIComponent(videoId)}`;
        }

        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        currentPages.cache = page;

        renderCacheTable(data.translations);
        renderPagination('cache', data.page, data.total_pages);
    } catch (error) {
        console.error('Cache load error:', error);
    }
}

function renderCacheTable(translations) {
    const tbody = document.getElementById('cache-table');
    tbody.innerHTML = '';

    translations.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 text-xs font-mono text-gray-600">${item.video_id}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.line_number}</td>
            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">${escapeHtml(item.original_text)}</td>
            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">${escapeHtml(item.translated_text)}</td>
            <td class="px-6 py-4 text-sm"><span class="inline-flex px-2.5 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded">${item.lang}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function searchCache() {
    const videoId = document.getElementById('cache-video-id').value.trim();
    loadCache(1, videoId);
}

// Pagination
function renderPagination(section, currentPage, totalPages) {
    const container = document.getElementById(`${section}-pagination`);
    container.innerHTML = '';
    container.className = 'pagination';

    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (section === 'users') loadUsers(currentPage - 1);
        if (section === 'payments') loadPayments(currentPage - 1);
        if (section === 'feedback') loadFeedback(currentPage - 1);
        if (section === 'cache') {
            const videoId = document.getElementById('cache-video-id').value.trim();
            loadCache(currentPage - 1, videoId);
        }
    };
    container.appendChild(prevBtn);

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    container.appendChild(pageInfo);

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (section === 'users') loadUsers(currentPage + 1);
        if (section === 'payments') loadPayments(currentPage + 1);
        if (section === 'feedback') loadFeedback(currentPage + 1);
        if (section === 'cache') {
            const videoId = document.getElementById('cache-video-id').value.trim();
            loadCache(currentPage + 1, videoId);
        }
    };
    container.appendChild(nextBtn);
}

// Utilities
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
