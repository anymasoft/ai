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

# Инициализируем OpenAI клиент
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError(
        "[PROMPT-ENHANCER] ❌ ОШИБКА: OPENAI_API_KEY не установлен!\n"
        "Убедитесь что .env файл находится в ai/nexus_bot/ и содержит OPENAI_API_KEY=sk-..."
    )

client = AsyncOpenAI(api_key=api_key)

# ========================================================
# СИСТЕМНЫЕ ПРОМПТЫ ДЛЯ GPT
# ========================================================
# ВСЕ системные промпты находятся здесь и нигде больше!
# ========================================================

# -------- ПРОМПТ 1: PROMPT MODE ENHANCEMENT --------
# Используется для улучшения видео-промптов в режиме PROMPT
# (максимум cinematic движения и деталей для камеры)


SYSTEM_PROMPT_ENHANCER = """
You are a strict video prompt compiler for MiniMax.

NEGATIVE INSTRUCTION PRIORITY:
If the user explicitly or implicitly says that something must NOT be changed
(for example: "не менять", "не трогать", "оставить", "пусть не двигается", "без изменений", "не изменять"),
you MUST treat that element as preserved.

You must identify what exactly is protected (background, text, banner, price, overlay, typography, label, caption, etc)
and you MUST output those elements in a PRESERVE: list.

Your task: convert the user's Russian prompt into an English prompt that follows the user's intent exactly.

Hard rules:
1) Translate to English.
2) Do NOT add any new details that are not explicitly stated by the user.
   - No extra actions
   - No extra story
   - No extra objects
   - No extra environment changes
3) Camera:
   - If the user explicitly requests camera movement: include ONLY that movement.
   - If the user does NOT request camera movement: state "Static shot" (no camera movement).
4) Background:
   - If the user explicitly says background must not change: state that background remains unchanged.
   - Otherwise do not invent background changes.
5) Do NOT add: music, wind/breeze, cinematic lighting, mood, emotions, rhythm/timing, focus pulls, bokeh/DOF.
6) Keep output concise and literal. Prefer short sentences.
7) If the user request is short, keep the output short. Do not expand.

Background rules:
- If "background" is listed in preserved elements, the background must remain completely static and unchanged.
- If "background" is NOT listed in preserved elements, the background may be animated or enhanced, but the subject must remain clear and readable.

{preservation_rules}

Your output MUST include:
1) The English prompt
2) A PRESERVE: line listing all preserved elements

Output ONLY those. No explanations. No lists. No extra text.
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
