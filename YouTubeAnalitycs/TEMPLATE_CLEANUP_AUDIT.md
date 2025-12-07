# АУДИТ ШАБЛОННЫХ ЭЛЕМЕНТОВ
## YouTube Analytics SaaS - Очистка от ShadcnStore Template

**Дата аудита:** 2025-12-07
**Аудитор:** Claude AI
**Цель:** Выявить все элементы, оставшиеся от исходного шаблона ShadcnStore

---

## 📋 ТАБЛИЦА НАЙДЕННЫХ ЭЛЕМЕНТОВ

| Место | Тип мусора | Текущий текст | Действие |
|-------|-----------|--------------|----------|
| `faq-structure.json` | Нерелевантный FAQ | "What is ShadcnStore Admin?" | Заменить на FAQ о YouTube Analytics |
| `src/app/(dashboard)/faqs/data/faqs.json` | Нерелевантный FAQ | 46 вопросов о ShadcnStore Admin | Заменить на релевантные вопросы |
| `License.md` | Копирайт шаблона | "Copyright (c) 2025 ShadcnStore" | Изменить на наш копирайт |
| `README.md` строка 242 | Упоминание шаблона | "основан на шаблоне shadcn-dashboard-landing-template" | Удалить или оставить как attribution |
| `src/app/landing/page.tsx` | Мета-теги шаблона | title: "ShadcnStore - Modern Admin Dashboard Template" | Заменить на YouTube Analytics |
| `src/app/landing/components/hero-section.tsx` | Шаблонный заголовок | "Build Better Web Applications..." | Заменить на описание YouTube Analytics |
| `src/app/landing/components/testimonials-section.tsx` | Фейковые отзывы | 12 вымышленных отзывов | Заменить на реальные или удалить секцию |
| `src/app/landing/components/team-section.tsx` | Фейковая команда | Alexandra Chen, Marcus Rodriguez и др. | Заменить на реальную команду или удалить |
| `src/app/landing/components/about-section.tsx` | Упоминание ShadcnStore | "About ShadcnStore" | Заменить на "О нас" |
| `src/app/landing/components/footer.tsx` | Ссылка на GitHub шаблона | github.com/silicondeck/shadcn-dashboard-landing-template | Заменить на наш репозиторий |
| `src/app/landing/components/footer.tsx` | Бренд ShadcnStore | "ShadcnStore" в футере | Заменить на YouTube Analytics |
| `src/app/landing/components/navbar.tsx` | Бренд ShadcnStore | "ShadcnStore" в навбаре | Заменить на наш бренд |
| `src/app/landing/components/contact-section.tsx` | Упоминание ShadcnStore | "Tell us how we can help you with ShadcnStore components..." | Заменить на наш текст |
| `src/app/landing/components/faq-section.tsx` | Упоминание ShadcnStore | "Everything you need to know about ShadcnStore components..." | Заменить на наш текст |
| `src/app/landing/components/features-section.tsx` | Шаблонные фичи | "Premium Templates", "Admin Dashboards", "E-commerce" | Заменить на фичи YouTube Analytics |
| `src/app/landing/components/pricing-section.tsx` | Шаблонные тарифы | "Basic dashboard templates", "Premium template collection" | Уже обновлено, проверить |
| `src/app/landing/components/cta-section.tsx` | Шаблонный CTA | "Stop building from scratch. Get production-ready components..." | Заменить на наш CTA |
| `src/components/site-footer.tsx` | Footer с атрибуцией | "Made with ❤️ by ShadcnStore Team" | Заменить на наш footer |
| `src/components/sidebar-notification.tsx` | Ссылка на ShadcnStore | href="https://shadcnstore.com" | Удалить или заменить |
| `src/components/upgrade-to-pro-button.tsx` | Ссылка на блоки | SHADCN_BLOCKS_URL = "https://shadcnstore.com/blocks" | Удалить или заменить |
| `src/app/(auth)/sign-in/page.tsx` | Бренд ShadcnStore | "ShadcnStore" в заголовке | Заменить на YouTube Analytics |
| `src/app/(auth)/sign-up/page.tsx` | Бренд ShadcnStore | "ShadcnStore" в заголовке | Заменить на YouTube Analytics |
| `src/app/(auth)/forgot-password/page.tsx` | Бренд ShadcnStore | "ShadcnStore" в заголовке | Заменить на YouTube Analytics |
| `src/app/(auth)/sign-in-2/page.tsx` | Бренд ShadcnStore | "ShadcnStore" | Заменить |
| `src/app/(auth)/sign-up-2/page.tsx` | Бренд ShadcnStore | "ShadcnStore" | Заменить |
| `src/app/(auth)/sign-in-3/components/login-form-3.tsx` | Бренд ShadcnStore | "ShadcnStore", "Login to your ShadcnStore account" | Заменить |
| `src/app/(auth)/sign-up-3/components/signup-form-3.tsx` | Бренд ShadcnStore | "ShadcnStore" | Заменить |
| `src/app/(auth)/forgot-password-2/page.tsx` | Бренд ShadcnStore | "ShadcnStore" | Заменить |
| `src/app/(auth)/forgot-password-3/components/forgot-password-form-3.tsx` | Бренд ShadcnStore | "ShadcnStore account password" | Заменить |
| `src/app/(auth)/layout.tsx` | Мета-теги | title: "Authentication - ShadcnStore" | Заменить |
| `.github/workflows/deploy.yml` | Деплой шаблона | Deploy Template to ShadcnStore | Удалить или переписать |

---

## 🔍 МЕСТА С ЯВНЫМИ СЛЕДАМИ ШАБЛОНА

### 1. Брендинг и логотипы

**Все файлы с упоминанием "ShadcnStore":**
- `src/app/landing/page.tsx` - мета-теги (title, description, og:title)
- `src/app/landing/components/navbar.tsx` - название в навбаре
- `src/app/landing/components/footer.tsx` - название в футере
- `src/app/landing/components/about-section.tsx` - "About ShadcnStore"
- `src/app/landing/components/contact-section.tsx` - упоминания в текстах
- `src/app/landing/components/faq-section.tsx` - упоминания в FAQ
- `src/components/site-footer.tsx` - "Made with ❤️ by ShadcnStore Team"
- `src/components/sidebar-notification.tsx` - ссылка и название
- Все страницы аутентификации (8 файлов)
- `License.md` - копирайт

### 2. Ссылки на исходный репозиторий

**GitHub репозиторий шаблона:**
```
https://github.com/silicondeck/shadcn-dashboard-landing-template
```

**Места использования:**
- `README.md` - строка 242
- `src/app/landing/components/footer.tsx` - social links
- `src/app/landing/components/navbar.tsx` - GitHub ссылка
- `src/app/landing/components/cta-section.tsx` - GitHub кнопка
- `src/app/landing/components/features-section.tsx` - GitHub ссылка
- `src/app/landing/components/contact-section.tsx` - GitHub issues
- `src/app/landing/components/about-section.tsx` - Star on GitHub

### 3. Ссылки на shadcnstore.com

**Все ссылки на домен:**
- `src/components/sidebar-notification.tsx` - https://shadcnstore.com
- `src/components/upgrade-to-pro-button.tsx` - https://shadcnstore.com/blocks
- `src/app/landing/components/footer.tsx` - https://shadcnstore.com
- `src/app/landing/components/cta-section.tsx` - https://shadcnstore.com/blocks
- `src/app/landing/components/features-section.tsx` - https://shadcnstore.com/templates
- `.github/workflows/deploy.yml` - shadcnstore.com и staging.shadcnstore.com

### 4. Email контакты шаблона

**Email адреса:**
- `faq-structure.json` - support@shadcnstore.com
- `src/app/(dashboard)/faqs/data/faqs.json` - support@shadcnstore.com

### 5. Фейковый контент

#### Отзывы (12 фейковых отзывов)
**Файл:** `src/app/landing/components/testimonials-section.tsx`

Персонажи:
1. Alexandra Mitchell - Senior Frontend Developer
2. James Thompson - Technical Lead
3. Priya Sharma - Product Designer
4. Robert Kim - Engineering Manager
5. Maria Santos - Full Stack Engineer
6. Thomas Anderson - Solutions Architect
7. Lisa Chang - UX Researcher
8. Michael Foster - DevOps Engineer
9. Sophie Laurent - Creative Director
10. Daniel Wilson - Backend Developer
11. Natasha Petrov - Mobile App Developer
12. Carlos Rivera - Startup Founder

**Действие:** Удалить секцию или заменить на реальные отзывы клиентов YouTube Analytics

#### Команда (6+ фейковых членов команды)
**Файл:** `src/app/landing/components/team-section.tsx`

Персонажи:
1. Alexandra Chen - Founder & CEO
2. Marcus Rodriguez - Engineering Manager
3. Sophie Laurent - Product Manager
4. David Kim - Frontend Developer
5. Emma Thompson - Backend Developer
6. Ryan Mitchell - Product Designer

**Действие:** Удалить секцию или заменить на реальную команду

### 6. FAQ с нерелевантным контентом

#### faq-structure.json (46 вопросов)

**Нерелевантные вопросы:**
1. "What is ShadcnStore Admin?" - упоминание шаблона
2. Вопросы про e-commerce store
3. Вопросы про "managing your store collaboratively"
4. support@shadcnstore.com в контактах
5. Упоминания Stripe, PayPal, Shopify, WooCommerce
6. Вопросы про "product management, order processing"
7. Вопросы про "new orders, payment confirmations, and inventory updates"

**Действие:** Полностью переписать FAQ под YouTube Analytics

#### src/app/(dashboard)/faqs/data/faqs.json

Те же 46 вопросов, что и в faq-structure.json

**Действие:** Синхронизировать с обновленным faq-structure.json

### 7. Шаблонные тексты на лендинге

#### Hero Section
**Файл:** `src/app/landing/components/hero-section.tsx`

Текущие тексты:
- Badge: "New: Premium Template Collection"
- H1: "Build Better Web Applications with Ready-Made Components"
- Описание: "Accelerate your development with our curated collection of blocks, templates, landing pages, and admin dashboards..."
- CTA: "Watch Demo" (ссылка на #)

**Действие:** Заменить на тексты о YouTube Analytics

#### Features Section
**Файл:** `src/app/landing/components/features-section.tsx`

Шаблонные фичи:
- "Premium Templates"
- "Admin Dashboards"
- "E-commerce"
- "Landing Pages"
- "Dashboard Templates"
- "Ready-to-Use Templates"
- Тексты про "marketplace", "blocks and templates"

**Действие:** Заменить на фичи YouTube Analytics (Competitors Analysis, AI Insights, Reports, etc.)

#### About Section
**Файл:** `src/app/landing/components/about-section.tsx`

Текущие тексты:
- Badge: "About ShadcnStore"
- H2: "Built for developers, by developers"
- Описание: "We're passionate about creating the best marketplace for shadcn/ui components and templates..."
- Values: Developer First, Design Excellence, Production Ready, Premium Quality
- "❤️ Made with love for the developer community"

**Действие:** Заменить на описание YouTube Analytics и нашей миссии

#### CTA Section
**Файл:** `src/app/landing/components/cta-section.tsx`

Текущие тексты:
- "Stop building from scratch. Get production-ready components, templates and dashboards"
- Кнопки со ссылками на shadcnstore.com/blocks и GitHub шаблона

**Действие:** Заменить на CTA для YouTube Analytics

#### Contact Section
**Файл:** `src/app/landing/components/contact-section.tsx`

Текущие тексты:
- "Our team is here to help you get the most out of ShadcnStore..."
- Placeholder: "Tell us how we can help you with ShadcnStore components..."
- Ссылка на GitHub issues шаблона

**Действие:** Заменить на контакты YouTube Analytics

#### Pricing Section
**Файл:** `src/app/landing/components/pricing-section.tsx`

Текущие тексты:
- "Basic dashboard templates"
- "Premium template collection"
- "Future template access"
- Описание: "Start building with our free components or upgrade to Pro for access to premium templates..."

**Действие:** Проверить, согласованы ли тарифы с уже обновленными в `src/components/pricing-plans.tsx`

### 8. Системные файлы

#### .github/workflows/deploy.yml

Workflow для деплоя на shadcnstore.com:
- name: "Deploy Template to ShadcnStore"
- TEMPLATE_NAME: shadcn-dashboard-landing-template
- DOMAIN: shadcnstore.com
- TEMPLATE_DIR: /var/www/shadcnstore/templates/...

**Действие:** Удалить или полностью переписать под наш деплой

#### License.md

Copyright (c) 2025 ShadcnStore

**Действие:** Изменить копирайт на нашу организацию или оставить MIT с атрибуцией

### 9. Дополнительные компоненты

#### src/components/landing/mega-menu.tsx

Меню шаблона:
- "Premium Templates"
- "Admin Dashboards"
- "E-commerce"
- "Marketing and product landing templates"
- "Data visualization and reporting templates"

**Действие:** Адаптировать под YouTube Analytics или удалить

#### src/app/landing/components/navbar.tsx

Навигация:
- "Premium Templates"
- "Admin Dashboards"
- "E-commerce"

**Действие:** Заменить на навигацию YouTube Analytics

---

## 📊 СТАТИСТИКА

### Файлы для изменения

**Критичные (требуют обязательного изменения):**
- Мета-теги и SEO (3 файла)
- FAQ файлы (2 файла)
- Landing page компоненты (10+ файлов)
- Страницы аутентификации (8 файлов)
- Footer компоненты (2 файла)
- License.md (1 файл)

**Итого:** ~30+ файлов

### Типы изменений

1. **Текстовые замены** (простые): 15 файлов
2. **Удаление секций** (средние): 5 файлов (testimonials, team, blog)
3. **Полная переработка** (сложные): 10 файлов (FAQ, features, hero, about)
4. **Системные** (опциональные): 2 файла (workflow, license)

---

## 🎯 РЕКОМЕНДАЦИИ ПО ПРИОРИТЕТАМ

### Приоритет 1 (КРИТИЧНО - блокирует запуск)

1. **Мета-теги и SEO**
   - `src/app/landing/page.tsx` - title, description, og:title
   - `src/app/(auth)/layout.tsx` - title

2. **FAQ файлы**
   - `faq-structure.json` - полная замена на релевантные вопросы
   - `src/app/(dashboard)/faqs/data/faqs.json` - синхронизация

3. **Брендинг**
   - `License.md` - копирайт
   - Все упоминания "ShadcnStore" в UI (navbar, footer, auth pages)

### Приоритет 2 (ВЫСОКИЙ - влияет на восприятие)

4. **Hero и главная страница**
   - `src/app/landing/components/hero-section.tsx` - заголовок и описание
   - `src/app/landing/components/features-section.tsx` - фичи продукта
   - `src/app/landing/components/cta-section.tsx` - call to action

5. **Контент секции**
   - `src/app/landing/components/about-section.tsx` - о компании
   - `src/app/landing/components/contact-section.tsx` - контакты

6. **Фейковый контент**
   - `src/app/landing/components/testimonials-section.tsx` - удалить или заменить
   - `src/app/landing/components/team-section.tsx` - удалить или заменить

### Приоритет 3 (СРЕДНИЙ - можно отложить)

7. **Ссылки и навигация**
   - GitHub ссылки на исходный шаблон (7+ мест)
   - Ссылки на shadcnstore.com (6+ мест)
   - `src/components/sidebar-notification.tsx` - удалить или переделать
   - `src/components/upgrade-to-pro-button.tsx` - удалить или переделать

8. **Навигация и меню**
   - `src/components/landing/mega-menu.tsx` - адаптировать
   - `src/app/landing/components/navbar.tsx` - обновить пункты меню

### Приоритет 4 (НИЗКИЙ - опциональные)

9. **Системные файлы**
   - `.github/workflows/deploy.yml` - удалить или переписать
   - `README.md` строка 242 - оставить attribution или удалить

10. **Дополнительные секции**
    - `src/app/landing/components/blog-section.tsx` - проверить актуальность
    - `src/app/landing/components/stats-section.tsx` - проверить актуальность
    - `src/app/landing/components/logo-carousel.tsx` - проверить актуальность

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Attribution**: Если мы хотим сохранить упоминание об использовании шаблона (это хороший тон), можно оставить одну строчку в footer или README.

2. **GitHub Workflow**: Файл `.github/workflows/deploy.yml` явно не для нашего проекта - его лучше удалить полностью.

3. **FAQ структура**: faq-structure.json и faqs.json должны быть синхронизированы. Лучше использовать один источник правды.

4. **Placeholder изображения**: В нескольких местах используются placeholder изображения (https://ui.shadcn.com/placeholder.svg) - их нужно заменить на реальные.

5. **Testimonials и Team**: Лучше удалить эти секции полностью, чем оставлять фейковый контент. Можно добавить реальные отзывы позже.

---

## 📝 СЛЕДУЮЩИЕ ШАГИ

После согласования приоритетов:

1. Создать задачи для каждого приоритета
2. Подготовить новые тексты для замены
3. Выполнить изменения по файлам
4. Документировать все изменения в CHANGES.md
5. Протестировать лендинг и дашборд
6. Проверить SEO метаданные

---

**Конец отчета**
