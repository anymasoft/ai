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
SYSTEM_PROMPT_ENHANCER = """Ты — специалист по промптам для видео-генерации (MiniMax).
Ты переводишь русский промпт на английский и добавляешь максимум деталей движения.

Добавляй детальные инструкции о:
- Как должна двигаться камера
- Какие объекты в фокусе
- Динамика сцены
- Timing движений

{preservation_rules}

Отвечай ТОЛЬКО промптом на английском, без комментариев или объяснений."""

# -------- КОМПОНЕНТ: PRESERVATION RULES --------
# Критические инструкции для сохранения элементов дизайна
# Динамически генерируется на основе keywords
PRESERVATION_RULES_TEMPLATE = """
⚠️ CRITICAL PRESERVATION RULES
Preserved elements: {keywords}

Rules:
1. NO background blur / DOF / Bokeh on preserved elements
2. NO effects (blur, glow, particles) on preserved elements
3. ONLY basic lighting changes on subject
4. Keep preserved elements sharp and stable
5. Focus movement on subject ONLY, not preserved elements
"""

# -------- ПРОМПТ 3: CAMERA DIRECTOR --------
# Используется для добавления camera movement commands через GPT
# Добавляет cinematic движения камеры в видео-промпт
SYSTEM_PROMPT_CAMERA_DIRECTOR = """Ты — cinematic director для видео-генерации (MiniMax).

Добавляй camera movement commands из этого списка:
[Truck left], [Truck right]
[Pan left], [Pan right]
[Push in], [Pull out]
[Pedestal up], [Pedestal down]
[Tilt up], [Tilt down]
[Zoom in], [Zoom out]
[Shake], [Tracking shot], [Static shot]

Правила:
1. Добавляй 1-3 camera commands в конец промпта
2. Каждую команду на отдельной строке
3. Выбирай команды которые соответствуют описанию сцены
4. НИКАКИХ других текстов, ТОЛЬКО команды

Пример output:
[Pan left]
[Push in]"""


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
        # Поиск PRESERVE: блока (case-insensitive)
        preserve_pattern = r'(?:PRESERVE|preserve):\s*([^\n]+)'
        match = re.search(preserve_pattern, prompt)

        if not match:
            return False, "", []

        preserve_block = match.group(1).strip()
        keywords = [kw.strip() for kw in preserve_block.split(",")]

        print(f"[PROMPT-ENHANCER] Detected PRESERVE: {preserve_block}")
        return True, preserve_block, keywords

    def _get_preservation_rules(self, keywords: list) -> str:
        """Генерирует инструкции для GPT на основе constraints"""
        return PRESERVATION_RULES_TEMPLATE.format(keywords=', '.join(keywords))

    # ============ ENHANCEMENT PHASE ============

    async def enhance_prompt(self, prompt: str) -> str:
        """
        Главная функция энхансмента промптов для видео-генерации
        Максимум деталей движения камеры + preservation constraints
        """
        has_preserve, preserve_block, keywords = self._detect_preserve_constraints(prompt)

        # Удаляем PRESERVE блок
        prompt_clean = re.sub(r'(?:PRESERVE|preserve):[^\n]+', '', prompt).strip()

        preservation_rules = self._get_preservation_rules(keywords) if has_preserve else ""

        # Используем системный промпт из констант
        system_message = SYSTEM_PROMPT_ENHANCER.format(preservation_rules=preservation_rules)

        user_message = f"""Улучши этот видео-промпт:

{prompt_clean}

Вывод: ТОЛЬКО улучшенный промпт на английском с максимумом деталей движения и инструкциями для камеры."""

        try:
            response = await asyncio.wait_for(
                self._call_openai(system_message, user_message),
                timeout=self.timeout,
            )
            enhanced = response.strip()

            # Добавляем NO_GENERATION блок для PROMPT mode (ОБЯЗАТЕЛЬНО если есть PRESERVE)
            if has_preserve:
                enhanced += f"\n\nNO_GENERATION: {preserve_block}"

            print(f"[PROMPT-ENHANCER] Prompt enhanced (preserve={has_preserve})")
            return enhanced

        except asyncio.TimeoutError:
            print("[PROMPT-ENHANCER] ⚠️ GPT timeout, using original prompt")
            return prompt_clean

        except Exception as e:
            print(f"[PROMPT-ENHANCER] Error: {str(e)}")
            return prompt_clean

    # ============ PRIVATE METHODS ============

    async def _call_openai(self, system: str, user: str) -> str:
        """Вызов OpenAI API (с retry logic)"""
        for attempt in range(self.max_retries):
            try:
                response = await client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    temperature=0.7,
                    max_tokens=1000,
                )
                return response.choices[0].message.content

            except Exception as e:
                print(f"[PROMPT-ENHANCER] OpenAI attempt {attempt + 1} failed: {str(e)}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # exponential backoff
                else:
                    raise

    # ============ PUBLIC API ============

    def get_preservation_info(self, prompt: str) -> Dict[str, any]:
        """Получить информацию о preservation constraints"""
        has_preserve, preserve_block, keywords = self._detect_preserve_constraints(prompt)
        return {
            "has_preserve": has_preserve,
            "preserve_block": preserve_block,
            "keywords": keywords,
        }


# Глобальный экземпляр
prompt_enhancer = PromptEnhancer()
