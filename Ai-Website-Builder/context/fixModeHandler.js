/**
 * FIX MODE HANDLER v2.0
 *
 * Вызывается из runFixLoop когда есть errors
 *
 * Задача: отправить LLM ТОЛЬКО необходимую информацию для исправления
 * - список ошибок
 * - затронутые файлы (полный текст)
 * - Project Contract (strict rules)
 * - Change Scope (минимальные изменения)
 *
 * Запрещено: рефакторинг, улучшения, новые фичи, изменения вне affected files
 */

import { GenAiCode } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';
import { PROJECT_CONTRACT } from '@/data/ProjectContract';

/**
 * Форматирует ошибки в читаемый текст для LLM
 * ВАЖНО: включает raw stderr для полного контекста
 */
function formatErrorsForLLM(errors) {
  const grouped = {};
  for (const err of errors) {
    if (!grouped[err.type]) {
      grouped[err.type] = [];
    }
    grouped[err.type].push(err);
  }

  let text = `## EXECUTION ERRORS (${errors.length} total)\n\n`;

  for (const [type, typeErrors] of Object.entries(grouped)) {
    text += `### ${type} (${typeErrors.length})\n`;
    for (let i = 0; i < typeErrors.length; i++) {
      const err = typeErrors[i];
      text += `${i + 1}. ${err.message}\n`;
      if (err.file) text += `   File: ${err.file}\n`;
      if (err.line) text += `   Line: ${err.line}\n`;
      if (err.column) text += `   Column: ${err.column}\n`;
    }
    text += '\n';
  }

  // КРИТИЧЕСКИ ВАЖНО: Добавляем полный raw stderr если он есть
  if (errors.length > 0 && errors[0].raw) {
    text += `## FULL BUILD OUTPUT\n\n\`\`\`\n${errors[0].raw}\n\`\`\`\n\n`;
  }

  return text;
}

/**
 * Форматирует файлы для передачи в LLM
 */
function formatFilesForLLM(files) {
  let text = `## AFFECTED FILES (full source code)\n\n`;

  for (const [filePath, content] of Object.entries(files)) {
    const code = typeof content === 'string' ? content : content.code;
    text += `### File: ${filePath}\n`;
    text += '```javascript\n';
    text += code;
    text += '\n```\n\n';
  }

  return text;
}

/**
 * Парсит ответ LLM в формате:
 * <file path="...">code</file>
 */
function parseFixResponse(response) {
  const files = {};
  let explanation = '';

  // Ищем секцию с объяснением
  const explanationMatch = response.match(/<explanation>([\s\S]*?)<\/explanation>/);
  if (explanationMatch) {
    explanation = explanationMatch[1].trim();
  } else {
    // Ищем первый абзац без тегов как объяснение
    const firstPara = response.split('\n')[0];
    if (!firstPara.includes('<file') && firstPara.length > 0) {
      explanation = firstPara;
    }
  }

  // Ищем файлы
  const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match;
  let fileCount = 0;

  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const code = match[2].trim();

    // Пропускаем пустые файлы
    if (code.length > 10) {
      files[filePath] = { code };
      fileCount++;
    }
  }

  // Если нет <file> тегов, ищем markdown код-блоки
  if (fileCount === 0) {
    console.warn('[fixModeHandler] No <file> tags found, searching for markdown code blocks...');

    // Ищем ```javascript или просто ```
    const codeBlockRegex = /```(?:javascript|jsx|js)?\n([\s\S]*?)```/g;
    let blockIndex = 0;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const code = match[1].trim();
      if (code.length > 10) {
        // Пытаемся определить путь файла из контента
        let detectedPath = '/App.js';
        if (code.includes('export default {')) detectedPath = '/Lookup.jsx';
        if (code.includes('createRoot')) detectedPath = '/index.js';

        files[detectedPath] = { code };
        blockIndex++;
      }
    }
  }

  return {
    files: Object.keys(files).length > 0 ? files : null,
    explanation: explanation || 'Applied fixes',
    success: Object.keys(files).length > 0
  };
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ: вызывает LLM в FIX MODE
 *
 * @param {Object} params
 *   - errors: array of execution errors
 *   - affectedFiles: object of affected files (path → content)
 *   - currentFiles: all current project files
 *   - iteration: текущая итерация
 *   - maxIterations: максимум итераций
 *
 * @returns { files: {...}, explanation: string, success: boolean }
 */
export async function callLLMInFixMode(params) {
  const { errors, affectedFiles, currentFiles, iteration, maxIterations } = params;

  console.log(`[FIX MODE] Iteration ${iteration}/${maxIterations}, ${errors.length} errors to fix`);

  // Строим prompt для LLM
  let fixPrompt = `# YOU ARE IN FIX MODE

**CRITICAL**: Your ONLY job is to FIX the specified errors. Nothing else.

## Current Iteration
- Iteration: ${iteration}/${maxIterations}
- Errors to fix: ${errors.length}
- Affected files: ${Object.keys(affectedFiles).length}

## ERROR INFORMATION

Look at the FULL BUILD OUTPUT section below - it contains the complete stacktrace and all error details.
The affected files with full source code are provided after the PROJECT CONTRACT.

${formatErrorsForLLM(errors)}

${formatFilesForLLM(affectedFiles)}

## PROJECT CONTRACT (MUST FOLLOW)
\`\`\`
${PROJECT_CONTRACT}
\`\`\`

## FIX MODE RULES (STRICT)

### YOU MUST DO
1. **Analyze the FULL BUILD OUTPUT** - it contains all error details and stacktrace
2. **Review affected file contents** - provided in full below
3. **Fix ONLY the errors** - focus on making errors == 0
4. **Return COMPLETE code** - for each affected file

✅ **YOU CAN**:
- Fix syntax errors
- Fix import/export issues
- Fix missing components/modules
- Fix runtime errors (null references, undefined properties)
- Add missing exports
- Correct incorrect return statements
- Fix JSX element issues
- Add missing files if absolutely necessary to fix errors

❌ **YOU CANNOT**:
- Refactor code
- Improve styling or add CSS
- Add new features
- Change code structure
- Modify files not directly causing errors
- Add new packages/dependencies
- Remove existing code
- Rename variables/functions
- Make cosmetic changes

## RESPONSE FORMAT

You MUST respond in this exact format:

<file path="/path/to/file">
\`\`\`javascript
[COMPLETE FIXED CODE]
\`\`\`
</file>

<file path="/other/file">
\`\`\`javascript
[COMPLETE FIXED CODE]
\`\`\`
</file>

<explanation>
Brief explanation of what was fixed (1-2 sentences)
</explanation>

## TASK

Fix these ${errors.length} error(s) in the provided files. Return the COMPLETE corrected code.
`;

  try {
    console.log(`[FIX MODE] Sending to LLM... (${fixPrompt.length} characters)`);

    const result = await GenAiCode.sendMessage(fixPrompt);
    let resp = result.response.text();

    console.log(`[FIX MODE] LLM response received`);

    // Парсим ответ
    const parsed = parseFixResponse(resp);

    if (parsed.files) {
      console.log(`[FIX MODE] ✅ LLM returned ${Object.keys(parsed.files).length} fixed file(s)`);
      console.log(`[FIX MODE] Explanation: ${parsed.explanation}`);
    } else {
      console.warn(`[FIX MODE] ⚠️ LLM returned no valid files`);
    }

    return parsed;

  } catch (error) {
    console.error(`[FIX MODE] ❌ Error calling LLM: ${error.message}`);
    throw error;
  }
}
