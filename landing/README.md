# Video Reader AI - Landing Page

Современный лендинг для расширения Video Reader AI, созданный на основе шаблона Cruip с использованием Vite + React + Tailwind CSS.

## 🚀 Быстрый старт

### Установка зависимостей

```bash
npm install
```

### Запуск dev-сервера

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### Сборка для продакшена

```bash
npm run build
```

Скомпилированные файлы будут в папке `dist/`.

### Предпросмотр production build

```bash
npm run preview
```

## 📁 Структура проекта

```
landing/
├── public/              # Статические файлы
├── src/
│   ├── components/      # React компоненты
│   │   ├── Header.jsx
│   │   ├── Hero.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── Features.jsx
│   │   ├── Pricing.jsx
│   │   ├── FAQ.jsx
│   │   └── Footer.jsx
│   ├── assets/          # Изображения и другие ресурсы
│   ├── App.jsx          # Главный компонент
│   ├── main.jsx         # Точка входа
│   └── index.css        # Главный CSS файл
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

## 🎨 Технологии

- **Vite** - Быстрый сборщик
- **React 18** - UI библиотека
- **Tailwind CSS 3** - Utility-first CSS фреймворк
- **Modern Design** - Дизайн в стиле Cruip (Linear.app/Notion)

## 📝 Особенности

- ✅ Адаптивный дизайн
- ✅ Современный минималистичный UI
- ✅ Анимации и transitions
- ✅ SEO-оптимизация
- ✅ Интерактивные компоненты
- ✅ Готов к деплою

## 🔧 Конфигурация

Все настройки Tailwind CSS находятся в `tailwind.config.js`.
Настройки Vite - в `vite.config.js`.

## 📦 Деплой

Проект готов к деплою на Vercel, Netlify, или любой другой статический хостинг.

```bash
npm run build
```

Загрузите содержимое папки `dist/` на хостинг.
