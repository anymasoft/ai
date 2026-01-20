import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';

export async function POST(req) {
    const { prompt, currentFiles } = await req.json();
    try {
        // Встраиваем текущее состояние кода в промпт для контекста
        let enrichedPrompt = prompt;
        if (currentFiles && Object.keys(currentFiles).length > 0) {
            enrichedPrompt += "\n\n## ТЕКУЩЕЕ СОСТОЯНИЕ КОДА:\n\n";
            for (const [filePath, content] of Object.entries(currentFiles)) {
                const code = typeof content === 'string' ? content : (content.code || '');
                enrichedPrompt += `### Файл: ${filePath}\n\`\`\`jsx\n${code}\n\`\`\`\n\n`;
            }
        }

        const result = await GenAiCode.sendMessage(enrichedPrompt);
        let resp = result.response.text();

        // Парсим markdown код-блоки если они есть (совместимость с OpenAI)
        const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            resp = jsonMatch[1].trim();
        }

        return NextResponse.json(JSON.parse(resp));
    } catch(e) {
        return NextResponse.json({error: e.message || 'Code generation failed'}, {status: 500});
    }
}