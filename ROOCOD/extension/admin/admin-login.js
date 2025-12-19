// Admin Login Script
const API_URL = 'http://localhost:5000';

const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const errorMessage = document.getElementById('errorMessage');

document.addEventListener('DOMContentLoaded', () => {
    // Check if admin is already logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
        verifyToken(token);
    }

    // Load remembered username
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
        usernameInput.value = rememberedUsername;
        rememberMeCheckbox.checked = true;
        passwordInput.focus();
    }

    // Setup form submission
    loginForm.addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        showError('Пожалуйста, заполните все поля');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error('Invalid credentials');
        }

        const data = await response.json();

        // Store token
        localStorage.setItem('adminToken', data.token);

        // Remember username if checked
        if (rememberMeCheckbox.checked) {
            localStorage.setItem('rememberedUsername', username);
        } else {
            localStorage.removeItem('rememberedUsername');
        }

        // Redirect to admin panel
        window.location.href = 'admin.html';
    } catch (error) {
        console.error('Login error:', error);
        showError('Неверное имя пользователя или пароль');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/api/admin/verify-token`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            window.location.href = 'admin.html';
        } else {
            localStorage.removeItem('adminToken');
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('adminToken');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 4000);
}
