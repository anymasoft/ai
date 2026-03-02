#!/usr/bin/env node

// Простая проверка типов всех routes без запуска всего сервера

const path = require('path');
const routesPath = path.join(__dirname, 'LibreChat/api/server/routes');

console.log('\n🔍 Проверка ВСЕХ routes...\n');

const routeFiles = [
  'accessPermissions',
  'assistants',
  'categories',
  'admin/auth',
  'endpoints',
  'static',
  'messages',
  'memories',
  'presets',
  'prompts',
  'balance',
  'actions',
  'apiKeys',
  'banner',
  'search',
  'models',
  'convos',
  'config',
  'agents',
  'roles',
  'oauth',
  'files',
  'share',
  'tags',
  'auth',
  'keys',
  'user',
  'mcp',
  'payment',
];

let problems = 0;
const results = {};

routeFiles.forEach((file, index) => {
  try {
    const route = require(path.join(routesPath, file));
    const type = typeof route;
    const isFunc = type === 'function';
    const status = isFunc ? '✅' : '❌';

    results[file] = { type, status };

    console.log(`${status} [${String(index + 1).padStart(2, '0')}] ${file.padEnd(20)} : ${type}`);

    if (!isFunc) {
      problems++;
      if (route && typeof route === 'object') {
        console.log(`     └─ Object keys: ${Object.keys(route).join(', ')}`);
      }
    }
  } catch (err) {
    console.log(`❌ [${String(index + 1).padStart(2, '0')}] ${file.padEnd(20)} : ERROR`);
    console.log(`     └─ ${err.message.split('\n')[0]}`);
    problems++;
  }
});

console.log(`\n${'═'.repeat(60)}`);
console.log(`ИТОГО: ${routeFiles.length} files, ${Object.values(results).filter(r => r.status === '✅').length} ok, ${problems} problems`);

if (problems > 0) {
  console.log(`\n❌ FOUND ${problems} PROBLEMATIC ROUTES!\n`);
  process.exit(1);
} else {
  console.log(`\n✅ ALL ROUTES ARE FUNCTIONS\n`);
  process.exit(0);
}
