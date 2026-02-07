/**
 * Pipeline генерации лендинга.
 *
 * Два режима:
 *   - standard: один вызов AI (быстро, дёшево)
 *   - highQuality: plan → секции → сборка → валидация (предсказуемо, качественно)
 *
 * Используется в:
 *   - server/controller/userController.ts  (createUserProject)
 */
import { callAI, callAIJSON, HIGH_QUALITY } from "../config/ai.js";
import { SYSTEM_PROMPT_GENERATE } from "../prompts/designSystem.js";
import { SECTION_PROMPTS, SECTION_TYPES, type SectionPlan } from "../prompts/sectionPrompts.js";
import { validateGeneratedHTML } from "./validateHTML.js";

// ---------------------------------------------------------------------------
// Промпт для улучшения пользовательского запроса
// ---------------------------------------------------------------------------
const ENHANCE_SYSTEM = `You are a prompt enhancement specialist. Your job is to take a website request and rewrite it as a more detailed TEXT DESCRIPTION.

CRITICAL RULES:
- Return ONLY plain text description, 2-3 paragraphs max.
- NEVER generate HTML, CSS, JavaScript or any code.
- NEVER include code tags, backticks, or markup.
- NEVER start your response with <!DOCTYPE>, <html>, <head>, or any HTML tag.
- Your output is a BRIEF describing what the website should look like, NOT the website itself.

Enhance the request by adding:
1. Specific design details (layout, color scheme, typography)
2. Key sections and features
3. User experience and interactions
4. Modern web design best practices
5. Responsive design requirements

Return ONLY the enhanced text description. No code. No HTML. No markup.`;

// ---------------------------------------------------------------------------
// Промпт для планирования секций
// ---------------------------------------------------------------------------
const PLAN_SYSTEM = `You are a landing page architect. Given a website description, return a JSON object describing which sections to include.

RULES:
- Return ONLY valid JSON, nothing else.
- Include 4-6 sections.
- "hero" and "cta" are MANDATORY.
- Each key is a section role, each value is a section variant from the allowed list.

ALLOWED SECTION TYPES:
${JSON.stringify(SECTION_TYPES, null, 2)}

EXAMPLE OUTPUT:
{
  "hero": "hero-split",
  "socialProof": "social-proof-logos",
  "features": "features-grid-3",
  "testimonials": "testimonials-cards",
  "cta": "cta-centered",
  "footer": "footer-4col"
}

Return ONLY the JSON object. No markdown, no explanation.`;

// ---------------------------------------------------------------------------
// Публичный интерфейс
// ---------------------------------------------------------------------------

export interface GenerationResult {
    html: string;
    enhancedPrompt: string;
    plan: SectionPlan | null;
    validation: { passed: boolean; errors: string[]; warnings: string[] };
    mode: "standard" | "highQuality";
}

/**
 * Главная функция генерации. Выбирает режим автоматически.
 */
export async function generateLanding(
    userPrompt: string,
    forceHighQuality?: boolean,
): Promise<GenerationResult> {
    const useHQ = forceHighQuality ?? HIGH_QUALITY;

    // Шаг 1: Улучшение промпта (общий для обоих режимов)
    const enhancedPrompt = await callAI({
        system: ENHANCE_SYSTEM,
        user: userPrompt,
        highQuality: false,           // для экономии — быстрая модель
        maxTokens: 1024,
        temperature: 0.6,
        format: "text",
    });

    console.log(`[PIPELINE] mode=${useHQ ? "highQuality" : "standard"} prompt_len=${enhancedPrompt.length}`);

    let html: string;
    let plan: SectionPlan | null = null;

    if (useHQ) {
        const result = await generateHighQuality(enhancedPrompt);
        html = result.html;
        plan = result.plan;
    } else {
        html = await generateStandard(enhancedPrompt);
    }

    // Валидация (в HQ-режиме — с retry)
    let validation = validateGeneratedHTML(html);

    if (useHQ && !validation.passed) {
        console.log(`[PIPELINE] Validation failed (attempt 1): ${validation.errors.join("; ")}`);
        // Retry 1
        if (plan) {
            const retry = await generateHighQuality(enhancedPrompt);
            html = retry.html;
        } else {
            html = await generateStandard(enhancedPrompt);
        }
        validation = validateGeneratedHTML(html);

        if (!validation.passed) {
            console.log(`[PIPELINE] Validation failed (attempt 2): ${validation.errors.join("; ")}`);
            // Retry 2 — последняя попытка
            html = await generateStandard(enhancedPrompt);
            validation = validateGeneratedHTML(html);
        }
    }

    if (validation.warnings.length > 0) {
        console.log(`[PIPELINE] Warnings: ${validation.warnings.join("; ")}`);
    }

    return {
        html,
        enhancedPrompt,
        plan,
        validation,
        mode: useHQ ? "highQuality" : "standard",
    };
}

// ---------------------------------------------------------------------------
// Standard mode: один вызов → полный HTML
// ---------------------------------------------------------------------------
async function generateStandard(enhancedPrompt: string): Promise<string> {
    console.log("[PIPELINE] Standard generation...");

    const html = await callAI({
        system: SYSTEM_PROMPT_GENERATE,
        user: enhancedPrompt,
        highQuality: false,
        format: "html",
    });

    return html;
}

// ---------------------------------------------------------------------------
// High Quality mode: plan → секции → сборка
// ---------------------------------------------------------------------------
async function generateHighQuality(
    enhancedPrompt: string,
): Promise<{ html: string; plan: SectionPlan }> {
    console.log("[PIPELINE] High Quality generation: planning...");

    // Шаг 1: Получить план секций
    const plan = await callAIJSON<SectionPlan>({
        system: PLAN_SYSTEM,
        user: enhancedPrompt,
        highQuality: true,
        maxTokens: 512,
        temperature: 0.3,
    });

    if (!plan || !plan.hero || !plan.cta) {
        console.log("[PIPELINE] Plan failed, falling back to standard");
        const html = await generateStandard(enhancedPrompt);
        return { html, plan: plan || { hero: "hero-split", cta: "cta-centered" } };
    }

    // Валидация плана: все типы должны быть из whitelist
    for (const [role, variant] of Object.entries(plan)) {
        const allowed = SECTION_TYPES[role as keyof typeof SECTION_TYPES];
        if (allowed && !allowed.includes(variant)) {
            console.log(`[PIPELINE] Invalid section type ${role}=${variant}, using first allowed`);
            (plan as any)[role] = allowed[0];
        }
    }

    console.log(`[PIPELINE] Plan: ${JSON.stringify(plan)}`);

    // Шаг 2: Генерация каждой секции параллельно
    const sectionEntries = Object.entries(plan) as [string, string][];
    const sectionResults = await Promise.all(
        sectionEntries.map(([role, variant]) =>
            generateSection(role, variant, enhancedPrompt)
        )
    );

    // Шаг 3: Сборка
    const sectionsHTML = sectionResults.join("\n\n");
    const html = assembleHTML(sectionsHTML);

    return { html, plan };
}

// ---------------------------------------------------------------------------
// Генерация одной секции
// ---------------------------------------------------------------------------
async function generateSection(
    role: string,
    variant: string,
    siteDescription: string,
): Promise<string> {
    const sectionPrompt = SECTION_PROMPTS[role] || SECTION_PROMPTS._default;
    const system = sectionPrompt
        .replace("{variant}", variant)
        .replace("{role}", role);

    console.log(`[PIPELINE] Generating section: ${role} (${variant})`);

    const html = await callAI({
        system,
        user: siteDescription,
        highQuality: true,
        maxTokens: 3072,
        temperature: 0.5,
        format: "html",
    });

    return html;
}

// ---------------------------------------------------------------------------
// Сборка финального HTML из секций
// ---------------------------------------------------------------------------
function assembleHTML(sectionsHTML: string): string {
    return `<!DOCTYPE html>
<html lang="ru" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Landing Page</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', system-ui, sans-serif; }
    </style>
</head>
<body class="bg-white text-gray-900">

${sectionsHTML}

<script>
document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Navbar scroll effect
    const nav = document.querySelector('nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.classList.add('bg-white/80', 'backdrop-blur-lg', 'shadow-sm');
            } else {
                nav.classList.remove('bg-white/80', 'backdrop-blur-lg', 'shadow-sm');
            }
        });
    }

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Scroll to top button
    const scrollBtn = document.getElementById('scroll-top');
    if (scrollBtn) {
        window.addEventListener('scroll', () => {
            scrollBtn.classList.toggle('hidden', window.scrollY < 500);
        });
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
</script>

<button id="scroll-top" class="hidden fixed bottom-6 right-6 bg-gray-900 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-700 transition-all duration-200 z-50">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
</button>

</body>
</html>`;
}
