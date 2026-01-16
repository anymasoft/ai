"""
Smart Prompt Enhancer - Фаза 1 обработки промптов
Улучшение промптов через GPT-4o-mini + обнаружение PRESERVE constraints

========================================================
ЦЕНТРАЛИЗОВАННОЕ ХРАНИЛИЩЕ ВСЕХ СИСТЕМНЫХ ПРОМПТОВ GPT
========================================================

Этот модуль содержит ВСЕ системные промпты для взаимодействия с OpenAI GPT.
Все остальные модули должны импортировать промпты отсюда и использовать их.
Это обеспечивает централизованное управление поведением GPT.
"""

import os
import re
import asyncio
from typing import Dict, Tuple
from openai import AsyncOpenAI

# Отложенная инициализация OpenAI клиента
client = None

def _get_client():
    """Получить OpenAI клиент (ленивая инициализация)"""
    global client
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "[PROMPT-ENHANCER] ❌ ОШИБКА: OPENAI_API_KEY не установлен!\n"
                "Убедитесь что .env файл находится в ai/nexus_bot/ и содержит OPENAI_API_KEY=sk-..."
            )
        client = AsyncOpenAI(api_key=api_key)
    return client

# ========================================================
# СИСТЕМНЫЕ ПРОМПТЫ ДЛЯ GPT
# ========================================================
# ВСЕ системные промпты находятся здесь и нигде больше!
# ========================================================

# -------- ПРОМПТ 1: PROMPT MODE ENHANCEMENT --------
# Используется для улучшения видео-промптов в режиме PROMPT
# (максимум cinematic движения и деталей для камеры)


SYSTEM_PROMPT_ENHANCER = """

You are a STRICT RU→EN translator for a video generation prompt.

Goal:
Translate the user's Russian prompt into English as literally as possible.
Do NOT add, infer, expand, or improve anything.
Do NOT add new objects, actions, scenery, style, lighting, mood, sound, or "cinematic" words.

ABSOLUTE RULES
1) Translation only: keep meaning and intent identical.
2) No creative additions. If the user did not specify something, do not mention it.
3) Keep sentences short and direct.
4) Preserve the user's structure and order (line breaks if any).
5) Output ONLY the final English prompt. No explanations, no lists, no extra labels.

CAMERA COMMAND TRANSLATION (RU → [Command])
If the Russian text contains any of the following camera instructions (exact or close phrasing),
you MUST convert them to the corresponding bracket command:

- "[камера статична]" / "[камера неподвижна]" / "[статичная камера]"  → [Static shot]
- "[поворот камеры влево]" / "[панорама влево]"                     → [Pan left]
- "[поворот камеры вправо]" / "[панорама вправо]"                   → [Pan right]
- "[смещение камеры влево]" / "[камера едет влево]"                 → [Truck left]
- "[смещение камеры вправо]" / "[камера едет вправо]"               → [Truck right]
- "[приближение камеры]" / "[камера приближается]"                  → [Push in]
- "[отдаление камеры]" / "[камера отъезжает]"                       → [Pull out]
- "[камера вверх]" / "[подъём камеры]"                              → [Pedestal up]
- "[камера вниз]" / "[опускание камеры]"                            → [Pedestal down]
- "[наклон камеры вверх]"                                         → [Tilt up]
- "[наклон камеры вниз]"                                          → [Tilt down]
- "[зум приближение]" / "[увеличение (зум)]"                        → [Zoom in]
- "[зум отдаление]" / "[уменьшение (зум)]"                          → [Zoom out]
- "[тряска камеры]"                                               → [Shake]
- "[камера следует за объектом]" / "[следящая камера]"              → [Tracking shot]

COMBINED / SEQUENTIAL CAMERA MOVES
- If the user writes combined moves in Russian like:
  "Поворот камеры влево + Камера вверх"
  then output ONE combined command:
  [Pan left,Pedestal up]
- If the user writes sequential moves like:
  "Сначала приближение камеры, потом отдаление камеры"
  then output in sequence:
  [Push in], then [Pull out]
- Do NOT output more than 3 commands in one combined bracket.
- Do NOT invent camera movement. If no camera instruction exists, do not add any camera command.

TEXT / OVERLAY PRESERVATION
If the user says any of these meanings:
- "текст не изменяется" / "надпись не меняется" / "логотип не меняется" / "цена не меняется"
translate them literally (e.g., "The text in the foreground does not change.") without adding extra constraints.

IMPORTANT:
The user might mention "background", "text", "banner", "price", "logo", "overlay" etc.
Translate only what is written. Do not add any preservation tags or extra syntax.

Now translate the user's Russian prompt.

"""

# -------- КОМПОНЕНТ: PRESERVATION RULES --------
# Критические инструкции для сохранения элементов дизайна
# Динамически генерируется на основе keywords

PRESERVATION_RULES_TEMPLATE = """
⚠️ CRITICAL PRESERVATION CONTRACT

Preserved elements: {keywords}

Hard rules:
1. Preserved elements MUST NOT be modified, moved, blurred, replaced, or animated.
2. If "background" is preserved, the background must remain completely unchanged.
3. No particles, no light effects, no motion, no distortion on preserved elements.
4. The subject (person or product) may move, but preserved elements must stay visually identical.
5. If background is preserved, ALL background must be static.
"""


# -------- ПРОМПТ 3: CAMERA DIRECTOR --------
# Используется для добавления camera movement commands через GPT
# Добавляет cinematic движения камеры в видео-промпт


SYSTEM_PROMPT_CAMERA_DIRECTOR = """
You are a camera command compiler for MiniMax.

Your job is to output camera movement commands ONLY when they are explicitly requested in the scene description.

Allowed commands:
[Truck left], [Truck right]
[Pan left], [Pan right]
[Push in], [Pull out]
[Pedestal up], [Pedestal down]
[Tilt up], [Tilt down]
[Zoom in], [Zoom out]
[Shake], [Tracking shot], [Static shot]

Rules:
1) If the scene explicitly mentions camera movement, output ONLY the commands that match those movements.
2) If the scene says the camera is static OR does not mention camera movement at all, output ONLY:
[Static shot]
3) Never invent camera movement.
4) Never output more than 2 commands.
5) Output one command per line.
6) Output ONLY the commands. No explanations. No extra text.

Examples:

Input:
"The camera slowly zooms in on her face."
Output:
[Zoom in]

Input:
"The camera is static."
Output:
[Static shot]

Input:
"A woman is smiling at the camera."
Output:
[Static shot]
"""


class PromptEnhancer:
    """Энхансер промптов для видео-генерации"""

    def __init__(self):
        self.model = "gpt-4o-mini"
        self.max_retries = 3
        self.timeout = 10  # сек

    # ============ DETECTION PHASE ============

    def _detect_preserve_constraints(self, prompt: str) -> Tuple[bool, str, list]:
        """
        Обнаруживает PRESERVE constraints в промпте
        Возвращает: (has_preserve, preserve_block, keywords)

        Keywords: text, background, banner, price, overlay, typography, label, caption
        """
        preserve_pattern = r'(?:PRESERVE|preserve):\s*([^\n]+)'
        match = re.search(preserve_pattern, prompt)

        if not match:
            return False, "", []

        preserve_block = match.group(1).strip()
        keywords = [kw.strip() for kw in preserve_block.split(",")]

        print(f"[PROMPT-ENHANCER] Detected PRESERVE: {preserve_block}")
        return True, preserve_block, keywords

    def _get_preservation_rules(self, keywords: list) -> str:
        return PRESERVATION_RULES_TEMPLATE.format(keywords=', '.join(keywords))

    # ============ ENHANCEMENT PHASE ============

    async def enhance_prompt(self, prompt: str) -> str:
        # STEP 1: send RAW user text to GPT (it must decide PRESERVE)
        system_message = SYSTEM_PROMPT_ENHANCER.format(preservation_rules="")
        user_message = prompt

        try:
            response = await asyncio.wait_for(
                self._call_openai(system_message, user_message),
                timeout=self.timeout,
            )
            gpt_output = response.strip()

        except Exception as e:
            print(f"[PROMPT-ENHANCER] GPT error: {str(e)}")
            return prompt

        # STEP 2: extract PRESERVE from GPT output
        has_preserve, preserve_block, keywords = self._detect_preserve_constraints(gpt_output)

        # STEP 3: remove PRESERVE line from main prompt
        prompt_clean = re.sub(r'(?:PRESERVE|preserve):[^\n]+', '', gpt_output).strip()

        # STEP 4: apply preservation rules
        preservation_rules = self._get_preservation_rules(keywords) if has_preserve else ""

        # STEP 5: re-run GPT with enforced preservation rules
        system_message = SYSTEM_PROMPT_ENHANCER.format(preservation_rules=preservation_rules)
        user_message = prompt_clean

        try:
            response = await asyncio.wait_for(
                self._call_openai(system_message, user_message),
                timeout=self.timeout,
            )
            final_prompt = response.strip()

            if has_preserve:
                final_prompt += f"\n\nNO_GENERATION: {preserve_block}"

            print(f"[PROMPT-ENHANCER] Prompt enhanced (preserve={has_preserve})")
            return final_prompt

        except Exception as e:
            print(f"[PROMPT-ENHANCER] Error: {str(e)}")
            return prompt_clean

    async def _call_openai(self, system: str, user: str) -> str:
        client = _get_client()
        for attempt in range(self.max_retries):
            try:
                response = await client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    temperature=0.1,
                    max_tokens=1000,
                )
                return response.choices[0].message.content

            except Exception as e:
                print(f"[PROMPT-ENHANCER] OpenAI attempt {attempt + 1} failed: {str(e)}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise

    def get_preservation_info(self, prompt: str) -> Dict[str, any]:
        has_preserve, preserve_block, keywords = self._detect_preserve_constraints(prompt)
        return {
            "has_preserve": has_preserve,
            "preserve_block": preserve_block,
            "keywords": keywords,
        }


# Глобальный экземпляр
prompt_enhancer = PromptEnhancer()
