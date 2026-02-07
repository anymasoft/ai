/**
 * Типы секций (жёсткий whitelist) и промпты для каждой секции.
 *
 * При секционной генерации AI получает промпт конкретной секции
 * и возвращает ТОЛЬКО HTML-фрагмент (без <html>, <head>, <body>).
 */

// ---------------------------------------------------------------------------
// Разрешённые типы секций
// ---------------------------------------------------------------------------
export const SECTION_TYPES: Record<string, string[]> = {
    hero:         ["hero-centered", "hero-split"],
    socialProof:  ["social-proof-logos", "social-proof-stats"],
    features:     ["features-grid-3", "features-grid-4", "features-alternating"],
    howItWorks:   ["steps-horizontal", "steps-vertical"],
    testimonials: ["testimonials-cards", "testimonials-single"],
    pricing:      ["pricing-3col", "pricing-2col"],
    cta:          ["cta-centered", "cta-with-image"],
    footer:       ["footer-4col", "footer-simple"],
};

export type SectionPlan = Record<string, string>;

// ---------------------------------------------------------------------------
// Базовые правила для ВСЕХ секций (вставляются в каждый промпт)
// ---------------------------------------------------------------------------
const BASE_RULES = `
OUTPUT RULES:
- Return ONLY an HTML fragment: one <section> (or <nav> or <footer>) element.
- Do NOT include <!DOCTYPE>, <html>, <head>, <body>, <script> tags.
- Do NOT include markdown, explanations, code fences.
- Use Tailwind CSS utility classes ONLY. No custom CSS. No inline style=.
- Use Inter font (already loaded globally).

DESIGN TOKENS:
- Container: max-w-6xl mx-auto px-6 lg:px-8  или  max-w-7xl mx-auto px-6 lg:px-8
- Section padding: py-20 md:py-28 lg:py-32  (МИНИМУМ py-20!)
- H2: text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900
- H3: text-xl md:text-2xl font-semibold
- Body text: text-base md:text-lg text-gray-600 leading-relaxed
- Primary CTA button: inline-flex items-center justify-center bg-{accent}-600 hover:bg-{accent}-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-{accent}-500/25 transition-all duration-200 hover:-translate-y-0.5
- Secondary button: border-2 border-gray-200 hover:border-{accent}-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold transition-all
- Minimum button size: px-6 py-3. НИКОГДА меньше! Основные CTA = px-8 py-4.
- Cards: bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300
- Icons: inline SVG only, w-6 h-6, Heroicons style. NO emoji.
- Images: Unsplash URLs, rounded-2xl shadow-xl. NO placehold.co.
- Style: один акцентный цвет + нейтральные (gray). Никакого UI-шума.

CRITICAL VISIBILITY RULE:
- ALL content MUST be fully visible immediately on page load WITHOUT JavaScript.
- NEVER use: opacity-0, visibility: hidden, display: none for section content.
- NEVER use: data-animate, data-animation, Intersection Observer for showing content.
- ALLOWED: transition/hover effects ONLY on hover (buttons, cards).

CRITICAL RESPONSIVENESS RULE:
- NEVER hide images or key content on mobile: hidden lg:block, hidden md:flex — FORBIDDEN.
- ALL images must be VISIBLE on ALL screen sizes (mobile, tablet, desktop).
- Adapt via sizing: w-full, max-h-[300px] lg:max-h-none, object-cover.
- Adapt via spacing/order: mt-10 lg:mt-0, order-first lg:order-last.
- NEVER adapt via display:none.
- EXCEPTION: hidden is OK ONLY for mobile burger menu (toggled by JS).

FORBIDDEN (нарушение = ошибка):
- Lorem ipsum или placeholder-текст
- py-1, py-2, px-2, px-3 для кнопок — ЗАПРЕЩЕНО
- Перегруженные grid'ы (5+ колонок)
- Emoji as icons
- Placeholder images (placehold.co)
- Pure black #000 text
- Кнопки без hover-эффекта
- Секции без py-20+ отступов
- opacity-0, data-animate — ЗАПРЕЩЕНО, контент должен быть видим сразу

Write all text content in RUSSIAN language, realistic and relevant to the site topic.
First character: <
Last character: >
`.trim();

// ---------------------------------------------------------------------------
// Промпты для каждого типа секции
// ---------------------------------------------------------------------------
export const SECTION_PROMPTS: Record<string, string> = {

    hero: `You generate a HERO section for a landing page. Variant: {variant}.

HERO REQUIREMENTS:
- Tag: <section id="hero" class="min-h-[90vh] flex items-center ...">
- Must contain: badge/label, H1 (with gradient text for key word), subtitle paragraph, 2 CTA buttons, trust indicators
- If "hero-split": two columns (text left, image right on lg:). Use relevant Unsplash photo.
- If "hero-centered": centered text, wider max-w, image or illustration below.
- H1: text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]
- H1 ≤ 12 СЛОВ максимум. Коротко, мощно, по делу. Если длиннее — СОКРАТИ.
- Подзаголовок УСИЛИВАЕТ ценность, а НЕ повторяет H1. Другой смысл, другие слова.
- Use bg-gradient-to-r from-{accent}-600 to-{second}-500 bg-clip-text text-transparent for the KEY WORD in H1.
- Кнопка действия ВИДНА без скролла (above the fold).
- Below buttons add small trust text: "Без карты • 14 дней бесплатно" or similar.
- Include a <nav> at the top of the section: logo left, links center, CTA button right, mobile burger.

${BASE_RULES}`,

    socialProof: `You generate a SOCIAL PROOF section. Variant: {variant}.

REQUIREMENTS:
- If "social-proof-logos": show 5-6 gray company name placeholders in a row with label "Нам доверяют:"
  Use: <span class="text-gray-400 font-semibold text-lg">CompanyName</span> for each.
- If "social-proof-stats": show 3-4 big numbers in a row (e.g., "3000+", "98%", "4.9★", "15 лет").
  Numbers: text-4xl md:text-5xl font-bold text-gray-900. Labels: text-sm text-gray-500.
- Background: bg-gray-50 or slight contrast to hero.
- Section padding: py-12 md:py-16 (smaller than other sections).

${BASE_RULES}`,

    features: `You generate a FEATURES section. Variant: {variant}.

REQUIREMENTS:
- H2 section title centered with subtitle below it.
- If "features-grid-3": 3 cards in grid (lg:grid-cols-3).
- If "features-grid-4": 4 cards (lg:grid-cols-4).
- If "features-alternating": alternating rows of text + image (2-3 rows).
- Each card: icon (inline SVG in colored circle bg-{accent}-100 rounded-xl w-12 h-12), title (H3), description (2-3 lines).
- Cards: bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-{accent}-100 transition-all duration-300.
- Write 3-4 REAL, relevant features with realistic descriptions.

${BASE_RULES}`,

    howItWorks: `You generate a HOW IT WORKS section. Variant: {variant}.

REQUIREMENTS:
- H2 title: "Как это работает" or relevant.
- 3 steps with numbering.
- If "steps-horizontal": 3 columns with step numbers (01, 02, 03), connected visually.
- If "steps-vertical": vertical timeline layout.
- Each step: number (text-6xl font-bold text-{accent}-100), title, description.
- Realistic step descriptions relevant to the site topic.

${BASE_RULES}`,

    testimonials: `You generate a TESTIMONIALS section. Variant: {variant}.

REQUIREMENTS:
- H2 title: "Что говорят наши клиенты" or relevant.
- If "testimonials-cards": 3 cards in grid (lg:grid-cols-3).
- If "testimonials-single": one large quote in center.
- Each testimonial: quote in quotes, author name, role/company, avatar image (Unsplash face photo 80x80, rounded-full).
- 5 stars rating: use inline SVG stars.
- Use realistic RUSSIAN names and job titles.
- Cards: bg-white rounded-2xl p-8 shadow-sm border border-gray-100.

${BASE_RULES}`,

    pricing: `You generate a PRICING section. Variant: {variant}.

REQUIREMENTS:
- H2 title centered.
- If "pricing-3col": 3 pricing cards. Middle card highlighted (ring-2 ring-{accent}-500, "Популярный" badge).
- If "pricing-2col": 2 pricing cards.
- Each card: plan name, price (text-4xl font-bold), feature list with checkmark SVGs, CTA button.
- Use realistic Russian pricing (e.g., "от 990 ₽/мес", "4 990 ₽/мес").
- Cards: rounded-2xl p-8, highlighted card gets accent border and shadow.

${BASE_RULES}`,

    cta: `You generate a final CTA section before the footer. Variant: {variant}.

REQUIREMENTS:
- If "cta-centered": gradient background (bg-gradient-to-r from-{accent}-600 to-{accent}-800), centered white text, big CTA button (white bg, accent text).
- If "cta-with-image": split layout, text + button left, image right.
- H2: text-3xl md:text-4xl font-bold text-white.
- Subtitle: text-lg text-white/80.
- Button: bg-white text-{accent}-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-all shadow-lg.
- Add supporting text below button (e.g., "Бесплатная консультация" or "Без обязательств").
- Section id="cta".

${BASE_RULES}`,

    footer: `You generate a FOOTER. Variant: {variant}.

FOOTER ОБЯЗАТЕЛЕН ВСЕГДА. Лендинг без footer = БРАК.

REQUIREMENTS:
- Tag: <footer class="bg-gray-950 text-gray-400 py-16">
- ОБЯЗАТЕЛЬНО внутри: бренд/лого, краткий текст о компании (1-2 предложения), вторичный CTA (кнопка или ссылка).
- If "footer-4col": 4 columns (grid lg:grid-cols-4): Company info, Services/Product, Resources, Contacts.
- If "footer-simple": logo + links + social icons in one row.
- Include: phone, email, address (realistic Russian).
- Social icons: inline SVG (Telegram, VK, WhatsApp or similar). Size: w-5 h-5.
- Bottom bar: border-t border-gray-800 pt-8 mt-8, copyright © 2025, privacy policy link.
- Logo text: text-xl font-bold text-white.

${BASE_RULES}`,

    _default: `You generate a {role} section for a landing page. Variant: {variant}.

Create a well-designed section that fits a premium landing page.
Use appropriate H2 heading, proper spacing, and relevant content.

${BASE_RULES}`,
};
