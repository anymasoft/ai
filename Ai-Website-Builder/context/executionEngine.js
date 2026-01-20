/**
 * Execution Engine - запускает проект и парсит ошибки
 * Используется для автоматического исправления ошибок LLM
 */

import { execSync } from 'child_process';
import path from 'path';

/**
 * Запускает build/dev проекта и возвращает результат выполнения
 *
 * @param {string} projectDir - путь к папке проекта
 * @param {string} command - команда для запуска ('build' | 'dev' | 'test')
 * @returns {Object} { success, stdout, stderr, exitCode }
 */
export function runExecution(projectDir, command = 'build') {
  try {
    console.log(`\n🚀 Executing: npm run ${command}...`);

    const output = execSync(`npm run ${command}`, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    console.log(`✅ Execution successful`);

    return {
      success: true,
      stdout: output,
      stderr: '',
      exitCode: 0,
      command
    };
  } catch (error) {
    console.log(`❌ Execution failed (exit code: ${error.status})`);

    return {
      success: false,
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : error.message,
      exitCode: error.status || 1,
      command
    };
  }
}

/**
 * Проверяет что UI может рендериться (структурные файлы корректны)
 * Проверяет структуру React приложения ПЕРЕД запуском build
 *
 * @param {Object} files - объект всех файлов проекта
 * @returns {Object} { isValid, errors: [] }
 */
export function checkRuntimeUIStructure(files) {
  const errors = [];

  if (!files) {
    return {
      isValid: false,
      errors: [{
        type: 'runtime_render_error',
        message: 'No files provided',
        fileHints: ['index.js', 'App.js', 'index.html']
      }]
    };
  }

  // Проверяем index.js
  const indexFile = files['/index.js'] || files['index.js'];
  if (!indexFile) {
    errors.push({
      type: 'runtime_render_error',
      message: 'Missing entry point: index.js (must contain React.createRoot)',
      fileHints: ['index.js']
    });
  } else {
    const indexCode = typeof indexFile === 'string' ? indexFile : indexFile.code;
    if (!indexCode.includes('createRoot')) {
      errors.push({
        type: 'runtime_render_error',
        message: 'index.js missing React.createRoot() call',
        fileHints: ['index.js']
      });
    }
  }

  // Проверяем App.js
  const appFile = files['/App.js'] || files['App.js'];
  if (!appFile) {
    errors.push({
      type: 'runtime_render_error',
      message: 'Missing App.js (main component)',
      fileHints: ['App.js']
    });
  } else {
    const appCode = typeof appFile === 'string' ? appFile : appFile.code;

    // Проверяем что App экспортится
    if (!appCode.includes('export')) {
      errors.push({
        type: 'runtime_render_error',
        message: 'App.js does not export a component',
        fileHints: ['App.js']
      });
    }

    // Проверяем что App возвращает что-то (не undefined/null)
    const hasReturn = appCode.includes('return');
    const hasJSX = appCode.includes('return (') || appCode.includes('return <');

    if (!hasReturn) {
      errors.push({
        type: 'runtime_render_error',
        message: 'App.js function does not have a return statement',
        fileHints: ['App.js']
      });
    } else if (!hasJSX && !appCode.includes('return {')) {
      // Если есть return, но это не JSX и не object - может быть просто return;
      // Проверяем что это не пусто
      if (appCode.includes('return;') || appCode.includes('return }')) {
        errors.push({
          type: 'runtime_render_error',
          message: 'App.js function returns empty value (null/undefined)',
          fileHints: ['App.js']
        });
      }
    }
  }

  // Проверяем index.html
  const htmlFile = files['/public/index.html'] || files['index.html'];
  if (!htmlFile) {
    errors.push({
      type: 'runtime_render_error',
      message: 'Missing index.html',
      fileHints: ['index.html']
    });
  } else {
    const htmlCode = typeof htmlFile === 'string' ? htmlFile : htmlFile.code;
    if (!htmlCode.includes('id="root"')) {
      errors.push({
        type: 'runtime_render_error',
        message: 'index.html missing root element (id="root")',
        fileHints: ['index.html']
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Парсит ошибки из вывода выполнения
 *
 * @param {string} output - объединённый stdout + stderr
 * @returns {Array} массив структурированных ошибок
 */
export function parseExecutionErrors(output) {
  const errors = [];

  if (!output || output.length === 0) {
    return errors;
  }

  const lines = output.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ══════════════════════════════════════════════════════════════
    // NEXT.JS BUILD ERRORS
    // ══════════════════════════════════════════════════════════════

    // Format: "error - SomeFile.jsx (12:5): Error message"
    const nextErrorMatch = line.match(/error\s+-\s+(.+?)\s+\((\d+):(\d+)\):\s*(.+?)$/);
    if (nextErrorMatch) {
      errors.push({
        type: 'next_build_error',
        file: nextErrorMatch[1],
        line: parseInt(nextErrorMatch[2]),
        column: parseInt(nextErrorMatch[3]),
        message: nextErrorMatch[4],
        raw: line
      });
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // SYNTAX ERRORS (React/JSX)
    // ══════════════════════════════════════════════════════════════

    // Format: "SyntaxError: Unexpected token..."
    if (line.includes('SyntaxError')) {
      const syntaxMatch = line.match(/SyntaxError:\s*(.+?)(?:\s+at|$)/);
      errors.push({
        type: 'syntax_error',
        file: extractFilePath(lines, i),
        line: null,
        column: null,
        message: syntaxMatch ? syntaxMatch[1] : line,
        raw: line
      });
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // MODULE NOT FOUND
    // ══════════════════════════════════════════════════════════════

    // Format: "error - Cannot find module 'lodash'"
    if (line.includes('Cannot find module') || line.includes('Module not found')) {
      const moduleMatch = line.match(/(?:Cannot find module|Module not found):\s*['"](.+?)['"]/);
      errors.push({
        type: 'module_not_found',
        file: extractFilePath(lines, i),
        line: null,
        column: null,
        message: moduleMatch ? `Cannot find module: ${moduleMatch[1]}` : line,
        raw: line
      });
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // TYPE ERRORS (TypeScript / TypeScript inference)
    // ══════════════════════════════════════════════════════════════

    // Format: "Type 'X' is not assignable to type 'Y'"
    if (line.includes('is not assignable') || line.includes('Type ')) {
      errors.push({
        type: 'type_error',
        file: extractFilePath(lines, i),
        line: null,
        column: null,
        message: line,
        raw: line
      });
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // RUNTIME ERRORS
    // ══════════════════════════════════════════════════════════════

    // Format: "ReferenceError: X is not defined"
    if (
      line.includes('ReferenceError') ||
      line.includes('TypeError') ||
      line.includes('is not defined') ||
      line.includes('Cannot read property')
    ) {
      const runtimeMatch = line.match(/(?:ReferenceError|TypeError):\s*(.+?)(?:\s+at|$)/);
      errors.push({
        type: 'runtime_error',
        file: extractFilePath(lines, i),
        line: null,
        column: null,
        message: runtimeMatch ? runtimeMatch[1] : line,
        raw: line
      });
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // ESLINT / LINTING ERRORS
    // ══════════════════════════════════════════════════════════════

    // Format: "error  'useState' is not defined  no-undef"
    if (line.includes('error') && line.includes('is not defined')) {
      errors.push({
        type: 'lint_error',
        file: extractFilePath(lines, i),
        line: null,
        column: null,
        message: line,
        raw: line
      });
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // GENERIC ERROR PATTERNS
    // ══════════════════════════════════════════════════════════════

    if (line.trim().startsWith('error') || line.trim().startsWith('Error')) {
      errors.push({
        type: 'unknown_error',
        file: extractFilePath(lines, i),
        line: null,
        column: null,
        message: line,
        raw: line
      });
    }
  }

  return errors;
}

/**
 * Вытаскивает имя файла из контекста ошибки
 */
function extractFilePath(lines, currentIndex) {
  // Ищем в текущей строке
  const currentMatch = lines[currentIndex].match(/\/([^/]+\.(?:js|jsx|ts|tsx))/);
  if (currentMatch) {
    return currentMatch[1];
  }

  // Ищем в предыдущих строках
  for (let i = Math.max(0, currentIndex - 3); i < currentIndex; i++) {
    const match = lines[i].match(/([^/\s]+\.(?:js|jsx|ts|tsx))/);
    if (match) {
      return match[1];
    }
  }

  return 'unknown';
}

/**
 * Запускает цикл исправления ошибок
 *
 * @param {Object} params
 *   - initialFiles: текущие файлы проекта
 *   - generateFix: async функция для вызова LLM в FIX режиме
 *   - projectDir: путь к проекту (для exec)
 *   - maxIterations: макс кол-во попыток (default 3)
 *
 * @returns {Object} { success, finalFiles, errors, iterations }
 */
export async function runFixLoop({
  initialFiles,
  generateFix,
  projectDir = process.cwd(),
  maxIterations = 3
}) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔄 EXECUTION FIX LOOP STARTED (max ${maxIterations} iterations)`);
  console.log(`${'═'.repeat(70)}\n`);

  let currentFiles = { ...initialFiles };
  let iterationCount = 0;
  let lastErrors = [];

  for (iterationCount = 0; iterationCount < maxIterations; iterationCount++) {
    console.log(`\n📍 Iteration ${iterationCount + 1}/${maxIterations}`);
    console.log(`${'─'.repeat(70)}`);

    // ════════════════════════════════════════════════════════════════
    // ШАГ 0: Проверка структуры (runtime UI validation)
    // ════════════════════════════════════════════════════════════════

    const runtimeCheck = checkRuntimeUIStructure(currentFiles);
    let executionErrors = [];

    if (!runtimeCheck.isValid) {
      console.log(`⚠️  Runtime structure issues detected:`);
      runtimeCheck.errors.forEach(err => {
        console.log(`   ❌ ${err.message}`);
        executionErrors.push(err);
      });
    }

    // ════════════════════════════════════════════════════════════════
    // ШАГ 1: Запуск проекта (только если структура OK)
    // ════════════════════════════════════════════════════════════════

    if (executionErrors.length === 0) {
      const execution = runExecution(projectDir, 'build');
      const combinedOutput = execution.stdout + '\n' + execution.stderr;

      // ════════════════════════════════════════════════════════════════
      // ШАГ 2: Парсим ошибки из build
      // ════════════════════════════════════════════════════════════════

      executionErrors = parseExecutionErrors(combinedOutput);
    }

    console.log(`📋 Errors found: ${executionErrors.length}`);

    if (executionErrors.length === 0) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`✅ SUCCESS - All errors fixed!`);
      console.log(`${'═'.repeat(70)}\n`);

      return {
        success: true,
        finalFiles: currentFiles,
        errors: [],
        iterations: iterationCount
      };
    }

    // Логируем ошибки
    console.log(`\nErrors by type:`);
    const errorsByType = {};
    for (const err of executionErrors) {
      errorsByType[err.type] = (errorsByType[err.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(errorsByType)) {
      console.log(`  • ${type}: ${count}`);
    }

    lastErrors = executionErrors;

    // ════════════════════════════════════════════════════════════════
    // ШАГ 3: Если последняя итерация - выходим
    // ════════════════════════════════════════════════════════════════

    if (iterationCount === maxIterations - 1) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`❌ FAILED - Max iterations reached with ${executionErrors.length} errors`);
      console.log(`${'═'.repeat(70)}\n`);

      return {
        success: false,
        finalFiles: currentFiles,
        errors: executionErrors,
        iterations: iterationCount + 1
      };
    }

    // ════════════════════════════════════════════════════════════════
    // ШАГ 4: Вызываем LLM в FIX режиме
    // ════════════════════════════════════════════════════════════════

    console.log(`\n🤖 Calling LLM in FIX MODE...`);

    try {
      const fixResult = await generateFix({
        errors: executionErrors,
        affectedFiles: extractAffectedFiles(currentFiles, executionErrors),
        currentFiles: currentFiles,
        iteration: iterationCount
      });

      if (fixResult && fixResult.files) {
        currentFiles = { ...currentFiles, ...fixResult.files };
        console.log(`✏️  Files updated: ${Object.keys(fixResult.files).length}`);
      } else {
        console.warn(`⚠️  LLM returned no files to fix`);
      }
    } catch (error) {
      console.error(`❌ LLM call failed: ${error.message}`);
      return {
        success: false,
        finalFiles: currentFiles,
        errors: executionErrors,
        iterations: iterationCount + 1
      };
    }
  }

  // Не должны дойти сюда
  return {
    success: false,
    finalFiles: currentFiles,
    errors: lastErrors,
    iterations: maxIterations
  };
}

/**
 * Извлекает файлы, упомянутые в ошибках
 */
function extractAffectedFiles(allFiles, errors) {
  const affected = {};
  const affectedFileNames = new Set();

  for (const error of errors) {
    if (error.file) {
      affectedFileNames.add(error.file);
    }
  }

  for (const [filePath, content] of Object.entries(allFiles)) {
    for (const fileName of affectedFileNames) {
      if (filePath.includes(fileName)) {
        affected[filePath] = content;
        break;
      }
    }
  }

  return Object.keys(affected).length > 0 ? affected : allFiles;
}
