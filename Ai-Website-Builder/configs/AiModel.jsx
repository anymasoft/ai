const OpenAI = require("openai").default;

const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const modelName = process.env.NEXT_PUBLIC_OPENAI_MODEL || "gpt-4o-mini";
const client = new OpenAI({ apiKey });

// Класс совместимости с Gemini API
class ChatSession {
    constructor(model, config, systemPrompt = null) {
        this.model = model;
        this.config = config;
        this.systemPrompt = systemPrompt;
        this.history = [];
    }

    async sendMessage(message) {
        // Добавляем сообщение в историю
        this.history.push({ role: "user", content: message });

        // Подготавливаем сообщения для OpenAI
        const messages = [];

        if (this.systemPrompt) {
            messages.push({ role: "system", content: this.systemPrompt });
        }

        messages.push(...this.history);

        // Вызываем OpenAI API
        const response = await client.chat.completions.create({
            model: this.model,
            messages: messages,
            temperature: this.config.temperature,
            top_p: this.config.topP,
            max_tokens: this.config.maxOutputTokens,
        });

        const assistantMessage = response.choices[0].message.content;

        // Добавляем ответ в историю
        this.history.push({ role: "assistant", content: assistantMessage });

        // Возвращаем в формате совместимом с Gemini API
        return {
            response: {
                text: () => assistantMessage
            }
        };
    }
}

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    maxOutputTokens: 8192,
};

const CodeGenerationConfig = {
    temperature: 1,
    topP: 0.95,
    maxOutputTokens: 10192,
};

const EnhancePromptConfig = {
    temperature: 0.7,
    topP: 0.8,
    maxOutputTokens: 1000,
};

const codeGenSystemPrompt = `You are an expert React developer. Generate a complete React project with proper structure. Return the response in JSON format with the following schema:
{
  "projectTitle": "",
  "explanation": "",
  "files": {
    "/App.js": {
      "code": ""
    },
    ...
  },
  "generatedFiles": []
}

Guidelines:
- Use Tailwind CSS for styling
- Add Emoji icons whenever needed
- The lucide-react library is available to be imported IF NECESSARY
- Create multiple components in a folder structure
- Ensure the files field contains all created files
- Include an explanation of the project's structure and purpose`;

export const chatSession = new ChatSession(modelName, generationConfig);

export const GenAiCode = new ChatSession(modelName, CodeGenerationConfig, codeGenSystemPrompt);

export const enhancePromptSession = new ChatSession(modelName, EnhancePromptConfig);
