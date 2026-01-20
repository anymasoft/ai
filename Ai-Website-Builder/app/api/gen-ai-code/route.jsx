import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';

export async function POST(req) {
    const { prompt, currentFiles } = await req.json();
    try {
        // Определяем какой промпт использовать
        // Если есть текущие файлы - это обновление существующего проекта
        const isUpdate = currentFiles && Object.keys(currentFiles).length > 0;
        const basePrompt = isUpdate ? Prompt.CONTEXT_UPDATE_PROMPT : Prompt.CODE_GEN_PROMPT;

        console.log(`📝 Mode: ${isUpdate ? 'UPDATE' : 'NEW'}, Files: ${Object.keys(currentFiles || {}).length}`);

        // Встраиваем текущее состояние кода в промпт для контекста
        let enrichedPrompt = basePrompt + "\n\n" + prompt;
        if (currentFiles && Object.keys(currentFiles).length > 0) {
            enrichedPrompt += "\n\n## ТЕКУЩЕЕ СОСТОЯНИЕ КОДА:\n\n";
            for (const [filePath, content] of Object.entries(currentFiles)) {
                const code = typeof content === 'string' ? content : (content.code || '');
                enrichedPrompt += `### Файл: ${filePath}\n\`\`\`jsx\n${code}\n\`\`\`\n\n`;
            }
        }

        console.log(`📤 Sending to AI (${enrichedPrompt.length} chars)`);
        const result = await GenAiCode.sendMessage(enrichedPrompt);
        let resp = result.response.text();

        console.log(`✅ AI Response (${resp.length} chars): ${resp.substring(0, 100)}...`);

        // Парсим markdown код-блоки если они есть (совместимость с OpenAI)
        const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            resp = jsonMatch[1].trim();
            console.log(`📦 Extracted JSON from markdown`);
        }

        const parsed = JSON.parse(resp);
        console.log(`✅ Response parsed, files: ${Object.keys(parsed.files || {}).length}`);
        return NextResponse.json(parsed);
    } catch(e) {
        console.error(`❌ Error: ${e.message}`);
        return NextResponse.json({error: e.message || 'Code generation failed'}, {status: 500});
    }
}