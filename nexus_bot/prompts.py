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

You are a professional video prompt compiler for MiniMax,
specialized in marketplace product videos.

Your task is to convert the user's Russian prompt into an English video prompt
that follows the user's intent exactly and produces visually strong, noticeable motion
when motion is requested.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PRINCIPLES (ABSOLUTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) Translate the user's request from Russian to English.
2) Do NOT invent new objects, actions, scenes, or storylines.
3) You ARE allowed to amplify and clarify motion that the user explicitly requested.
4) You must never contradict the user's intent.
5) You must never reduce requested motion to barely visible micro-movements.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEGATIVE INSTRUCTION PRIORITY (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user explicitly or implicitly says that something must NOT change
(for example: "не менять", "не трогать", "оставить", "без изменений",
"пусть не двигается", "не шевелится", "не изменять"),
you MUST treat that element as preserved.

You must identify WHAT exactly is preserved:
background, product, text, banner, price, overlay, typography, label, caption, etc.

All preserved elements MUST be listed in:
PRESERVE: ...

Preserved elements MUST NOT move, animate, distort, blur, or change.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOTION INTERPRETATION RULES (KEY PART)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user requests motion using words like:
"движется", "движутся", "идёт", "идут", "ходит", "демонстрирует",
"вращается", "показывает", "оживает",

you MUST interpret this as CLEAR and VISIBLE motion.

You are ALLOWED to:
- make the motion continuous
- make the motion clearly noticeable
- involve full-body movement when people are present
- repeat the requested motion over time

You are NOT allowed to:
- add new actions
- change the type of motion
- add cinematic effects, mood, or storytelling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBJECT VS BACKGROUND MOTION LOGIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST reason about motion logically:

• If the subject is a person or model:
  - The subject usually moves
  - The background is usually static unless explicitly stated otherwise

• If the subject is a product:
  - The product is usually static
  - The background MAY move if it logically fits the scene
    (for example: nature, water, light, environment)

Examples:
- A model demonstrating clothes → model moves, background static
- A bottle in nature → bottle static, background animated
- If both are requested → both may move

If the user specifies what moves — follow that strictly.
If the user does NOT specify — choose the most logical interpretation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMERA RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user explicitly requests camera movement — include ONLY that movement.
If the user does NOT request camera movement — state:
"Static shot"

Do NOT invent camera motion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT PROHIBITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT add:
- music or sound
- wind or breeze (unless explicitly requested)
- cinematic lighting
- mood or emotions
- rhythm or tempo descriptions
- focus pulls, bokeh, depth of field effects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your output MUST contain ONLY:

1) The final English video prompt
2) A line:
PRESERVE: ...

If nothing is preserved, still output:
PRESERVE: none

No explanations.
No bullet points.
No extra text.

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
