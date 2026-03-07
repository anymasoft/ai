#!/usr/bin/env node

/**
 * Кроссплатформенный скрипт для сборки @librechat/client пакета
 * Работает на Windows, macOS и Linux
 * Игнорирует ошибки при сборке, чтобы не прерывать npm install
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const clientPackagePath = path.join(__dirname, '..', 'packages', 'client');
const packageJsonPath = path.join(clientPackagePath, 'package.json');

// Проверяем, существует ли пакет
if (!fs.existsSync(packageJsonPath)) {
  console.log('⚠️  Client package not found, skipping build');
  process.exit(0);
}

try {
  console.log('Building @librechat/client...');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npm} run build`, {
    cwd: clientPackagePath,
    stdio: 'inherit',
  });
  console.log('✅ Client package built successfully');
  process.exit(0);
} catch (error) {
  // Игнорируем ошибки при сборке
  console.warn('⚠️  Build failed, but continuing anyway:', error.message);
  process.exit(0);
}
