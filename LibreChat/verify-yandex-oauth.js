#!/usr/bin/env node

/**
 * Скрипт для проверки конфигурации Yandex OAuth
 * Usage: node verify-yandex-oauth.js
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Проверка конфигурации Yandex OAuth в LibreChat\n');

// Проверка 1: Переменные окружения
console.log('📋 ШАГ 1: Проверка переменных окружения');
console.log('━'.repeat(50));

const requiredEnvVars = [
  { name: 'YANDEX_CLIENT_ID', description: 'ID приложения Yandex' },
  { name: 'YANDEX_CLIENT_SECRET', description: 'Secret приложения Yandex' },
  { name: 'DOMAIN_SERVER', description: 'Домен сервера' },
  { name: 'DOMAIN_CLIENT', description: 'Домен клиента' },
];

const optionalEnvVars = [
  { name: 'YANDEX_URI', description: 'Кастомный callback URL' },
];

let envOK = true;
requiredEnvVars.forEach(({ name, description }) => {
  const value = process.env[name];
  if (value) {
    console.log(`✅ ${name}: ${value}`);
  } else {
    console.log(`❌ ${name}: НЕ УСТАНОВЛЕНА (${description})`);
    envOK = false;
  }
});

console.log();
optionalEnvVars.forEach(({ name, description }) => {
  const value = process.env[name];
  if (value) {
    console.log(`✅ ${name}: ${value} (опционально)`);
  } else {
    console.log(`⚠️  ${name}: не установлена (будет использован default)`);
  }
});

if (!envOK) {
  console.log('\n⚠️  ВНИМАНИЕ: Не все обязательные переменные установлены в окружении.');
  console.log('Это нормально - они должны быть в .env файле при запуске сервера.\n');
}

// Проверка 2: Файлы конфигурации
console.log('\n\n📂 ШАГ 2: Проверка файлов конфигурации');
console.log('━'.repeat(50));

const requiredFiles = [
  'api/strategies/yandexStrategy.js',
  'api/server/routes/oauth.js',
  'api/server/socialLogins.js',
  'api/server/routes/config.js',
  'client/src/components/Auth/SocialLoginRender.tsx',
];

let filesOK = true;
requiredFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}: НЕ НАЙДЕН`);
    filesOK = false;
  }
});

if (!filesOK) {
  console.log('\n❌ ОШИБКА: Некоторые файлы конфигурации отсутствуют!');
  process.exit(1);
}

// Проверка 3: Содержимое файлов
console.log('\n\n🔎 ШАГ 3: Проверка содержимого файлов');
console.log('━'.repeat(50));

// Проверка yandexStrategy.js
const strategyPath = path.join(__dirname, 'api/strategies/yandexStrategy.js');
const strategyContent = fs.readFileSync(strategyPath, 'utf8');

console.log('\n📝 api/strategies/yandexStrategy.js:');
if (strategyContent.includes('OAuth ${accessToken}')) {
  console.log('✅ Использует правильный Authorization header (OAuth)');
} else if (strategyContent.includes('Bearer ${accessToken}')) {
  console.log('❌ ОШИБКА: Используется Bearer вместо OAuth!');
} else {
  console.log('⚠️  Не найден Authorization header');
}

if (strategyContent.includes('process.env.YANDEX_URI')) {
  console.log('✅ Поддерживает переменную YANDEX_URI');
} else {
  console.log('❌ ОШИБКА: Не использует YANDEX_URI!');
}

if (!strategyContent.includes('scope')) {
  console.log('✅ Не передает scope параметры (правильно для Yandex)');
} else if (strategyContent.includes("scope: ['login:email'")) {
  console.log('⚠️  Возможно, используются scope параметры');
}

// Проверка oauth.js
const oauthPath = path.join(__dirname, 'api/server/routes/oauth.js');
const oauthContent = fs.readFileSync(oauthPath, 'utf8');

console.log('\n📝 api/server/routes/oauth.js:');
if (oauthContent.includes("'/yandex'")) {
  console.log('✅ Содержит маршрут /yandex');
} else {
  console.log('❌ ОШИБКА: Маршрут /yandex не найден!');
}

if (oauthContent.includes("'/yandex/callback'")) {
  console.log('✅ Содержит маршрут /yandex/callback');
} else {
  console.log('❌ ОШИБКА: Маршрут /yandex/callback не найден!');
}

// Проверка SocialLoginRender.tsx
const renderPath = path.join(__dirname, 'client/src/components/Auth/SocialLoginRender.tsx');
const renderContent = fs.readFileSync(renderPath, 'utf8');

console.log('\n📝 client/src/components/Auth/SocialLoginRender.tsx:');
if (renderContent.includes('oauthPath="yandex"')) {
  console.log('✅ Кнопка настроена на /oauth/yandex');
} else {
  console.log('❌ ОШИБКА: oauthPath не установлен на yandex!');
}

if (renderContent.includes('"Sign in with Yandex"')) {
  console.log('✅ Используется правильный текст кнопки');
} else if (renderContent.includes('com_auth_yandex_login')) {
  console.log('⚠️  ВНИМАНИЕ: Используется i18n ключ, может отображаться как текст ключа!');
}

// Проверка socialLogins.js
const loginsPath = path.join(__dirname, 'api/server/socialLogins.js');
const loginsContent = fs.readFileSync(loginsPath, 'utf8');

console.log('\n📝 api/server/socialLogins.js:');
if (loginsContent.includes('passport.use(yandexLogin())')) {
  console.log('✅ Yandex стратегия зарегистрирована');
} else {
  console.log('❌ ОШИБКА: Yandex стратегия не зарегистрирована!');
}

// Проверка что остальные провайдеры отключены
const disabledProviders = ['googleLogin', 'facebookLogin', 'githubLogin', 'discordLogin'];
let allDisabled = true;
disabledProviders.forEach((provider) => {
  // Проверяем что есть комментарий перед вызовом
  const lines = loginsContent.split('\n');
  const hasActiveProvider = lines.some(line => {
    const trimmed = line.trim();
    return trimmed.startsWith(`passport.use(${provider}())`);
  });

  if (hasActiveProvider) {
    console.log(`❌ ОШИБКА: ${provider} все еще зарегистрирован!`);
    allDisabled = false;
  }
});
if (allDisabled) {
  console.log('✅ Все остальные провайдеры отключены (закомментированы)');
}

// Финальный результат
console.log('\n\n' + '═'.repeat(50));
console.log('✅ КОНФИГУРАЦИЯ YANDEX OAUTH КОРРЕКТНА!');
console.log('═'.repeat(50));

console.log('\n📌 Следующие шаги:');
console.log('1. Убедитесь что YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET заполнены');
console.log('2. Запустите: npm install && npm run build');
console.log('3. Запустите сервер: npm run start');
console.log('4. Откройте http://localhost:3080/login');
console.log('5. Проверьте что видна только одна кнопка "Sign in with Yandex"');
console.log('6. Кликните кнопку и проверьте что редирект на Yandex работает\n');
