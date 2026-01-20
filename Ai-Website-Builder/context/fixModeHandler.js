/**
 * Fix Mode Handler - вызывает LLM для исправления ошибок выполнения
 */

import { GenAiCode } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';

/**
 * Вызывает LLM в FIX MODE для исправления ошибок выполнения
 *
 * @param {Object} params
 *   - errors: массив структурированных ошибок
 *   - affectedFiles: объект файлов, упомянутых в ошибках
 *   - currentFiles: все текущие файлы проекта
 *   - iteration: номер итерации
 *
 * @returns {Object} { mode, explanation, files }
 */
export async function callLLMInFixMode(params) {
  const { errors, affectedFiles, currentFiles, iteration } = params;

  // ════════════════════════════════════════════════════════════════
  // СОБИРАЕМ ПРОМПТ ДЛЯ FIX MODE
  // ════════════════════════════════════════════════════════════════

  let fixPrompt = '';

  // МЕТА-ИНФОРМАЦИЯ
  fixPrompt += `=== FIX MODE EXECUTION ===\n`;
  fixPrompt += `Iteration: ${iteration + 1}\n`;
  fixPrompt += `Errors to fix: ${errors.length}\n\n`;

  // СПИСОК ОШИБОК (структурированный)
  fixPrompt += `=== EXECUTION ERRORS TO FIX ===\n`;
  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    fixPrompt += `\nError ${i + 1}:\n`;
    fixPrompt += `  Type: ${err.type}\n`;
    if (err.file) fixPrompt += `  File: ${err.file}\n`;
    if (err.line) fixPrompt += `  Line: ${err.line}\n`;
    fixPrompt += `  Message: ${err.message}\n`;
  }

  fixPrompt += '\n';

  // ЗАТРОНУТЫЕ ФАЙЛЫ (ПОЛНЫЙ КОД)
  fixPrompt += `=== AFFECTED FILES (FULL CODE) ===\n`;
  for (const [filePath, content] of Object.entries(affectedFiles)) {
    const code = typeof content === 'string' ? content : content.code;
    fixPrompt += `\nFile: ${filePath}\n`;
    fixPrompt += `\`\`\`jsx\n${code}\n\`\`\`\n`;
  }

  fixPrompt += '\n';

  // PROJECT CONTRACT
  fixPrompt += `=== PROJECT CONTRACT ===\n`;
  fixPrompt += Prompt.PROJECT_CONTRACT || 'PROJECT_CONTRACT not found';
  fixPrompt += '\n\n';

  // FIX MODE RULES
  fixPrompt += `=== FIX MODE RULES ===\n`;
  fixPrompt += Prompt.FIX_MODE_PROMPT;

  // ════════════════════════════════════════════════════════════════
  // ОТПРАВЛЯЕМ В LLM
  // ════════════════════════════════════════════════════════════════

  console.log(`\n📝 Sending fix request to LLM (${fixPrompt.length} bytes)...`);

  try {
    const result = await GenAiCode.sendMessage(fixPrompt);
    let resp = result.response.text();

    console.log(`✅ LLM response received`);

    // ════════════════════════════════════════════════════════════════
    // ПАРСИМ ОТВЕТ
    // ════════════════════════════════════════════════════════════════

    // Удаляем markdown блоки если есть
    const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      resp = jsonMatch[1].trim();
      console.log(`📄 Extracted JSON from markdown`);
    }

    const parsedResponse = JSON.parse(resp);

    console.log(`📦 LLM fixed files: ${Object.keys(parsedResponse.files || {}).length}`);
    console.log(`📋 Explanation: ${parsedResponse.explanation}`);

    return parsedResponse;
  } catch (error) {
    console.error(`❌ LLM call failed: ${error.message}`);
    throw error;
  }
}
