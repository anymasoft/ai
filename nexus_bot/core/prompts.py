"""
Smart Prompt Enhancer - Фаза 1 обработки промптов
Улучшение промптов через GPT-4o-mini + обнаружение PRESERVE constraints
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
        return f"""
⚠️ CRITICAL PRESERVATION RULES
Preserved elements: {', '.join(keywords)}

Rules:
1. NO background blur / DOF / Bokeh on preserved elements
2. NO effects (blur, glow, particles) on preserved elements
3. ONLY basic lighting changes on subject
4. Keep preserved elements sharp and stable
5. Focus movement on subject ONLY, not preserved elements
"""

    # ============ ENHANCEMENT PHASE ============

    async def enhance_prompt_for_template(self, prompt: str) -> str:
        """
        Улучшение промпта для TEMPLATE MODE
        Фокус на сцене, минимум движения
        """
        has_preserve, preserve_block, keywords = self._detect_preserve_constraints(prompt)

        # Удаляем PRESERVE блок из промпта (будет добавлен в сообщение GPT)
        prompt_clean = re.sub(r'(?:PRESERVE|preserve):[^\n]+', '', prompt).strip()

        preservation_rules = self._get_preservation_rules(keywords) if has_preserve else ""

        system_message = f"""Ты — специалист по промптам для видео-генерации (MiniMax).
Ты переводишь русский промпт на английский и расширяешь его деталями о сцене.

MODE: TEMPLATE (фокус на сцене, минимум движения, стабильность)

{preservation_rules}

Отвечай ТОЛЬКО промптом на английском, без комментариев или объяснений."""

        user_message = f"""Улучши этот видео-промпт (режим TEMPLATE):

{prompt_clean}

Вывод: ТОЛЬКО улучшенный промпт на английском."""

        try:
            response = await asyncio.wait_for(
                self._call_openai(system_message, user_message),
                timeout=self.timeout,
            )
            enhanced = response.strip()

            # Добавляем NO_GENERATION блок для template mode (если есть PRESERVE)
            if has_preserve:
                enhanced += f"\n\nNO_GENERATION: {preserve_block}"

            print(f"[PROMPT-ENHANCER] Template enhanced (preserve={has_preserve})")
            return enhanced

        except asyncio.TimeoutError:
            print("[PROMPT-ENHANCER] ⚠️ GPT timeout, using original prompt")
            return prompt_clean

        except Exception as e:
            print(f"[PROMPT-ENHANCER] Error: {str(e)}")
            return prompt_clean

    async def enhance_prompt_for_prompt(self, prompt: str) -> str:
        """
        Улучшение промпта для PROMPT MODE
        Максимум деталей движения камеры + constraints
        """
        has_preserve, preserve_block, keywords = self._detect_preserve_constraints(prompt)

        # Удаляем PRESERVE блок
        prompt_clean = re.sub(r'(?:PRESERVE|preserve):[^\n]+', '', prompt).strip()

        preservation_rules = self._get_preservation_rules(keywords) if has_preserve else ""

        system_message = f"""Ты — специалист по промптам для видео-генерации (MiniMax).
Ты переводишь русский промпт на английский и добавляешь максимум деталей движения.

MODE: PROMPT (максимум cinematic движения, детальные инструкции для камеры)

{preservation_rules}

Добавляй детальные инструкции о:
- Как должна двигаться камера
- Какие объекты в фокусе
- Динамика сцены
- Timing движений

Отвечай ТОЛЬКО промптом на английском, без комментариев или объяснений."""

        user_message = f"""Улучши этот видео-промпт (режим PROMPT с максимумом деталей движения):

{prompt_clean}

Вывод: ТОЛЬКО улучшенный промпт на английском с инструкциями для камеры."""

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

    async def enhance_prompt(self, prompt: str, mode: str = "prompt") -> str:
        """
        Главная функция энхансмента
        mode: "template" или "prompt"
        """
        if mode == "template":
            return await self.enhance_prompt_for_template(prompt)
        else:
            return await self.enhance_prompt_for_prompt(prompt)

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
