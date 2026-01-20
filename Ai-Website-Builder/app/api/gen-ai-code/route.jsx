import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';

export async function POST(req){
    const {prompt}=await req.json();
    try{
        console.log("📝 Промпт отправлен в AI:", prompt.substring(0, 100) + "...");

        const result=await GenAiCode.sendMessage(prompt);
        let resp=result.response.text();

        console.log("✅ Ответ от AI:", resp.substring(0, 200) + "...");

        // Парсим markdown код-блоки если они есть
        const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            resp = jsonMatch[1].trim();
            console.log("📄 Извлечен JSON из markdown");
        }

        const parsedData = JSON.parse(resp);
        console.log("📦 Распарсенные файлы:", Object.keys(parsedData.files || {}));

        return NextResponse.json(parsedData);
    }catch(e){
        console.error("❌ Ошибка:", e.message);
        console.error("   Stack:", e.stack);
        return NextResponse.json({error:e.message});
    }
}