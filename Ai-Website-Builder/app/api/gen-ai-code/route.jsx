import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';
import { buildUniversalContext } from '@/context/contextBuilder';
import { runFixLoop } from '@/context/executionEngine';
import { callLLMInFixMode } from '@/context/fixModeHandler';

export async function POST(req){
    const {
        targetFile,
        userMessage,
        messages = [],
        currentCode = {},
        mode = 'auto',
        conversationTurn = 1,
        enableFixLoop = false  // 🆕 НОВЫЙ параметр для включения execution fix loop
    } = await req.json();

    try{
        console.log(`📝 Запрос: targetFile=${targetFile}, mode=${mode}, turn=${conversationTurn}`);
        console.log(`   enableFixLoop=${enableFixLoop}`);

        // ════════════════════════════════════════════════════════════════
        // СОБИРАЕМ УНИВЕРСАЛЬНЫЙ КОНТЕКСТ (4 СЛОЯ)
        // ════════════════════════════════════════════════════════════════

        const contextPayload = await buildUniversalContext({
            targetFile,
            userRequest: userMessage,
            messages,
            files: currentCode,
            mode,
            conversationTurn
        });

        const detectedMode = contextPayload.metadata.mode;

        // ════════════════════════════════════════════════════════════════
        // ФОРМАТИРУЕМ КОНТЕКСТ В ПРОМПТ ДЛЯ LLM
        // ════════════════════════════════════════════════════════════════

        let fullContext = formatContextAsPrompt(contextPayload, detectedMode);

        // Логируем размер контекста
        const contextSizeKB = (fullContext.length / 1024).toFixed(2);
        const estimatedTokens = Math.ceil(fullContext.length / 4);

        console.log(`📊 Размер контекста: ${contextSizeKB} KB (~${estimatedTokens} токенов)`);
        console.log(`🔧 Режим: ${detectedMode}`);

        if(estimatedTokens > 50000) {
            console.warn(`   ⚠️  Контекст большой (${estimatedTokens} из 128K доступных)`);
        }

        // ════════════════════════════════════════════════════════════════
        // ОТПРАВЛЯЕМ В LLM
        // ════════════════════════════════════════════════════════════════

        const result = await GenAiCode.sendMessage(fullContext);
        let resp = result.response.text();

        console.log("✅ Ответ от AI:", resp.substring(0, 150) + "...");

        // Парсим markdown код-блоки если они есть
        const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            resp = jsonMatch[1].trim();
            console.log("📄 Извлечен JSON из markdown");
        }

        const parsedData = JSON.parse(resp);
        console.log("📦 Распарсенные файлы:", Object.keys(parsedData.files || {}));

        // ════════════════════════════════════════════════════════════════
        // ЗАЩИТА СТРУКТУРНЫХ ФАЙЛОВ (index.js, index.html, App.css)
        // ════════════════════════════════════════════════════════════════

        // Если LLM вернул эти файлы, проверяем что они корректны
        // Если нет - игнорируем и используем дефолт
        const structuralFiles = ['index.js', '/index.js', 'index.html', '/public/index.html', 'App.css', '/App.css'];

        if (parsedData.files) {
            for (const file of structuralFiles) {
                if (parsedData.files[file]) {
                    const code = typeof parsedData.files[file] === 'string'
                        ? parsedData.files[file]
                        : parsedData.files[file].code;

                    // Проверяем что index.js содержит React.createRoot
                    if (file === '/index.js' || file === 'index.js') {
                        if (!code.includes('createRoot') && !code.includes('ReactDOM.render')) {
                            console.warn(`⚠️  ${file} corrupted (no React mount). Removing from response.`);
                            delete parsedData.files[file];
                        }
                    }

                    // Проверяем что index.html содержит root div
                    if (file === '/public/index.html' || file === 'index.html') {
                        if (!code.includes('id="root"')) {
                            console.warn(`⚠️  ${file} corrupted (no root div). Removing from response.`);
                            delete parsedData.files[file];
                        }
                    }
                }
            }
        }

        // Проверяем App.js - должен иметь return statement
        const appFile = parsedData.files && (parsedData.files['/App.js'] || parsedData.files['App.js']);
        if (appFile) {
            const appCode = typeof appFile === 'string' ? appFile : appFile.code;

            // Проверяем что App имеет return statement и не просто пусто
            if (!appCode.includes('return') || appCode.trim().endsWith('}') && !appCode.includes('return (') && !appCode.includes('return <')) {
                console.warn(`⚠️  App.js may return null/undefined. Flagging for fix loop.`);
                // Не удаляем, но отмечаем для fix loop ниже
            }
        }

        let finalData = parsedData;

        // ════════════════════════════════════════════════════════════════
        // 🆕 EXECUTION FIX LOOP (если включен)
        // ════════════════════════════════════════════════════════════════

        if (enableFixLoop && process.env.NODE_ENV === 'development') {
            console.log(`\n${'═'.repeat(70)}`);
            console.log(`🔄 EXECUTION FIX LOOP ENABLED`);
            console.log(`${'═'.repeat(70)}`);

            try {
                const fixLoopResult = await runFixLoop({
                    initialFiles: parsedData.files || {},
                    callLLMInFixMode: callLLMInFixMode,
                    projectDir: process.cwd(),
                    maxIterations: 5
                });

                if (fixLoopResult.success) {
                    console.log(`✅ Fix loop completed successfully`);
                    finalData.files = fixLoopResult.finalFiles;
                    finalData.fixLoopResult = {
                        success: true,
                        iterations: fixLoopResult.iterations,
                        errors: []
                    };
                } else {
                    console.warn(`⚠️  Fix loop failed after ${fixLoopResult.iterations} iterations`);
                    finalData.files = fixLoopResult.finalFiles;
                    finalData.fixLoopResult = {
                        success: false,
                        iterations: fixLoopResult.iterations,
                        errors: fixLoopResult.errors
                    };
                }
            } catch (fixError) {
                console.error(`❌ Fix loop error: ${fixError.message}`);
                finalData.fixLoopResult = {
                    success: false,
                    error: fixError.message
                };
            }
        }

        return NextResponse.json(finalData);
    }catch(e){
        console.error("❌ Ошибка:", e.message);
        console.error("   Stack:", e.stack);
        return NextResponse.json({error:e.message});
    }
}

// ════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ════════════════════════════════════════════════════════════════

/**
 * Форматирует структурированный контекст в текстовый промпт для LLM
 */
function formatContextAsPrompt(contextPayload, mode) {
  const { layers, metadata, conversationContext } = contextPayload;
  let prompt = '';

  // МЕТА-ИНФОРМАЦИЯ
  prompt += `=== CONTEXT METADATA ===\n`;
  prompt += `Mode: ${mode}\n`;
  prompt += `Turn: ${metadata.conversationTurn}\n`;
  prompt += `Target: ${metadata.targetFile}\n`;
  prompt += `Request: ${metadata.userRequest}\n\n`;

  // СЛОЙ 1: TARGET FRAGMENT
  prompt += `=== LAYER 1: TARGET FRAGMENT ===\n`;
  const layer1 = layers.layer1_target;

  if (mode === 'template_filling') {
    prompt += `Template File: ${layer1.templateFile}\n`;
    prompt += `Total Slots: ${layer1.slotCount}\n\n`;

    for (const slot of layer1.slots) {
      prompt += `SLOT: ${slot.id}\n`;
      if (slot.maxLength) prompt += `Max Length: ${slot.maxLength}\n`;
      if (slot.context) prompt += `Context: ${slot.context}\n`;
      prompt += `Current: "${slot.currentContent}"\n\n`;
    }

    prompt += `FULL TEMPLATE CODE:\n\`\`\`jsx\n${layer1.fullTemplateCode}\n\`\`\`\n\n`;
  } else {
    // fragment_editing
    prompt += `Target File: ${layer1.targetFile}\n`;
    prompt += `Slot Markers: ${layer1.slotMarkers.join(', ')}\n\n`;
    prompt += `FULL COMPONENT CODE:\n\`\`\`jsx\n${layer1.fullContent}\n\`\`\`\n\n`;
  }

  // СЛОЙ 2: DEPENDENCIES (если есть)
  if (layers.layer2_dependencies && layers.layer2_dependencies.length > 0) {
    prompt += `=== LAYER 2: LOCAL DEPENDENCIES ===\n`;
    for (const dep of layers.layer2_dependencies) {
      prompt += `\nFile: ${dep.file}\n`;
      prompt += `\`\`\`\n${dep.content}\n\`\`\`\n`;
    }
    prompt += '\n';
  }

  // СЛОЙ 3: PROJECT CONTRACT
  prompt += `=== LAYER 3: PROJECT CONTRACT ===\n`;
  prompt += layers.layer3_projectContract.content;
  prompt += '\n\n';

  // СЛОЙ 4: CHANGE SCOPE
  prompt += `=== LAYER 4: CHANGE SCOPE DECLARATION ===\n`;
  const layer4 = layers.layer4_changeScope;
  prompt += `Mode: ${layer4.mode}\n`;
  prompt += `Description: ${layer4.description}\n\n`;

  prompt += `Allowed Operations:\n`;
  for (const op of layer4.allowedOperations) {
    prompt += `✓ ${op}\n`;
  }

  prompt += `\nForbidden Operations:\n`;
  for (const op of layer4.forbiddenOperations) {
    prompt += `✗ ${op}\n`;
  }

  if (layer4.preserveSlots !== undefined) {
    prompt += `\n⚠️  CRITICAL: Preserve all slot markers (data-slot="...")\n`;
  }

  prompt += '\n\n';

  // ИСТОРИЯ СООБЩЕНИЙ
  if (conversationContext.recentMessages && conversationContext.recentMessages.length > 0) {
    prompt += `=== CONVERSATION CONTEXT ===\n`;
    for (const msg of conversationContext.recentMessages) {
      prompt += `${msg.role === 'user' ? '👤 User' : '🤖 Assistant'}: ${msg.content}\n\n`;
    }
  }

  // ИНСТРУКЦИИ ДЛЯ ОТВЕТА
  prompt += `=== RESPONSE FORMAT ===\n`;
  if (mode === 'template_filling') {
    prompt += `{
  "mode": "template_filling",
  "explanation": "...",
  "files": {
    "${metadata.targetFile}": { "code": "[COMPLETE UPDATED TEMPLATE]" }
  }
}`;
  } else {
    prompt += `{
  "mode": "fragment_editing",
  "explanation": "...",
  "files": {
    "${metadata.targetFile}": { "code": "[COMPLETE UPDATED COMPONENT]" },
    ...all other files unchanged...
  }
}`;
  }

  prompt += '\n\n';

  // НОВЫЙ ЗАПРОС
  prompt += `=== NEW REQUEST ===\n${metadata.userRequest}\n`;

  return prompt;
}