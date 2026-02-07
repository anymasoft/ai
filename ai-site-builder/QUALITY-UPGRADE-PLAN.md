# Трансформация AI Site Builder в генератор КАЧЕСТВЕННЫХ сайтов

---

## ЧАСТЬ 0: КАК ЗАПУСТИТЬ ПРОЕКТ

### Предварительные требования
- Node.js 18+
- OpenAI API ключ (нужна карта с балансом на platform.openai.com)

### Шаг 1: Установить зависимости

```bash
# Сервер
cd /home/user/ai/ai-site-builder/server
npm install

# Клиент
cd /home/user/ai/ai-site-builder/client
npm install
```

### Шаг 2: Создать файл .env в папке server

```bash
# Создать файл /home/user/ai/ai-site-builder/server/.env с содержимым:
OPENAI_API_KEY=sk-ваш-ключ-здесь
NODE_ENV=development
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=dev-secret-key-12345
```

### Шаг 3: Запустить бэкенд (терминал 1)

```bash
cd /home/user/ai/ai-site-builder/server
npm run server
```
Сервер запустится на `http://localhost:3000`
SQLite база создастся автоматически в `server/data/app.db`

### Шаг 4: Запустить фронтенд (терминал 2)

```bash
cd /home/user/ai/ai-site-builder/client
npm run dev
```
Клиент запустится на `http://localhost:5173`

### Шаг 5: Открыть в браузере

Перейти на `http://localhost:5173`
Dev-режим автоматически авторизует как `dev-user-1` (20 стартовых кредитов)
Логин/пароль (если потребуется): `user@example.com` / `111111`

---

## ЧАСТЬ 1: ДИАГНОСТИКА — ПОЧЕМУ СЕЙЧАС ПОЛУЧАЕТСЯ ПЛОХОЙ ДИЗАЙН

### Корневые причины (по степени влияния)

#### 1. Слабая модель: GPT-4o-mini
**Это причина №1.** GPT-4o-mini — самая дешёвая модель OpenAI. Она:
- Генерирует шаблонный, "серый" HTML
- Не понимает тонкости дизайна (пропорции, белое пространство, визуальная иерархия)
- Часто ломает структуру при сложных запросах
- Не знает актуальные дизайн-тренды

**Сравнение моделей для генерации HTML:**

| Модель | Качество HTML/CSS | Цена за 1 сайт (~3000 токенов) | Качество дизайна |
|--------|------------------|-------------------------------|-----------------|
| GPT-4o-mini | 4/10 | ~$0.002 | Шаблонный, "учебный" |
| GPT-4o | 6/10 | ~$0.03 | Нормальный, но не впечатляет |
| Claude 3.5 Sonnet | 8/10 | ~$0.02 | Хороший, чистый |
| Claude Sonnet 4.5 | 9/10 | ~$0.03 | Отличный |
| Claude Opus 4 | 9/10 | ~$0.10 | Отличный, детализированный |

#### 2. Промпты — обобщённые и бессодержательные
Текущий системный промпт говорит "use modern, beautiful design" — но НЕ ОБЪЯСНЯЕТ, что это значит. Модель не получает:
- Конкретную дизайн-систему (размеры, отступы, шрифтовая шкала)
- Примеры хорошего HTML (few-shot learning)
- Правила визуальной иерархии
- Конкретные UI-паттерны (hero section, social proof, CTA)
- Цветовые палитры

#### 3. Нет reference-дизайнов
Lovable/Bolt показывают AI примеры готовых красивых компонентов. Здесь — ничего. Модель генерирует "от балды".

#### 4. Только одностраничный HTML
Это убивает коммерческую ценность. Бизнесу нужен минимум: главная + о нас + услуги + контакты.

#### 5. Placeholder-изображения
`placehold.co/600x400` — серые прямоугольники. Мгновенно делают любой дизайн "мусорным".

---

## ЧАСТЬ 2: ПЛАН ТРАНСФОРМАЦИИ (от быстрых улучшений к глубоким)

---

### УРОВЕНЬ 1: БЫСТРЫЕ УЛУЧШЕНИЯ (1-2 дня работы) — КАЧЕСТВЕННЫЙ ДИЗАЙН

**Цель:** Без изменения архитектуры, только за счёт промптов и модели, поднять качество с 4/10 до 7-8/10.

#### 1.1 Заменить модель на Claude Sonnet 4.5 или GPT-4o

В файле `server/config/openai.ts` — заменить OpenAI на Anthropic API:

```typescript
// Вариант A: Anthropic Claude (РЕКОМЕНДУЕТСЯ)
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export default anthropic;
```

Или остаться на OpenAI, но сменить модель:
```typescript
// В userController.ts и projectController.ts заменить:
model: "gpt-4o-mini"
// на:
model: "gpt-4o"
```

**Стоимость:** ~$0.02-0.03 за генерацию вместо $0.002. При чеке $50+ за сайт — незаметно.

#### 1.2 Полностью переписать системные промпты

**Текущий промпт** (абстрактный, ~30 слов полезных инструкций):
```
Use modern, beautiful design with great UX using Tailwind classes
```

**Новый промпт** (конкретный, с дизайн-системой):

```
You are a senior frontend developer specializing in premium, conversion-optimized landing pages.

DESIGN SYSTEM (ОБЯЗАТЕЛЬНО СОБЛЮДАТЬ):

TYPOGRAPHY:
- Заголовки: font-family Inter/Manrope через Google Fonts CDN, font-weight 700-800
- H1: text-5xl md:text-6xl lg:text-7xl, letter-spacing -0.02em, leading-tight
- H2: text-3xl md:text-4xl, font-bold
- H3: text-xl md:text-2xl, font-semibold
- Основной текст: text-base md:text-lg, text-gray-600 (или text-gray-300 для тёмной темы), leading-relaxed, max-w-2xl для читабельности
- Подписи/мелкий текст: text-sm, text-gray-400

SPACING & LAYOUT:
- Секции: py-20 md:py-28 lg:py-32. МНОГО воздуха между секциями
- Контейнер: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Между заголовком и текстом: mt-4 md:mt-6
- Между текстом и CTA: mt-8 md:mt-10
- Сетка карточек: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8

ЦВЕТА (выбрать одну палитру и придерживаться):
- Основной: один яркий акцентный цвет (indigo-600, violet-600, blue-600, emerald-600 или rose-600)
- Фон: white или slate-50 (светлая тема) ИЛИ slate-950/gray-950 (тёмная тема)
- Текст: gray-900 (светлая) или white (тёмная)
- Вторичный текст: gray-500 (светлая) или gray-400 (тёмная)
- Акцентный фон: {accent}-50 для бейджей и выделения

CTA КНОПКИ:
- Основная: bg-{accent}-600 hover:bg-{accent}-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-{accent}-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-{accent}-500/30 hover:-translate-y-0.5
- Вторичная: border-2 border-gray-200 hover:border-{accent}-300 px-8 py-4 rounded-xl text-lg font-semibold transition-all
- НИКОГДА маленькие кнопки. Минимум py-3 px-6

HERO SECTION (первый экран — САМЫЙ ВАЖНЫЙ):
- Минимальная высота: min-h-[90vh] flex items-center
- Бейдж сверху: inline-flex items-center gap-2 bg-{accent}-50 text-{accent}-700 px-4 py-1.5 rounded-full text-sm font-medium
- Заголовок H1: максимально крупный, с gradient text для ключевого слова: bg-gradient-to-r from-{accent}-600 to-{second}-500 bg-clip-text text-transparent
- Подзаголовок: text-xl text-gray-500 max-w-xl mt-6
- CTA группа: flex gap-4 mt-10
- Справа или снизу: скриншот/изображение с тенью shadow-2xl rounded-2xl

КАРТОЧКИ:
- bg-white (или bg-gray-900) rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-{accent}-100 transition-all duration-300
- Иконка сверху: w-12 h-12 bg-{accent}-100 rounded-xl flex items-center justify-center mb-6, внутри SVG иконка
- ИСПОЛЬЗОВАТЬ реальные SVG иконки (Heroicons inline SVG), НЕ эмодзи

ИЗОБРАЖЕНИЯ:
- Использовать https://images.unsplash.com/ с параметрами ?w=800&h=600&fit=crop
- Для фотографий людей: https://images.unsplash.com/photo-ID?w=400&h=400&fit=crop&crop=face
- Для абстрактных фонов: gradient mesh через CSS
- Все изображения: rounded-2xl overflow-hidden shadow-xl

SOCIAL PROOF (обязательная секция):
- Логотипы компаний (серые SVG): "Нам доверяют:" + 4-6 серых плейсхолдеров
- ИЛИ цифры: "500+ клиентов", "98% довольных", "10 лет опыта"
- ИЛИ отзывы с аватарами и именами

FOOTER:
- bg-gray-950 text-gray-400
- 4 колонки: О компании, Услуги, Ресурсы, Контакты
- Соцсети: inline SVG иконки
- Нижняя строка: copyright + ссылки на политику

АНИМАЦИИ:
- Секции: fade-in при скролле через Intersection Observer
- Кнопки: transition-all duration-200 hover:-translate-y-0.5
- Карточки: transition-all duration-300 hover:shadow-lg
- НЕ использовать крутящиеся/мигающие анимации — только subtle transitions

ОБЯЗАТЕЛЬНЫЕ СЕКЦИИ для бизнес-сайта:
1. Hero с CTA
2. Social proof (логотипы или цифры)
3. Преимущества/фичи (3-4 карточки с иконками)
4. Подробнее об услугах/продукте
5. Отзывы клиентов (2-3 цитаты)
6. CTA-секция повторно (перед футером)
7. Footer

ЗАПРЕЩЕНО:
- Comic Sans, Papyrus, декоративные шрифты
- Больше 2 шрифтов на странице
- Чистый чёрный #000000 для текста (использовать gray-900)
- Красный + зелёный вместе
- Текст на картинках без overlay
- Маленькие клик-зоны для кнопок
- Lorem ipsum — писать реалистичный текст по теме
```

#### 1.3 Заменить placeholder-изображения на Unsplash

В промпте заменить:
```
Use placeholder images from https://placehold.co/600x400
```
На:
```
Use real photos from Unsplash:
- Hero images: https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=800&fit=crop
- People: https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face
- Подбирай РЕЛЕВАНТНЫЕ фото по теме сайта
- Все фото: rounded-2xl shadow-xl
```

#### 1.4 Добавить few-shot примеры в промпт

Добавить в системный промпт 1-2 примера ХОРОШЕГО hero-секции:

```html
ПРИМЕР ХОРОШЕГО HERO (для референса стиля):
<section class="min-h-[90vh] flex items-center bg-white">
  <div class="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
    <div>
      <div class="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">...</svg>
        Новое предложение
      </div>
      <h1 class="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
        Создаём сайты, которые
        <span class="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">приносят клиентов</span>
      </h1>
      <p class="mt-6 text-xl text-gray-500 max-w-lg leading-relaxed">
        Современный дизайн, быстрая загрузка и конверсия выше рынка. Более 200 проектов за 5 лет.
      </p>
      <div class="mt-10 flex flex-wrap gap-4">
        <a href="#" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5">
          Обсудить проект
        </a>
        <a href="#" class="border-2 border-gray-200 hover:border-indigo-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold transition-all">
          Смотреть портфолио
        </a>
      </div>
    </div>
    <div class="relative">
      <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
           class="rounded-2xl shadow-2xl" alt="Screenshot">
      <div class="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3">
        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div>
          <div class="text-sm font-semibold text-gray-900">+47% конверсии</div>
          <div class="text-xs text-gray-500">за первый месяц</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

### УРОВЕНЬ 2: СЕРЬЁЗНЫЕ УЛУЧШЕНИЯ (3-5 дней работы)

#### 2.1 Система шаблонов по нишам

Создать файл `server/templates/` с предготовленными промптами:

```
templates/
├── restaurant.ts    — Ресторан/кафе
├── medical.ts       — Стоматология/клиника
├── legal.ts         — Юридические услуги
├── beauty.ts        — Салон красоты
├── construction.ts  — Строительство/ремонт
├── saas.ts          — SaaS продукт
├── portfolio.ts     — Портфолио фрилансера
├── event.ts         — Мероприятие/конференция
└── ecommerce.ts     — Интернет-магазин (витрина)
```

Каждый шаблон содержит:
- Нише-специфичный системный промпт
- Обязательные секции для этой ниши
- Подобранные фото с Unsplash для ниши
- Цветовую палитру
- Примеры текстов

Пользователь на фронте выбирает нишу → подставляется нишевый промпт.

#### 2.2 Библиотека UI-компонентов (design tokens в промпте)

Вместо генерации "от нуля" — дать AI библиотеку готовых секций:

```typescript
const sectionLibrary = {
  hero: [
    "hero-centered",       // Центрированный заголовок с CTA
    "hero-split",          // Текст слева, изображение справа
    "hero-with-video",     // С видео-бейджем
    "hero-dark",           // Тёмный фон
  ],
  features: [
    "features-grid-3",     // Сетка 3 колонки
    "features-grid-4",     // Сетка 4 колонки
    "features-alternating", // Чередование текст-картинка
  ],
  testimonials: [
    "testimonials-cards",  // Карточки с отзывами
    "testimonials-quote",  // Большая цитата
  ],
  pricing: [
    "pricing-3-cols",      // 3 тарифа
    "pricing-comparison",  // Таблица сравнения
  ],
  cta: [
    "cta-centered",        // Центрированный блок
    "cta-with-image",      // С изображением
  ],
};
```

#### 2.3 Интеграция с Unsplash API (вместо хардкод-ссылок)

```typescript
// server/config/unsplash.ts
import { createApi } from "unsplash-js";

const unsplash = createApi({
    accessKey: process.env.UNSPLASH_ACCESS_KEY,
});

export async function getRelevantPhotos(query: string, count: number = 5) {
    const result = await unsplash.search.getPhotos({ query, perPage: count });
    return result.response?.results.map(photo => ({
        url: photo.urls.regular,
        alt: photo.alt_description,
    }));
}
```

Перед генерацией HTML — подбирать 5-8 фото по тематике и подставлять URL в промпт.

---

### УРОВЕНЬ 3: ТРАНСФОРМАЦИЯ В АНАЛОГ LOVABLE/BOLT (2-4 недели)

Это полная переделка архитектуры. Вот что нужно:

#### 3.1 Генерация React-компонентов вместо monolithic HTML

**Текущий подход:** один огромный HTML-файл.
**Новый подход:** генерация отдельных React-компонентов.

```
Вместо:
  промпт → 1 HTML файл (3000 строк)

Делаем:
  промпт → структура проекта → компоненты по-одному → сборка
```

**Pipeline:**

```
Шаг 1: Планирование (AI определяет структуру)
  Вход: "Сделай сайт стоматологии"
  Выход JSON:
  {
    "pages": ["Home", "Services", "About", "Contact"],
    "components": ["Navbar", "Hero", "ServiceCard", "Testimonial", "Footer"],
    "colorScheme": "blue-600",
    "font": "Inter"
  }

Шаг 2: Генерация каждого компонента отдельно
  Для каждого компонента → отдельный вызов AI → чистый код

Шаг 3: Сборка
  Компоненты + маршрутизация → готовый проект

Шаг 4: Preview
  Сборка через Vite in-browser → preview в iframe
```

#### 3.2 Многостраничность

**Схема БД — добавить таблицу pages:**

```sql
CREATE TABLE pages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,      -- "Home", "About", "Contact"
    slug TEXT NOT NULL,      -- "home", "about", "contact"
    code TEXT,               -- HTML/React код страницы
    order_index INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

**Маршрутизация внутри iframe:**
- Использовать hash-роутинг: `#/home`, `#/about`, `#/contact`
- Или iframe с srcdoc, где внутри JavaScript-роутер

#### 3.3 Компонентный подход (Shadcn-style)

Вместо генерации CSS с нуля — подключить готовую библиотеку компонентов:

```html
<!-- Вместо Tailwind CDN → подключать готовые стили -->
<link rel="stylesheet" href="/components/styles.css">
```

Создать файл `server/design-system/components.css` с 20-30 готовыми компонентами высокого качества. AI будет их использовать, а не генерировать каждый раз.

#### 3.4 WebContainer / Sandpack для live preview

Вместо простого iframe с srcDoc — использовать:
- **Sandpack** (от CodeSandbox) — встроенный редактор + preview
- или **WebContainer** (от StackBlitz) — полноценный Node.js в браузере

Это позволит:
- Генерировать React/Next.js проекты
- Запускать npm install прямо в браузере
- Показывать многостраничные сайты с роутингом

#### 3.5 Экспорт как полноценный проект

Вместо скачивания одного HTML — экспорт ZIP:

```
project.zip
├── index.html
├── about.html
├── services.html
├── contact.html
├── css/
│   └── styles.css
├── js/
│   └── main.js
└── images/
    └── (скачанные с Unsplash)
```

Или экспорт как Next.js проект:

```
project.zip
├── package.json
├── next.config.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── about/page.tsx
│   ├── services/page.tsx
│   └── contact/page.tsx
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   └── ...
└── public/
    └── images/
```

---

## ЧАСТЬ 3: РЕКОМЕНДУЕМАЯ СТРАТЕГИЯ (порядок действий)

### Фаза 1 (СЕЙЧАС, 1-2 дня): Качество через промпты
1. Заменить `gpt-4o-mini` на `gpt-4o` (или Claude через Anthropic API)
2. Переписать системный промпт с полной дизайн-системой (пример выше)
3. Заменить placehold.co на Unsplash
4. Добавить few-shot пример хорошего HTML

**Результат:** Качество дизайна с 4/10 до 7-8/10 без изменения архитектуры.

### Фаза 2 (неделя 1-2): Шаблоны и структура
1. Добавить систему шаблонов по нишам
2. Добавить выбор ниши на фронтенде
3. Подключить Stripe для реальных платежей
4. Деплой на VPS/Railway

**Результат:** Продукт, который можно продавать. Лендинги за $50-200.

### Фаза 3 (неделя 3-6): Многостраничность
1. Добавить таблицу pages в БД
2. Реализовать поэтапную генерацию (план → компоненты → сборка)
3. Внутренний роутинг в iframe
4. Экспорт мультистраничных сайтов

**Результат:** Аналог Lovable для нетехнических пользователей.

---

## ЧАСТЬ 4: КОНКРЕТНЫЕ ИЗМЕНЕНИЯ В КОДЕ

### Минимальное изменение №1: Заменить модель

Файл: `server/controller/userController.ts` и `server/controller/projectController.ts`

Заменить ВСЕ вхождения:
```typescript
model: "gpt-4o-mini"
```
на:
```typescript
model: "gpt-4o"
```

### Минимальное изменение №2: Заменить системный промпт

Файл: `server/controller/userController.ts`, функция `createUserProject`

Заменить блок `content` в вызове генерации кода на детальный промпт из секции 1.2 выше.

### Минимальное изменение №3: Переход на Anthropic Claude

Файл: `server/config/openai.ts` — переписать на Anthropic SDK

Файл: `server/controller/userController.ts` — заменить вызовы:
```typescript
// Было:
const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...]
});
const result = response.choices[0].message.content;

// Стало:
const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
});
const result = response.content[0].type === "text" ? response.content[0].text : "";
```

---

## ЧАСТЬ 5: СРАВНЕНИЕ С LOVABLE / BOLT

| Возможность | AI Site Builder (сейчас) | Lovable | Bolt | Цель |
|------------|------------------------|---------|------|------|
| Качество дизайна | 4/10 | 8/10 | 7/10 | 8/10 |
| Многостраничность | Нет | Да | Да | Нужно |
| React/Next.js | Нет (raw HTML) | Да | Да | Фаза 3 |
| Редактор кода | Нет | Да | Да | Фаза 2 |
| Деплой | Нет | Да (Netlify) | Нет | Фаза 2 |
| AI-ревизии | Да | Да | Да | Есть |
| Версионирование | Да | Да | Да | Есть |
| Стоимость API | ~$0.002/генерация | ? | ? | ~$0.03 |
| Self-hosted | Да | Нет | Нет | Преимущество |

**Главное конкурентное преимущество:** self-hosted. Lovable и Bolt — закрытые SaaS. Ваш продукт можно развернуть у себя, кастомизировать, white-label.

---

## ЧАСТЬ 6: КРИТИЧЕСКИЙ ИТОГ

**Быстрый путь к деньгам (Фаза 1):**
Потратить 1-2 дня на промпты + модель → получить качественный дизайн → продавать лендинги по $100-300.

**Путь к продукту (Фазы 2-3):**
Потратить 4-6 недель на шаблоны + многостраничность + Stripe → получить SaaS с MRR.

**Путь к конкурентному продукту (Фаза 3+):**
Переход на React-генерацию + WebContainer + деплой → аналог Lovable, но self-hosted.

Начинать ВСЕГДА с Фазы 1. Это даёт 80% результата за 20% усилий.
