import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';

export async function POST(req){
    const {prompt}=await req.json();
    try{
        console.log("📝 Промпт отправлен в AI:", prompt.substring(0, 100) + "...");

        const result=await GenAiCode.sendMessage(prompt);
        const resp=result.response.text();

        console.log("✅ Ответ от AI:", resp.substring(0, 200) + "...");

        const parsedData = JSON.parse(resp);
        console.log("📦 Распарсенные файлы:", Object.keys(parsedData.files || {}));

        return NextResponse.json(parsedData);
    }catch(e){
        console.error("❌ Ошибка:", e.message);
        return NextResponse.json({error:e.message});
    }
}