import openai
from config import get_setting

OPENAI_KEY = get_setting("openai.api_key")
if OPENAI_KEY:
    openai.api_key = OPENAI_KEY

async def analyze_lead_text(text: str) -> dict:
    if not OPENAI_KEY:
        return {"is_lead": True, "confidence": 0.8, "reason": "GPT отключён", "intent": "unknown", "urgency": "средняя"}
    
    prompt = """
Ты — эксперт по лидогенерации в B2B и B2C. Проанализируй сообщение из Telegram и определи:

1. Является ли это запросом на услугу (например, "ищу дизайнера", "нужен юрист")?
2. Есть ли намерение нанять или купить?
3. Не является ли сообщение рекламой или обсуждением?

Ответь ТОЛЬКО в формате JSON:
{
  "is_lead": true/false,
  "confidence": 0.0–1.0,
  "reason": "краткая причина (1–2 предложения)",
  "intent": "покупка/аренда/консультация/иное",
  "urgency": "низкая/средняя/высокая"
}

Сообщение:
\"\"\"{text}\"\"\"
""".strip().format(text=text)

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200
        )
        content = response.choices[0].message.content.strip()
        return eval(content)
    except Exception as e:
        print(f"❌ GPT ошибка: {e}")
        return {"is_lead": True, "confidence": 0.5, "reason": "Ошибка GPT", "intent": "unknown", "urgency": "средняя"}