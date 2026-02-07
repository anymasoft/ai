/**
 * Автоматическая валидация качества сгенерированного HTML.
 * НЕ использует AI — только парсинг строк и регулярки.
 */

export interface ValidationResult {
    passed: boolean;
    errors: string[];
    warnings: string[];
}

export function validateGeneratedHTML(html: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!html || html.trim().length < 200) {
        errors.push("HTML слишком короткий (< 200 символов)");
        return { passed: false, errors, warnings };
    }

    // --- 1. Ровно один <h1> ---
    const h1Matches = html.match(/<h1[\s>]/gi);
    const h1Count = h1Matches ? h1Matches.length : 0;
    if (h1Count === 0) {
        errors.push("Нет <h1> на странице");
    } else if (h1Count > 1) {
        warnings.push(`Найдено ${h1Count} тегов <h1>, рекомендуется ровно 1`);
    }

    // --- 2. H1 ≤ 12 слов ---
    const h1ContentMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1ContentMatch) {
        const h1Text = h1ContentMatch[1].replace(/<[^>]+>/g, "").trim();
        const wordCount = h1Text.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount > 12) {
            errors.push(`H1 слишком длинный: ${wordCount} слов (максимум 12)`);
        }
    }

    // --- 3. Минимум 2 CTA-кнопки (ссылки или кнопки с классами кнопок) ---
    const ctaPattern = /<(a|button)[^>]*class="[^"]*\b(bg-\w+-[56]00|px-[6-9]|py-[3-9])\b[^"]*"[^>]*>/gi;
    const ctaMatches = html.match(ctaPattern);
    const ctaCount = ctaMatches ? ctaMatches.length : 0;
    if (ctaCount < 2) {
        errors.push(`Найдено CTA-кнопок: ${ctaCount}, нужно минимум 2`);
    }

    // --- 4. Есть social proof ---
    const socialProofPatterns = [
        /\d{2,}[\s+]*(\+|клиент|компани|пользовател|отзыв|проект|customer|client|user|review)/i,
        /\d\.\d\s*★/,
        /social.?proof/i,
        /trust|доверя/i,
        /рейтинг|rating/i,
    ];
    const hasSocialProof = socialProofPatterns.some(p => p.test(html));
    if (!hasSocialProof) {
        warnings.push("Не обнаружен social proof (цифры, рейтинги, количество клиентов)");
    }

    // --- 5. Нет Lorem ipsum ---
    if (/lorem\s+ipsum/i.test(html)) {
        errors.push("Содержит Lorem ipsum — запрещено");
    }

    // --- 6. Кнопки не мельче px-6 py-3 (ошибка, не предупреждение) ---
    const smallBtnPatterns = [
        { pattern: /<(a|button)[^>]*class="[^"]*\bpy-1\b[^"]*"[^>]*>/gi, label: "py-1" },
        { pattern: /<(a|button)[^>]*class="[^"]*\bpy-2\b[^"]*bg-\w+-[4-9]00[^"]*"[^>]*>/gi, label: "py-2" },
        { pattern: /<(a|button)[^>]*class="[^"]*bg-\w+-[4-9]00[^"]*\bpy-2\b[^"]*"[^>]*>/gi, label: "py-2" },
        { pattern: /<(a|button)[^>]*class="[^"]*\bpx-2\b[^"]*bg-\w+-[4-9]00[^"]*"[^>]*>/gi, label: "px-2" },
        { pattern: /<(a|button)[^>]*class="[^"]*bg-\w+-[4-9]00[^"]*\bpx-2\b[^"]*"[^>]*>/gi, label: "px-2" },
        { pattern: /<(a|button)[^>]*class="[^"]*\bpx-3\b[^"]*bg-\w+-[4-9]00[^"]*"[^>]*>/gi, label: "px-3" },
        { pattern: /<(a|button)[^>]*class="[^"]*bg-\w+-[4-9]00[^"]*\bpx-3\b[^"]*"[^>]*>/gi, label: "px-3" },
    ];
    for (const { pattern, label } of smallBtnPatterns) {
        if (pattern.test(html)) {
            errors.push(`Найдены маленькие кнопки (${label}) — минимум py-3 px-6, основные CTA py-4 px-8`);
            break;
        }
    }

    // --- 7. Есть Tailwind CDN ---
    if (!html.includes("tailwindcss") && !html.includes("tailwind")) {
        errors.push("Не подключён Tailwind CSS");
    }

    // --- 8. Есть <nav> (обязательна) ---
    if (!/<nav[\s>]/i.test(html)) {
        errors.push("Отсутствует навигация (<nav>)");
    }

    // --- 9. Есть <footer> (ОБЯЗАТЕЛЕН — ошибка, не предупреждение) ---
    if (!/<footer[\s>]/i.test(html)) {
        errors.push("Отсутствует <footer> — лендинг без footer = брак");
    }

    // --- 10. Нет placeholder.co ---
    if (/placehold\.co|placeholder\.com|via\.placeholder/i.test(html)) {
        warnings.push("Используются placeholder-изображения вместо реальных фото");
    }

    return {
        passed: errors.length === 0,
        errors,
        warnings,
    };
}
