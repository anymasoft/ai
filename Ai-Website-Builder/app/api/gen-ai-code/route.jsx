import { NextResponse } from "next/server";
import { GenAiCode } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';

export async function POST(req){
    const {messages, currentCode, userMessage}=await req.json();
    try{
        // Формируем контекст с историей, текущим кодом и новым запросом
        let fullContext = "";

        // Добавляем историю сообщений для контекста (последние 5 сообщений для оптимизации)
        if(messages && messages.length > 0) {
            const recentMessages = messages.slice(-5);  // Берём последние 5 сообщений (экономия токенов)
            fullContext += "=== ИСТОРИЯ ЗАПРОСОВ ===\n";
            recentMessages.forEach((msg, idx) => {
                fullContext += `${msg.role === 'user' ? '👤' : '🤖'} ${msg.content}\n`;
            });
            fullContext += "\n";
        }

        // Добавляем ПОЛНЫЙ текущий сгенерированный код
        if(currentCode && Object.keys(currentCode).length > 0) {
            fullContext += "=== ТЕКУЩИЙ КОД ПРОЕКТА ===\n";
            Object.entries(currentCode).forEach(([filename, content]) => {
                if(filename !== '/App.css' && filename !== '/index.css') {  // Пропускаем CSS файлы для краткости
                    const fileContent = typeof content === 'string' ? content : content.code;
                    // ИЗМЕНЕНО: отправляем ПОЛНЫЙ код файла вместо первых 500 символов
                    fullContext += `\n📄 ${filename}:\n\`\`\`\n${fileContent}\n\`\`\`\n`;
                }
            });
            fullContext += "\n";
        }

        // Добавляем новый запрос пользователя
        fullContext += `=== НОВЫЙ ЗАПРОС ===\n${userMessage}\n\n`;

        // Добавляем инструкции для incrementальных обновлений
        fullContext += Prompt.CONTEXT_UPDATE_PROMPT;

        // Логируем размер контекста с предупреждением если слишком большой
        const contextSizeKB = (fullContext.length / 1024).toFixed(2);
        const estimatedTokens = Math.ceil(fullContext.length / 4);

        console.log("📝 Полный контекст отправлен в AI");
        console.log(`   Размер: ${contextSizeKB} KB (~${estimatedTokens} токенов)`);

        if(estimatedTokens > 50000) {
            console.warn(`   ⚠️  ВНИМАНИЕ: Контекст большой (${estimatedTokens} токенов из 128K доступных)`);
        }

        const result=await GenAiCode.sendMessage(fullContext);
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