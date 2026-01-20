import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';

export async function POST(req) {
    const {prompt} = await req.json();
    try {
        const result = await GenAiCode.sendMessage(prompt);
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