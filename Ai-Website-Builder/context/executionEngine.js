/**
 * EXECUTION ENGINE v2.0
 *
 * ИНВАРИАНТ: Execution считается УСПЕШНЫМ ТОЛЬКО если Errors == 0
 * Белый экран / runtime errors / build errors → ВСЕ это errors
 *
 * СТРАТЕГИЯ:
 * 1. Запустить build
 * 2. Парсить errors
 * 3. Если errors == 0 → SUCCESS
 * 4. Если errors > 0 → вызвать LLM в FIX MODE
 * 5. Повторить до success или maxIterations == 5
 *
 * СОХРАНЯТЬ: только SUCCESS результат, иначе лог + последняя зелёная версия
 */

import { execSync } from 'child_process';
import { GenAiCode } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';

/**
 * ЭТАП 1: Запускает build и возвращает output
 * @returns { success, stdout, stderr, exitCode, timestamp }
 */
export function runExecution(projectDir, command = 'build') {
  const timestamp = new Date().toISOString();
  try {
    console.log(`\n🚀 [${timestamp}] Executing: npm run ${command}...`);

    const output = execSync(`npm run ${command}`, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000  // 2 минуты max
    });

    console.log(`✅ Build succeeded`);

    return {
      success: true,
      stdout: output,
      stderr: '',
      exitCode: 0,
      command,
      timestamp
    };
  } catch (error) {
    console.log(`❌ Build failed (exit code: ${error.status})`);

    return {
      success: false,
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : error.message,
      exitCode: error.status || 1,
      command,
      timestamp
    };
  }
}

/**
 * ЭТАП 2: Парсит ошибки из build output (6 типов)
 * @returns [ { type, file, line, column, message } ]
 */
export function parseExecutionErrors(output) {
  if (!output || output.length === 0) return [];

  const errors = [];
  const lines = output.split('\n');
  const errorMap = new Set();  // Для дедупликации

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1️⃣ NEXT.JS BUILD ERRORS
    if (line.match(/error\s+-\s+/i)) {
      const match = line.match(/error\s+-\s+(.+?)\s+at\s+(.+?):\s*(\d+):(\d+)/);
      if (match) {
        const key = `${match[2]}:${match[3]}`;
        if (!errorMap.has(key)) {
          errorMap.add(key);
          errors.push({
            type: 'next_build_error',
            message: match[1],
            file: match[2],
            line: parseInt(match[3]),
            column: parseInt(match[4]),
            severity: 'error'
          });
        }
      }
      continue;
    }

    // 2️⃣ SYNTAX ERRORS
    if (line.includes('SyntaxError')) {
      const syntaxMatch = line.match(/SyntaxError:\s*(.+?)(?:\s+at|\s+in|$)/);
      const fileMatch = lines[i - 1]?.match(/at\s+(.+?):\s*(\d+)/);

      const key = `syntax:${fileMatch?.[1] || 'unknown'}`;
      if (!errorMap.has(key)) {
        errorMap.add(key);
        errors.push({
          type: 'syntax_error',
          message: syntaxMatch ? syntaxMatch[1] : line,
          file: fileMatch?.[1] || 'unknown',
          line: fileMatch ? parseInt(fileMatch[2]) : 0,
          severity: 'error'
        });
      }
      continue;
    }

    // 3️⃣ MODULE NOT FOUND
    if (line.includes('Cannot find module') || line.includes('Module not found')) {
      const moduleMatch = line.match(/(?:Cannot find module|Module not found):\s*['\"](.+?)['\"]/) ||
                          line.match(/['\"](.+?)['\"].*(?:not found|not exist)/);

      const key = `module:${moduleMatch?.[1] || 'unknown'}`;
      if (!errorMap.has(key)) {
        errorMap.add(key);
        errors.push({
          type: 'module_not_found',
          message: `Cannot find module: ${moduleMatch?.[1] || 'unknown'}`,
          file: 'package.json',
          severity: 'error'
        });
      }
      continue;
    }

    // 4️⃣ IMPORT/EXPORT ERRORS
    if (line.includes('export') && (line.includes('undefined') || line.includes('not'))) {
      if (!errorMap.has('export:undefined')) {
        errorMap.add('export:undefined');
        errors.push({
          type: 'export_error',
          message: 'Component export is undefined - check default export',
          file: 'component',
          severity: 'error'
        });
      }
      continue;
    }

    // 5️⃣ RUNTIME/JSX ERRORS
    if (line.includes('Element type is invalid') || line.includes('is not a valid')) {
      if (!errorMap.has('jsx:invalid')) {
        errorMap.add('jsx:invalid');
        errors.push({
          type: 'jsx_error',
          message: 'Invalid JSX element - likely missing export or wrong import',
          severity: 'error'
        });
      }
      continue;
    }

    // 6️⃣ TYPE ERRORS (TypeScript)
    if (line.includes('is not assignable to') || line.includes('Type ')) {
      errors.push({
        type: 'type_error',
        message: line.trim(),
        severity: 'warning'
      });
      continue;
    }

    // 7️⃣ GENERIC ERROR PATTERNS
    if (line.trim().startsWith('error') ||
        (line.includes('Error:') && !line.includes('node_modules'))) {
      const key = `generic:${line.substring(0, 50)}`;
      if (!errorMap.has(key)) {
        errorMap.add(key);
        errors.push({
          type: 'unknown_error',
          message: line.trim(),
          severity: 'error'
        });
      }
    }
  }

  return errors;
}

/**
 * ЭТАП 3: Вспомогательная функция - извлечь затронутые файлы из ошибок
 */
function extractAffectedFiles(currentFiles, errors) {
  const affectedPaths = new Set();

  // Всегда включаем App.js
  affectedPaths.add('/App.js');

  // Извлекаем из ошибок
  for (const err of errors) {
    if (err.file && err.file !== 'component' && err.file !== 'package.json') {
      affectedPaths.add(err.file);
    }
  }

  const result = {};
  for (const path of affectedPaths) {
    if (currentFiles[path]) {
      result[path] = currentFiles[path];
    }
  }

  return result;
}

/**
 * ЭТАП 4: ГЛАВНЫЙ FIX LOOP - повторяет до success или maxIterations
 *
 * @param {Object} options
 *   - initialFiles: текущие файлы (путь → содержимое)
 *   - callLLMInFixMode: функция LLM
 *   - projectDir: директория проекта (для npm run build)
 *   - maxIterations: макс попыток (default 5)
 *   - onIterationComplete: callback для логирования
 *
 * @returns { success, finalFiles, errors, iterations, executionLog }
 */
export async function runFixLoop({
  initialFiles,
  callLLMInFixMode,
  projectDir = process.cwd(),
  maxIterations = 5,
  onIterationComplete = null
}) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔄 EXECUTION FIX LOOP STARTED (max ${maxIterations} iterations)`);
  console.log(`${'═'.repeat(70)}\n`);

  let currentFiles = { ...initialFiles };
  const executionLog = [];
  let lastErrors = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📍 ITERATION ${iteration + 1}/${maxIterations}`);
    console.log(`${'─'.repeat(70)}`);

    // ШАГ 1: Запускаем build
    const executionResult = runExecution(projectDir, 'build');
    const combinedOutput = executionResult.stdout + '\n' + executionResult.stderr;

    // ШАГ 2: Парсим ошибки
    const errors = parseExecutionErrors(combinedOutput);
    console.log(`📋 Errors found: ${errors.length}`);

    if (errors.length > 0) {
      console.log(`\nError summary:`);
      const errorsByType = {};
      for (const err of errors) {
        errorsByType[err.type] = (errorsByType[err.type] || 0) + 1;
      }
      for (const [type, count] of Object.entries(errorsByType)) {
        console.log(`  • ${type}: ${count}`);
      }
    }

    // Логируем итерацию
    const iterationLog = {
      iteration: iteration + 1,
      timestamp: executionResult.timestamp,
      command: executionResult.command,
      exitCode: executionResult.exitCode,
      errorsCount: errors.length,
      errorTypes: errors.map(e => e.type),
      success: errors.length === 0
    };
    executionLog.push(iterationLog);

    // ШАГ 3: Проверяем успех (Errors == 0)
    if (errors.length === 0) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`✅ SUCCESS - All errors fixed!`);
      console.log(`${'═'.repeat(70)}\n`);

      if (onIterationComplete) {
        onIterationComplete(iterationLog);
      }

      return {
        success: true,
        finalFiles: currentFiles,
        errors: [],
        iterations: iteration + 1,
        executionLog
      };
    }

    // ШАГ 4: Если последняя итерация - выходим с ошибками
    if (iteration === maxIterations - 1) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`❌ FAILED - Max iterations reached (${errors.length} errors remain)`);
      console.log(`${'═'.repeat(70)}\n`);

      if (onIterationComplete) {
        onIterationComplete(iterationLog);
      }

      return {
        success: false,
        finalFiles: currentFiles,
        errors: errors,
        iterations: iteration + 1,
        executionLog
      };
    }

    // ШАГ 5: Вызываем LLM в FIX MODE
    console.log(`\n🤖 Calling LLM in FIX MODE...`);
    try {
      const affectedFiles = extractAffectedFiles(currentFiles, errors);

      const fixResult = await callLLMInFixMode({
        errors: errors,
        affectedFiles: affectedFiles,
        currentFiles: currentFiles,
        iteration: iteration + 1,
        maxIterations: maxIterations
      });

      if (fixResult && fixResult.files) {
        // Обновляем только затронутые файлы
        const updatedCount = Object.keys(fixResult.files).length;
        console.log(`✏️  LLM updated ${updatedCount} file(s)`);

        currentFiles = { ...currentFiles, ...fixResult.files };

        iterationLog.changedFiles = Object.keys(fixResult.files);
        iterationLog.llmExplanation = fixResult.explanation;
      } else {
        console.warn(`⚠️  LLM returned no changes`);
      }

      if (onIterationComplete) {
        onIterationComplete(iterationLog);
      }

    } catch (error) {
      console.error(`❌ LLM call failed: ${error.message}`);
      iterationLog.llmError = error.message;

      if (onIterationComplete) {
        onIterationComplete(iterationLog);
      }

      return {
        success: false,
        finalFiles: currentFiles,
        errors: errors,
        iterations: iteration + 1,
        executionLog,
        error: error.message
      };
    }
  }

  // На случай если что-то пошло не так
  return {
    success: false,
    finalFiles: currentFiles,
    errors: lastErrors,
    iterations: maxIterations,
    executionLog
  };
}
