import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import dotenv from 'dotenv';
import skipHostCheck from './vite-skip-host-check.mjs';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

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
    ],
    ssr: {
      // Исключаем Node.js модули из бандла для браузера
      // grammY - это Node.js модуль и должен подгружаться в runtime
      external: ['grammy', 'axios']
    },
    build: {
      rollupOptions: {
        // Исключаем Node.js модули из Rollup бандла
        external: ['grammy', 'axios']
      }
    }
  }
});