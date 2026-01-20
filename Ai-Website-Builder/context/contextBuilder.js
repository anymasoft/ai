/**
 * Context Builder - собирает универсальный контекст для LLM в 4 слоях
 * Поддерживает оба режима: template_filling и fragment_editing
 */

import {
  extractSlots,
  extractSlotMarkers,
  detectMode,
  validateSlotIntegrity
} from './slotParser.js';

/**
 * ГЛАВНАЯ ФУНКЦИЯ: строит универсальный контекст для LLM
 *
 * @param {Object} request - Запрос с параметрами
 *   - targetFile: путь к файлу/компоненту
 *   - userRequest: текст запроса пользователя
 *   - messages: история сообщений
 *   - files: объект всех файлов проекта
 *   - mode: явный режим ('template_filling' | 'fragment_editing' | 'auto')
 *   - conversationTurn: номер в диалоге (для авто-определения режима)
 *
 * @returns {Object} Собранный контекст с 4 слоями
 */
export async function buildUniversalContext(request) {
  const {
    targetFile,
    userRequest,
    messages = [],
    files = {},
    mode = 'auto',
    conversationTurn = 1
  } = request;

  // Определяем режим (если 'auto', то авто-детект)
  const detectedMode = mode === 'auto'
    ? detectMode(targetFile, files, conversationTurn)
    : mode;

  console.log(`🔧 Building context in mode: ${detectedMode} (turn: ${conversationTurn})`);

  // ════════════════════════════════════════════════════════════════
  // СЛОЙ 1: TARGET FRAGMENT (АДАПТИВНЫЙ)
  // ════════════════════════════════════════════════════════════════

  let layer1 = await buildLayer1Target(targetFile, files, detectedMode);

  // ════════════════════════════════════════════════════════════════
  // СЛОЙ 2: LOCAL DEPENDENCIES (УСЛОВНЫЙ)
  // ════════════════════════════════════════════════════════════════

  let layer2 = [];
  if (detectedMode === 'fragment_editing') {
    // Только для fragment_editing нужны зависимости
    layer2 = await buildLayer2Dependencies(targetFile, files);
  }
  // Для template_filling layer2 остаётся пустым

  // ════════════════════════════════════════════════════════════════
  // СЛОЙ 3: PROJECT CONTRACT (НЕИЗМЕННЫЙ)
  // ════════════════════════════════════════════════════════════════

  const layer3 = buildLayer3ProjectContract();

  // ════════════════════════════════════════════════════════════════
  // СЛОЙ 4: CHANGE SCOPE DECLARATION (РЕЖИМ-ЗАВИСИМЫЙ)
  // ════════════════════════════════════════════════════════════════

  const layer4 = buildLayer4ChangeScope(detectedMode, targetFile, layer1);

  // ════════════════════════════════════════════════════════════════
  // СОБИРАЕМ ФИНАЛЬНЫЙ PAYLOAD
  // ════════════════════════════════════════════════════════════════

  const payload = {
    metadata: {
      timestamp: new Date().toISOString(),
      mode: detectedMode,
      conversationTurn,
      targetFile,
      userRequest: userRequest.substring(0, 100) + (userRequest.length > 100 ? '...' : '')
    },

    layers: {
      layer1_target: layer1,
      layer2_dependencies: layer2,
      layer3_projectContract: layer3,
      layer4_changeScope: layer4
    },

    conversationContext: {
      recentMessages: messages.slice(-3)
    }
  };

  console.log(`✅ Context built. Size: ${JSON.stringify(payload).length} bytes`);

  return payload;
}

/**
 * СЛОЙ 1: TARGET FRAGMENT (адаптивный в зависимости от режима)
 */
async function buildLayer1Target(targetFile, files, mode) {
  const fileContent = files[targetFile];
  if (!fileContent) {
    throw new Error(`File not found: ${targetFile}`);
  }

  const code = typeof fileContent === 'string' ? fileContent : fileContent.code;

  if (mode === 'template_filling') {
    // Режим 1: Template Filling - парсим слоты
    const slots = extractSlots(code);

    return {
      mode: 'template_filling',
      templateFile: targetFile,
      slots: slots.map(slot => ({
        id: slot.id,
        maxLength: slot.maxLength,
        context: slot.context,
        currentContent: slot.currentContent
      })),
      slotCount: slots.length,
      fullTemplateCode: code
    };
  } else {
    // Режим 2: Fragment Editing - берём маркеры для защиты
    const slotMarkers = extractSlotMarkers(code);

    return {
      mode: 'fragment_editing',
      targetFile: targetFile,
      fullContent: code,
      slotMarkers: slotMarkers,  // Для валидации после редактирования
      slotCount: slotMarkers.length
    };
  }
}

/**
 * СЛОЙ 2: LOCAL DEPENDENCIES (только для fragment_editing)
 */
async function buildLayer2Dependencies(targetFile, files) {
  // Простой парсер импортов (достаточно для MVP)
  const imports = parseImports(files[targetFile]);
  const localImports = imports.filter(imp =>
    imp.source.startsWith('.') || imp.source.startsWith('@/')
  );

  const dependencies = [];

  // Ограничиваем до 5 зависимостей
  for (const imp of localImports.slice(0, 5)) {
    const resolvedPath = resolveImportPath(imp.source, targetFile);
    if (files[resolvedPath]) {
      const depContent = files[resolvedPath];
      const code = typeof depContent === 'string' ? depContent : depContent.code;

      dependencies.push({
        file: resolvedPath,
        type: 'interface',
        content: extractPublicAPI(code)
      });
    }
  }

  return dependencies;
}

/**
 * СЛОЙ 3: PROJECT CONTRACT (неизменный, переиспользуемый)
 */
function buildLayer3ProjectContract() {
  // Импортируем PROJECT_CONTRACT из отдельного файла
  // Это гарантирует что контракт всегда одинаковый
  const { PROJECT_CONTRACT } = require('@/data/ProjectContract');

  return {
    version: '2.0',
    applies_to: ['template_filling', 'fragment_editing'],
    content: PROJECT_CONTRACT
  };
}

/**
 * СЛОЙ 4: CHANGE SCOPE DECLARATION (режим-зависимый)
 */
function buildLayer4ChangeScope(mode, targetFile, layer1) {
  if (mode === 'template_filling') {
    return {
      mode: 'template_filling',
      description: 'Fill template slots with content only',

      allowedOperations: [
        'fill_slots',
        'localize_content',
        'optimize_text_length',
        'adjust_phrasing'
      ],

      forbiddenOperations: [
        'change_html_structure',
        'modify_classnames',
        'add_new_elements',
        'remove_elements',
        'change_styling',
        'add_imports',
        'create_files'
      ],

      targetSlots: layer1.slots.map(s => s.id),
      slotProtection: 'immutable_structure',

      constraints: {
        maxRequestsInMode: 3,  // Обычно 1-3 запроса на заполнение
        allowStructureChange: false,
        allowNewComponents: false
      }
    };
  } else {
    // fragment_editing
    return {
      mode: 'fragment_editing',
      description: 'Edit component incrementally, preserve slots',

      allowedOperations: [
        'modify_classnames',
        'change_tailwind_utilities',
        'update_internal_logic',
        'adjust_component_state',
        'change_prop_defaults'
      ],

      forbiddenOperations: [
        'remove_slot_markers',
        'change_slot_content',
        'restructure_html',
        'add_new_elements_outside_structure',
        'remove_elements',
        'break_component_contract',
        'add_new_packages'
      ],

      allowedFiles: [targetFile],
      protectedMarkers: [
        'data-slot',
        'data-max-length',
        'data-context'
      ],
      preserveSlots: true,

      constraints: {
        allowStructureChange: false,
        allowNewComponents: false,
        requiresPreservingSlots: true
      }
    };
  }
}

// ════════════════════════════════════════════════════════════════
// УТИЛИТЫ (простые версии для MVP)
// ════════════════════════════════════════════════════════════════

/**
 * Парсит импорты из JSX кода
 */
function parseImports(fileContent) {
  const code = typeof fileContent === 'string' ? fileContent : fileContent.code;
  const imports = [];

  // Ищем import statements
  const importPattern = /import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importPattern.exec(code)) !== null) {
    imports.push({
      source: match[1]
    });
  }

  return imports;
}

/**
 * Разрешает импорт в абсолютный путь
 */
function resolveImportPath(importSource, currentFile) {
  // Простая версия: @/ → /, ./ → соседний файл
  if (importSource.startsWith('@/')) {
    return importSource.replace('@/', '/');
  }
  if (importSource.startsWith('./')) {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    return dir + '/' + importSource.substring(2);
  }
  return importSource;
}

/**
 * Извлекает публичный API компонента/функции
 * Для dependencies слоя
 */
function extractPublicAPI(code) {
  const lines = code.split('\n');
  const publicAPI = [];

  for (const line of lines) {
    // Ищем export statements и JSDoc
    if (line.includes('export function') || line.includes('export const')) {
      publicAPI.push(line.trim());
    }
    if (line.includes('@param') || line.includes('@returns')) {
      publicAPI.push(line.trim());
    }
  }

  return publicAPI.length > 0 ? publicAPI.join('\n') : 'No public API found';
}
