import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import dotenv from 'dotenv';
import skipHostCheck from './vite-skip-host-check.mjs';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Подавляем HTTP логирование на уровне Node.js
if (process.env.SUPPRESS_HTTP_LOGS !== 'false') {
  const originalLog = console.log;
  console.log = function(...args) {
    const logString = args.join(' ');
    // Фильтруем логи вида "[200] /api/..." или "[STATUS] /path TIME"
    const httpLogPattern = /^\[\d{3}\]\s+\/\w+/;
    const timePattern = /\d+m?s\s*$/;

    if (httpLogPattern.test(logString) && timePattern.test(logString)) {
      return; // Подавляем HTTP логи
    }
    originalLog.apply(console, args);
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),

  vite: {
    plugins: [
      skipHostCheck(),  // ✅ ОТКЛЮЧАЕМ HOST CHECK VITE
      tailwindcss()
    ]
  },

  // Минимальный уровень логирования
  logging: {
    level: 'error'
  }
});